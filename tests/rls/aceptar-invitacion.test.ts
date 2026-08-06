import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { crearInvitaciones } from "../../src/lib/supabase/invitaciones";

let e: Escenario;
const extra: string[] = [];

beforeAll(async () => {
  e = await montarEscenario("aceptar");
});
afterAll(async () => {
  await limpiarUsuarios(extra);
  await desmontar(e);
});

test("invitar a alguien que YA tiene cuenta tambien le da acceso", async () => {
  // Este es el caso que el trigger no cubre: no se crea ninguna cuenta nueva,
  // asi que `z_aceptar_invitaciones` nunca salta. Sin la funcion, esta persona
  // entra y no ve nada — sin error y sin pista.
  const ya = await comoUsuario("ya-existia@prueba.klaze");
  extra.push(ya.id);

  await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["ya-existia@prueba.klaze"],
    [e.cursoAPublicado]
  );

  const { data: cuantas } = await ya.cliente.rpc("aceptar_mis_invitaciones");
  expect(cuantas).toBe(1);

  const { data: cursos } = await ya.cliente.from("cursos").select("id");
  expect((cursos ?? []).map((c) => c.id)).toContain(e.cursoAPublicado);
});

test("llamarla dos veces no duplica inscripciones", async () => {
  const ya = await comoUsuario("doble@prueba.klaze");
  extra.push(ya.id);

  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["doble@prueba.klaze"], "todos");
  await ya.cliente.rpc("aceptar_mis_invitaciones");
  await ya.cliente.rpc("aceptar_mis_invitaciones");

  const { data } = await admin
    .from("inscripciones")
    .select("id")
    .eq("usuario_id", ya.id);
  expect(data?.length).toBe(1);
});

test("no puede aceptar invitaciones dirigidas a otro correo", async () => {
  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["ajeno@prueba.klaze"], "todos");

  const { data: cuantas } = await e.alumnoB.cliente.rpc("aceptar_mis_invitaciones");
  expect(cuantas).toBe(0);
});

test("la invitacion queda marcada como aceptada", async () => {
  const ya = await comoUsuario("marcada@prueba.klaze");
  extra.push(ya.id);

  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["marcada@prueba.klaze"], "todos");
  await ya.cliente.rpc("aceptar_mis_invitaciones");

  const { data } = await admin
    .from("invitaciones")
    .select("estado")
    .eq("email", "marcada@prueba.klaze")
    .single();
  expect(data?.estado).toBe("aceptada");
});
