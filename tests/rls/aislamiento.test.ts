import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

let e: Escenario;
beforeAll(async () => {
  e = await montarEscenario("aisl");
});
afterAll(async () => {
  await desmontar(e);
});

test("1. el alumno de A no ve ningun curso de B", async () => {
  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  expect((data ?? []).map((c) => c.id)).not.toContain(e.cursoB);
});

test("2. el dueno de A no ve inscripciones de B", async () => {
  const { data } = await e.duenoA.cliente.from("inscripciones").select("comunidad_id");
  const comunidades = new Set((data ?? []).map((i) => i.comunidad_id));
  expect(comunidades.has(e.comunidadB)).toBe(false);
});

test("3. el alumno de A no ve los borradores de A", async () => {
  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  const ids = (data ?? []).map((c) => c.id);
  expect(ids).toContain(e.cursoAPublicado);
  expect(ids).not.toContain(e.cursoABorrador);
});

test("4. suspender revoca el acceso de verdad", async () => {
  await admin.from("inscripciones")
    .update({ estado: "suspendido" }).eq("usuario_id", e.alumnoA.id);

  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  expect(data ?? []).toEqual([]);

  await admin.from("inscripciones")
    .update({ estado: "activo" }).eq("usuario_id", e.alumnoA.id);
});

test("5. no ve las lecciones de un curso que no cubre su acceso", async () => {
  const { data: mod } = await admin.from("modulos")
    .insert({ curso_id: e.cursoASinAcceso, titulo: "m", orden: 1 })
    .select("id").single();
  await admin.from("lecciones").insert({
    modulo_id: mod!.id, titulo: "leccion-secreta", orden: 1, tipo: "texto",
  });

  const { data } = await e.alumnoA.cliente.from("lecciones").select("titulo");
  expect((data ?? []).map((l) => l.titulo)).not.toContain("leccion-secreta");
});

test("un curso en borrador no sale de la base para el alumno", async () => {
  // Se prueba en la BASE y no en la pantalla: la app tambien lo filtra, pero
  // eso ocurre despues de que la respuesta viaje. Sin esta politica, quien
  // mirase la peticion veria titulos e identificadores de Vimeo de lo que aun
  // no se ha publicado.
  const { data: creado } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "En preparacion", orden: 99, publicado: false })
    .select("id")
    .single();

  const { data: delAlumno } = await e.alumnoA.cliente
    .from("modulos")
    .select("id")
    .eq("id", creado!.id);
  expect(delAlumno ?? []).toEqual([]);

  // El dueno si lo ve: es quien lo esta preparando.
  const { data: delDueno } = await e.duenoA.cliente
    .from("modulos")
    .select("id")
    .eq("id", creado!.id);
  expect(delDueno ?? []).toHaveLength(1);

  await admin.from("modulos").delete().eq("id", creado!.id);
});

test("publicarlo lo hace visible al instante", async () => {
  const { data: creado } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "Listo", orden: 98, publicado: true })
    .select("id")
    .single();

  const { data } = await e.alumnoA.cliente.from("modulos").select("id").eq("id", creado!.id);
  expect(data ?? []).toHaveLength(1);

  await admin.from("modulos").delete().eq("id", creado!.id);
});
