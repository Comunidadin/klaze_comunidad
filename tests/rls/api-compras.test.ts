import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, limpiarUsuarios } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * Los enlaces de compra, contra el servidor de desarrollo.
 *
 * Estas pruebas preguntan lo que pregunta el negocio —"¿el que pagó ve su
 * módulo y solo el suyo?"— y no por las filas. Es la lección del directorio de
 * miembros: allí las pruebas de la tabla pasaban mientras la pantalla enseñaba
 * una sola persona, porque nadie preguntaba por la pantalla.
 *
 * Si el servidor no está levantado se saltan con un aviso, en vez de fallar de
 * forma que parezca un fallo del código.
 */

const BASE = "http://localhost:3000";
const COMPRADOR = "comprador-apicompras@prueba.klaze";
const SEGUNDO = "segundo-apicompras@prueba.klaze";

let e: Escenario;
let hayServidor = false;
let token: string;
let tokenApagado: string;
let canalId: string;

async function crearCanal(nombre: string, activo: boolean, cursos: string[]) {
  const { data, error } = await admin
    .from("canales_venta")
    .insert({ comunidad_id: e.comunidadA, nombre, activo, todos_los_cursos: false })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);
  for (const curso of cursos) {
    const { error: e2 } = await admin
      .from("canal_cursos")
      .insert({ canal_id: data.id, curso_id: curso });
    if (e2) throw new Error(e2.message);
  }
  return data as { id: string; token: string };
}

/** Los ids de los módulos a los que ese correo tiene acceso en la academia A. */
async function modulosDe(email: string): Promise<string[]> {
  const { data: usuarioId } = await admin.rpc("perfil_por_email", { p_email: email });
  if (!usuarioId) return [];

  const { data } = await admin
    .from("inscripciones")
    .select("estado, inscripcion_cursos(curso_id)")
    .eq("usuario_id", usuarioId)
    .eq("comunidad_id", e.comunidadA)
    .maybeSingle();

  if (!data || data.estado !== "activo") return [];
  return ((data.inscripcion_cursos ?? []) as { curso_id: string }[])
    .map((c) => c.curso_id)
    .sort();
}

async function borrarComprador(email: string) {
  const { data: id } = await admin.rpc("perfil_por_email", { p_email: email });
  if (id) await limpiarUsuarios([id as string]);
}

beforeAll(async () => {
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!hayServidor) return;

  e = await montarEscenario("apicompras");
  await borrarComprador(COMPRADOR);
  await borrarComprador(SEGUNDO);

  const canal = await crearCanal("Oferta viva", true, [e.cursoAPublicado]);
  token = canal.token;
  canalId = canal.id;
  tokenApagado = (await crearCanal("Oferta apagada", false, [e.cursoAPublicado])).token;
});

afterAll(async () => {
  if (!hayServidor) return;
  await borrarComprador(COMPRADOR);
  await borrarComprador(SEGUNDO);
  await desmontar(e);
});

function saltada(): boolean {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return true;
  }
  return false;
}

const json = (cuerpo: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
});

test("un token inexistente no dice ni que no existe", async () => {
  if (saltada()) return;
  // 404 y no 403: un 403 confirmaria que el token existe, que es justo lo que
  // protege a una direccion que cualquiera puede probar.
  const r = await fetch(`${BASE}/api/compras/nodeberiaexistir`, json({ email: COMPRADOR }));
  expect(r.status).toBe(404);
});

test("un canal apagado responde igual que uno que no existe", async () => {
  if (saltada()) return;
  const r = await fetch(`${BASE}/api/compras/${tokenApagado}`, json({ email: COMPRADOR }));
  expect(r.status).toBe(404);
});

test("una compra da acceso a ese modulo y solo a ese", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/compras/${token}`, json({ email: COMPRADOR }));
  expect(r.status).toBe(200);
  expect((await r.json()).ok).toBe(true);

  // `cursoASinAcceso` es de la misma academia y esta publicado. Que no aparezca
  // es lo que prueba que el canal decide, no la academia.
  expect(await modulosDe(COMPRADOR)).toEqual([e.cursoAPublicado]);
});

test("el acceso existe sin que el comprador haya iniciado sesion", async () => {
  if (saltada()) return;
  // Nadie ha entrado con esa cuenta en toda la prueba: si el acceso dependiera
  // del inicio de sesion, la comprobacion anterior habria dado vacio.
  const { data: id } = await admin.rpc("perfil_por_email", { p_email: COMPRADOR });
  expect(id).toBeTruthy();
});

test("la misma compra dos veces no duplica la inscripcion", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/compras/${token}`, json({ email: COMPRADOR }));
  expect(r.status).toBe(200);

  const { data: usuarioId } = await admin.rpc("perfil_por_email", { p_email: COMPRADOR });
  const { count } = await admin
    .from("inscripciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId as string)
    .eq("comunidad_id", e.comunidadA);
  expect(count).toBe(1);
});

test("un formulario clasico funciona igual que JSON", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/compras/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // `q3_tuCorreo` es un nombre de campo inventado a proposito: los decide la
    // otra aplicacion, y un correo se reconoce por su FORMA aunque el campo se
    // llame como sea. Un nombre no: por eso ese si tiene que llamarse de algo
    // reconocible, y si no lo es, la cuenta se queda sin nombre y el directorio
    // enseña la parte de delante del correo.
    body: new URLSearchParams({ q3_tuCorreo: SEGUNDO, nombre: "Ana Prueba" }),
  });
  expect(r.status).toBe(200);
  expect(await modulosDe(SEGUNDO)).toEqual([e.cursoAPublicado]);

  const { data: id } = await admin.rpc("perfil_por_email", { p_email: SEGUNDO });
  const { data: perfil } = await admin
    .from("perfiles")
    .select("nombre")
    .eq("id", id as string)
    .single();
  expect(perfil?.nombre).toBe("Ana Prueba");
});

test("un cuerpo sin correo no crea nada y no devuelve error", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/compras/${token}`, json({ pedido: 42 }));
  // 200 a proposito: las herramientas de webhooks desactivan un destino que
  // responde con error, y aqui no hay nada que reintentar.
  expect(r.status).toBe(200);
  expect((await r.json()).motivo).toBe("sin_email");

  const { data } = await admin
    .from("recepciones_canal")
    .select("resultado")
    .eq("canal_id", canalId)
    .eq("resultado", "sin_email");
  expect((data ?? []).length).toBeGreaterThan(0);
});

test("la baja suspende el acceso, y solo en esta academia", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/compras/${token}/baja`, json({ email: COMPRADOR }));
  expect(r.status).toBe(200);
  expect((await r.json()).ok).toBe(true);

  expect(await modulosDe(COMPRADOR)).toEqual([]);

  // La cuenta sigue existiendo: la misma persona puede estar estudiando en
  // otra academia, y darla de baja aqui no puede dejarla fuera de alli.
  const { data: id } = await admin.rpc("perfil_por_email", { p_email: COMPRADOR });
  expect(id).toBeTruthy();
});

test("volver a comprar reactiva el acceso", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/compras/${token}`, json({ email: COMPRADOR }));
  expect(r.status).toBe(200);
  // Sin `aceptar_invitaciones_de`, aqui seguiria suspendido hasta que la
  // persona iniciara sesion — pagando y sin ver nada.
  expect(await modulosDe(COMPRADOR)).toEqual([e.cursoAPublicado]);
});

test("la baja de un correo desconocido no revienta", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/compras/${token}/baja`, json({ email: "nadie@prueba.klaze" }));
  expect(r.status).toBe(200);
  expect((await r.json()).motivo).toBe("sin_cuenta");
});
