import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

let e: Escenario;
let publicacionA: string;
let leccionA: string;

beforeAll(async () => {
  e = await montarEscenario("feed");

  const { data: sec } = await admin
    .from("secciones")
    .insert({ comunidad_id: e.comunidadA, titulo: "General", orden: 1 })
    .select("id").single();
  const { data: esp } = await admin
    .from("espacios")
    .insert({ seccion_id: sec!.id, slug: "general", nombre: "General", orden: 1 })
    .select("id").single();
  const { data: pub } = await admin
    .from("publicaciones")
    .insert({
      comunidad_id: e.comunidadA, espacio_id: esp!.id,
      autor_id: e.alumnoA.id, titulo: "hola", cuerpo: "de A",
    })
    .select("id").single();
  publicacionA = pub!.id;

  // `modulos` SI cuelga del curso: lo que subio a la academia fueron las
  // tablas sociales —secciones, publicaciones, eventos—, no el contenido.
  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "m", orden: 1 })
    .select("id").single();
  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "l", orden: 1 })
    .select("id").single();
  leccionA = lec!.id;
});

afterAll(async () => {
  await desmontar(e);
});

test("6a. el alumno de B no ve publicaciones de A", async () => {
  const { data } = await e.alumnoB.cliente.from("publicaciones").select("id");
  expect((data ?? []).map((p) => p.id)).not.toContain(publicacionA);
});

test("6b. nadie da me gusta a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente
    .from("me_gusta")
    .insert({ publicacion_id: publicacionA, usuario_id: e.alumnoB.id });
  expect(error).not.toBeNull();
});

test("6c. nadie publica a nombre de otro", async () => {
  const { data: esp } = await admin
    .from("espacios").select("id").limit(1).single();
  const { error } = await e.alumnoA.cliente.from("publicaciones").insert({
    comunidad_id: e.comunidadA, espacio_id: esp!.id,
    autor_id: e.duenoA.id, titulo: "suplantada", cuerpo: "x",
  });
  expect(error).not.toBeNull();
});

test("6d. el progreso de un alumno es privado hasta para el dueno", async () => {
  await admin.from("progreso")
    .insert({ usuario_id: e.alumnoA.id, leccion_id: leccionA });

  const { data } = await e.duenoA.cliente.from("progreso").select("usuario_id");
  expect((data ?? []).map((p) => p.usuario_id)).not.toContain(e.alumnoA.id);
});

test("6e. el alumno de B no ve eventos de A", async () => {
  await admin.from("eventos").insert({
    comunidad_id: e.comunidadA, titulo: "evento-de-A",
    fecha_inicio: "2026-09-01T18:00:00Z",
  });

  const { data } = await e.alumnoB.cliente.from("eventos").select("titulo");
  expect((data ?? []).map((v) => v.titulo)).not.toContain("evento-de-A");
});
