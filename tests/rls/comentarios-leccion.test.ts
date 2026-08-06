import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import {
  leerComentarios,
  comentarLeccion,
} from "../../src/lib/supabase/comentarios-leccion";

let e: Escenario;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("comlec");
  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1 })
    .select("id")
    .single();
  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1, tipo: "texto" })
    .select("id")
    .single();
  leccionId = lec!.id;
});

afterAll(async () => {
  await desmontar(e);
});

test("un alumno con acceso comenta y lo relee", async () => {
  await comentarLeccion(e.alumnoA.cliente, leccionId, "Esto aplica a servicios?", null);
  const lista = await leerComentarios(e.alumnoA.cliente, leccionId);
  expect(lista.map((c) => c.cuerpo)).toContain("Esto aplica a servicios?");
});

test("el comentario llega con el nombre de su autor", async () => {
  const lista = await leerComentarios(e.alumnoA.cliente, leccionId);
  // Sin el nombre, la pantalla mostraria comentarios sin firmar.
  expect(lista[0].autorId).toBe(e.alumnoA.id);
  expect(lista[0].autorNombre).not.toBe("");
});

test("el dueno responde y el alumno lo ve", async () => {
  const lista = await leerComentarios(e.duenoA.cliente, leccionId);
  await comentarLeccion(e.duenoA.cliente, leccionId, "Si, igual.", lista[0].id);

  const trasResponder = await leerComentarios(e.alumnoA.cliente, leccionId);
  const respuesta = trasResponder.find((c) => c.cuerpo === "Si, igual.");
  expect(respuesta).toBeDefined();
  expect(respuesta?.padreId).toBe(lista[0].id);
});

test("un alumno de otra empresa no ve nada", async () => {
  const lista = await leerComentarios(e.alumnoB.cliente, leccionId);
  expect(lista).toEqual([]);
});

test("nadie comenta a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente.from("comentarios_leccion").insert({
    leccion_id: leccionId,
    autor_id: e.duenoA.id,
    cuerpo: "suplantado",
  });
  expect(error).not.toBeNull();
});

test("un alumno sin acceso al curso no puede comentar", async () => {
  await expect(
    comentarLeccion(e.alumnoB.cliente, leccionId, "colado", null)
  ).rejects.toThrow();
});
