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

test("comprar un segundo producto no quita el acceso del primero", async () => {
  // El caso de varios productos en la misma academia: el pase completo y
  // luego un taller suelto. Antes, la segunda compra ponia
  // `todos_los_cursos = false` y dejaba a esa persona con UN modulo despues de
  // pagar dos veces — sin error, sin aviso, y con su inscripcion "activa".
  const dos = await comoUsuario("dos-productos@prueba.klaze");
  extra.push(dos.id);

  // 1. Compra el pase completo.
  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["dos-productos@prueba.klaze"], "todos");
  await dos.cliente.rpc("aceptar_mis_invitaciones");

  // 2. Compra un taller suelto, que es una lista de un solo modulo.
  await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["dos-productos@prueba.klaze"],
    [e.cursoAPublicado]
  );
  await dos.cliente.rpc("aceptar_mis_invitaciones");

  const { data } = await admin
    .from("inscripciones")
    .select("todos_los_cursos")
    .eq("usuario_id", dos.id)
    .eq("comunidad_id", e.comunidadA)
    .single();

  // Comprar SUMA. Quitar acceso tiene sus propias puertas, y ninguna es esta.
  expect(data?.todos_los_cursos).toBe(true);

  // Y de verdad los sigue viendo, no solo la marca: `cursoASinAcceso` es el
  // que nunca estuvo en ninguna lista.
  const { data: cursos } = await dos.cliente.from("cursos").select("id");
  expect((cursos ?? []).map((c) => c.id)).toContain(e.cursoASinAcceso);
});

test("comprar un segundo producto suma sus modulos al primero", async () => {
  const suma = await comoUsuario("suma-productos@prueba.klaze");
  extra.push(suma.id);

  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["suma-productos@prueba.klaze"], [
    e.cursoAPublicado,
  ]);
  await suma.cliente.rpc("aceptar_mis_invitaciones");

  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["suma-productos@prueba.klaze"], [
    e.cursoASinAcceso,
  ]);
  await suma.cliente.rpc("aceptar_mis_invitaciones");

  const { data: cursos } = await suma.cliente.from("cursos").select("id");
  const ids = (cursos ?? []).map((c) => c.id);
  expect(ids).toContain(e.cursoAPublicado);
  expect(ids).toContain(e.cursoASinAcceso);
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
