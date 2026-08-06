import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, comoAnonimo, comoUsuario, limpiarUsuarios } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

let e: Escenario;
let token: string;
const extra: string[] = [];

beforeAll(async () => {
  e = await montarEscenario("inv");
  const { data, error } = await admin
    .from("invitaciones")
    .insert({
      email: "invitado-inv@prueba.klaze",
      comunidad_id: e.comunidadA,
      todos_los_cursos: true,
    })
    .select("token").single();
  if (error) throw new Error(`invitacion: ${error.message}`);
  token = data!.token;
});

afterAll(async () => {
  await limpiarUsuarios(extra);
  await desmontar(e);
});

test("8a. el token no es adivinable", () => {
  // Los tokens de la demo eran inv-1, inv-2... Cualquiera podia probar el
  // siguiente y leer a quien se invito y a que empresa.
  expect(token.length).toBeGreaterThanOrEqual(40);
  expect(token).not.toMatch(/^inv-\d+$/);
});

test("8b. un token inventado no se distingue de uno gastado", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.rpc("invitacion_publica", { p_token: "inventado" });
  expect(data ?? []).toEqual([]);
});

test("8c. la invitacion pendiente si se puede leer sin sesion", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.rpc("invitacion_publica", { p_token: token });
  expect(data?.[0]?.email).toBe("invitado-inv@prueba.klaze");
});

test("8d. un anonimo NO puede leer la tabla de invitaciones", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.from("invitaciones").select("email");
  expect(data ?? []).toEqual([]);
});

test("8e. la marca publica no filtra el propietario", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.rpc("marca_publica", { p_slug: "empresa-a-inv" });
  expect(data?.[0]?.nombre).toBe("empresa-a-inv");
  expect(data?.[0]).not.toHaveProperty("propietario_id");
});

test("8f. al entrar, la invitacion pendiente se vuelve inscripcion", async () => {
  const invitado = await comoUsuario("invitado-inv@prueba.klaze");
  extra.push(invitado.id);

  const { data } = await invitado.cliente
    .from("inscripciones").select("comunidad_id, estado");
  expect(data?.[0]?.comunidad_id).toBe(e.comunidadA);
  expect(data?.[0]?.estado).toBe("activo");
});
