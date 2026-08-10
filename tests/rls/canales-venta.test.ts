import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * Aislamiento de los enlaces de compra.
 *
 * Un canal es una llave: quien tiene su token da acceso a la academia sin
 * sesión y sin permiso. Que el token no se le escape a otra empresa es, por
 * tanto, tan importante como que no se le escape una contraseña.
 *
 * Y las recepciones son un registro. Un registro que su propio dueño puede
 * editar o borrar no sirve para averiguar por qué alguien no entró, así que
 * aquí también se comprueba que nadie escribe en él desde el navegador.
 */

let e: Escenario;
let canalA: string;

beforeAll(async () => {
  e = await montarEscenario("canales");

  const { data, error } = await admin
    .from("canales_venta")
    .insert({
      comunidad_id: e.comunidadA,
      nombre: "Oferta de prueba",
      todos_los_cursos: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  canalA = data.id;

  const { error: e2 } = await admin
    .from("canal_cursos")
    .insert({ canal_id: canalA, curso_id: e.cursoAPublicado });
  if (e2) throw new Error(e2.message);

  const { error: e3 } = await admin.from("recepciones_canal").insert({
    canal_id: canalA,
    email: "alguien@prueba.klaze",
    accion: "alta",
    resultado: "creado",
  });
  if (e3) throw new Error(e3.message);
});

afterAll(async () => {
  await desmontar(e);
});

test("el dueno ve sus canales", async () => {
  const { data } = await e.duenoA.cliente.from("canales_venta").select("id");
  expect(data?.map((c) => c.id)).toEqual([canalA]);
});

test("el dueno de otra empresa no ve el canal ni con el id a mano", async () => {
  const { data } = await e.duenoB.cliente
    .from("canales_venta")
    .select("id")
    .eq("id", canalA);
  expect(data ?? []).toEqual([]);
});

test("un alumno no ve ningun canal de su academia", async () => {
  // El token da acceso: un alumno con el token podria regalar el curso.
  const { data } = await e.alumnoA.cliente.from("canales_venta").select("id, token");
  expect(data ?? []).toEqual([]);
});

test("el dueno de otra empresa no puede crear un canal en la mia", async () => {
  const { data, error } = await e.duenoB.cliente
    .from("canales_venta")
    .insert({ comunidad_id: e.comunidadA, nombre: "robado" })
    .select("id");

  // RLS filtra en vez de lanzar segun el caso, asi que vale cualquiera de las
  // dos siempre que NO se haya creado nada.
  expect(error !== null || (data ?? []).length === 0).toBe(true);

  const { data: quedan } = await admin
    .from("canales_venta")
    .select("id")
    .eq("comunidad_id", e.comunidadA);
  expect(quedan?.length).toBe(1);
});

test("el dueno lee las recepciones de su canal", async () => {
  const { data } = await e.duenoA.cliente
    .from("recepciones_canal")
    .select("email");
  expect(data?.map((r) => r.email)).toEqual(["alguien@prueba.klaze"]);
});

test("el dueno de otra empresa no lee mis recepciones", async () => {
  const { data } = await e.duenoB.cliente.from("recepciones_canal").select("email");
  expect(data ?? []).toEqual([]);
});

test("nadie busca cuentas por correo desde una sesion", async () => {
  // `perfil_por_email` existe para el servidor, que ya se salta RLS con la
  // clave secreta. Abierta a `authenticated` seria un buscador de correos:
  // pruebas uno, y si devuelve id, esa persona esta en Klaze.
  const { error } = await e.duenoA.cliente.rpc("perfil_por_email", {
    p_email: "alumnoa-canales@prueba.klaze",
  });
  expect(error).not.toBeNull();
});

test("nadie acepta las invitaciones de otro", async () => {
  // La version con `auth.uid()` saca el correo de la sesion justo para que
  // nadie pueda pasar un id ajeno. La generalizada recibe el id por parametro,
  // asi que solo puede llamarla el servidor.
  const { error } = await e.duenoB.cliente.rpc("aceptar_invitaciones_de", {
    p_usuario: e.alumnoA.id,
  });
  expect(error).not.toBeNull();
});

test("nadie escribe recepciones desde una sesion, ni su dueno", async () => {
  // La ausencia de politica de escritura ES la proteccion: si el dueno pudiera
  // inventar o borrar filas, el registro no probaria nada.
  const { data, error } = await e.duenoA.cliente
    .from("recepciones_canal")
    .insert({ canal_id: canalA, email: "falso@prueba.klaze", accion: "alta", resultado: "creado" })
    .select("id");
  expect(error !== null || (data ?? []).length === 0).toBe(true);

  const { data: borradas } = await e.duenoA.cliente
    .from("recepciones_canal")
    .delete()
    .eq("canal_id", canalA)
    .select("id");
  expect(borradas ?? []).toEqual([]);

  const { count } = await admin
    .from("recepciones_canal")
    .select("id", { count: "exact", head: true })
    .eq("canal_id", canalA);
  expect(count).toBe(1);
});
