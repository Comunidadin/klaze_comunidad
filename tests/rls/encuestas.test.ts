import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * Encuestas: un voto por persona y encuesta (clave compuesta), cada cual el
 * suyo, y nada cruza academias.
 */

let e: Escenario;
let postA: string;
let opcion1: string;
let opcion2: string;

beforeAll(async () => {
  e = await montarEscenario("encu");

  const { data: sec } = await admin
    .from("secciones")
    .insert({ comunidad_id: e.comunidadA, titulo: "G", orden: 1 })
    .select("id").single();
  const { data: esp } = await admin
    .from("espacios")
    .insert({ seccion_id: sec!.id, slug: "general", nombre: "General", orden: 1 })
    .select("id").single();
  const { data: post } = await admin
    .from("publicaciones")
    .insert({
      comunidad_id: e.comunidadA, espacio_id: esp!.id,
      autor_id: e.duenoA.id, titulo: "¿Cuál prefieren?", cuerpo: "",
    })
    .select("id").single();
  postA = post!.id;

  const { data: ops } = await admin
    .from("encuesta_opciones")
    .insert([
      { publicacion_id: postA, texto: "La A", orden: 1 },
      { publicacion_id: postA, texto: "La B", orden: 2 },
    ])
    .select("id");
  opcion1 = ops![0].id;
  opcion2 = ops![1].id;
});

afterAll(async () => {
  await desmontar(e);
});

test("un alumno vota, y cambiar el voto reemplaza en vez de duplicar", async () => {
  const { error } = await e.alumnoA.cliente.from("encuesta_votos").upsert(
    { publicacion_id: postA, usuario_id: e.alumnoA.id, opcion_id: opcion1 },
    { onConflict: "publicacion_id,usuario_id" }
  );
  expect(error).toBeNull();

  const { error: e2 } = await e.alumnoA.cliente.from("encuesta_votos").upsert(
    { publicacion_id: postA, usuario_id: e.alumnoA.id, opcion_id: opcion2 },
    { onConflict: "publicacion_id,usuario_id" }
  );
  expect(e2).toBeNull();

  const { data } = await admin
    .from("encuesta_votos")
    .select("opcion_id")
    .eq("publicacion_id", postA)
    .eq("usuario_id", e.alumnoA.id);
  expect(data?.length).toBe(1);
  expect(data![0].opcion_id).toBe(opcion2);
});

test("nadie vota a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente.from("encuesta_votos").insert({
    publicacion_id: postA, usuario_id: e.duenoA.id, opcion_id: opcion1,
  });
  expect(error).not.toBeNull();
});

test("un alumno de otra academia ni ve las opciones ni puede votar", async () => {
  const { data } = await e.alumnoB.cliente
    .from("encuesta_opciones")
    .select("id")
    .eq("publicacion_id", postA);
  expect(data ?? []).toEqual([]);

  const { error } = await e.alumnoB.cliente.from("encuesta_votos").insert({
    publicacion_id: postA, usuario_id: e.alumnoB.id, opcion_id: opcion1,
  });
  expect(error).not.toBeNull();
});

test("las opciones solo las crea el autor de la publicacion", async () => {
  const { data } = await e.alumnoA.cliente
    .from("encuesta_opciones")
    .insert({ publicacion_id: postA, texto: "colada", orden: 3 })
    .select("id");
  expect(data ?? []).toEqual([]);
});
