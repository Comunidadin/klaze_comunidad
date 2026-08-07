import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { marcarLeccion } from "../../src/lib/supabase/progreso";
import { cargarArmazon } from "../../src/lib/supabase/consultas";

let e: Escenario;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("progreso");
  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1 })
    .select("id")
    .single();
  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1 })
    .select("id")
    .single();
  leccionId = lec!.id;
});

afterAll(async () => {
  await desmontar(e);
});

test("marcar una leccion se guarda y se relee", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.progreso).toContain(leccionId);
});

test("desmarcar la quita", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);
  await marcarLeccion(e.alumnoA.cliente, leccionId, false);

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.progreso).not.toContain(leccionId);
});

test("el progreso de un alumno no lo ve otro", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  const armazonB = await cargarArmazon(e.alumnoB.cliente);
  expect(armazonB.progreso).not.toContain(leccionId);
});

test("nadie puede marcar una leccion a nombre de otro", async () => {
  // `marcarLeccion` saca el usuario de la sesion, asi que la unica forma de
  // intentarlo es saltandose el helper. La politica tiene que rechazarlo.
  const { error } = await e.alumnoB.cliente
    .from("progreso")
    .insert({ usuario_id: e.alumnoA.id, leccion_id: leccionId });

  expect(error).not.toBeNull();
});

test("suspender no borra el progreso", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  await admin
    .from("inscripciones")
    .update({ estado: "suspendido" })
    .eq("usuario_id", e.alumnoA.id);
  await admin
    .from("inscripciones")
    .update({ estado: "activo" })
    .eq("usuario_id", e.alumnoA.id);

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.progreso).toContain(leccionId);
});
