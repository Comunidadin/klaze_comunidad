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
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1 })
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

test("con el goteo activo, un alumno con acceso al curso no puede leer ni escribir comentarios", async () => {
  // El goteo esconde la clase entera, y los comentarios tienen que esconderse
  // con ella: comprobaban `cubre_curso` pero no `curso_disponible`, asi que
  // alguien con un leccion_id guardado de antes podia seguir leyendo y
  // escribiendo aunque el modulo estuviera cerrado.
  await admin
    .from("cursos")
    .update({
      goteo_modo: "fecha",
      goteo_dias: null,
      goteo_desde: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq("id", e.cursoAPublicado);

  // Los comentarios de las pruebas anteriores ya existen, y el goteo los
  // esconde igual que esconde la clase.
  const lista = await leerComentarios(e.alumnoA.cliente, leccionId);
  expect(lista).toEqual([]);

  await expect(
    comentarLeccion(e.alumnoA.cliente, leccionId, "colado antes de tiempo", null)
  ).rejects.toThrow();

  // El dueno los sigue viendo: es su rama de las politicas, la que no mira
  // `curso_disponible`.
  const listaDueno = await leerComentarios(e.duenoA.cliente, leccionId);
  expect(listaDueno.length).toBeGreaterThan(0);

  await admin
    .from("cursos")
    .update({ goteo_modo: "ninguno", goteo_dias: null, goteo_desde: null })
    .eq("id", e.cursoAPublicado);

  const listaTrasAbrir = await leerComentarios(e.alumnoA.cliente, leccionId);
  expect(listaTrasAbrir.length).toBeGreaterThan(0);
});
