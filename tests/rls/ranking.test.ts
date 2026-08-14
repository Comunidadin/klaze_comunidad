import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { marcarLeccion } from "../../src/lib/supabase/progreso";

let e: Escenario;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("ranking");
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

/**
 * Los puntos ya no viven en una columna: se derivan del progreso por academia.
 * Se leen como los leería la app — por `ranking_de_comunidad`, con la sesión
 * del propio alumno (la función exige pertenecer; el service role no tiene
 * `auth.uid()` y vería vacío).
 */
async function puntosDe(usuarioId: string): Promise<number> {
  const { data } = await e.alumnoA.cliente.rpc("ranking_de_comunidad", {
    p_comunidad: e.comunidadA,
    p_desde: null,
    p_curso: null,
  });
  const fila = ((data ?? []) as { usuario_id: string; puntos: number }[]).find(
    (r) => r.usuario_id === usuarioId
  );
  return fila?.puntos ?? 0;
}

test("completar una leccion suma 10 puntos", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, false); // punto de partida limpio
  const antes = await puntosDe(e.alumnoA.id);

  await marcarLeccion(e.alumnoA.cliente, leccionId, true);
  expect(await puntosDe(e.alumnoA.id)).toBe(antes + 10);
});

test("desmarcarla los resta", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);
  const conPuntos = await puntosDe(e.alumnoA.id);

  await marcarLeccion(e.alumnoA.cliente, leccionId, false);
  expect(await puntosDe(e.alumnoA.id)).toBe(conPuntos - 10);
});

test("borrar una leccion ajusta los puntos de quien la habia completado", async () => {
  // El caso que se olvida siempre: el progreso cae por cascada, y los puntos
  // se quedarian inflados si el trigger no cubriera tambien el DELETE.
  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M2", orden: 2 })
    .select("id")
    .single();
  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L2", orden: 1 })
    .select("id")
    .single();

  await marcarLeccion(e.alumnoA.cliente, lec!.id, true);
  const conPuntos = await puntosDe(e.alumnoA.id);

  await admin.from("lecciones").delete().eq("id", lec!.id);
  expect(await puntosDe(e.alumnoA.id)).toBe(conPuntos - 10);
});

test("el ranking de un periodo excluye lo anterior a su fecha", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  // Se envejece la fila para que caiga fuera de la ventana pedida. Sin fechas
  // reales, los rankings por periodo eran una proporcion inventada.
  await admin
    .from("progreso")
    .update({ completada_el: "2026-07-01T00:00:00Z" })
    .eq("usuario_id", e.alumnoA.id)
    .eq("leccion_id", leccionId);

  const { data } = await e.alumnoA.cliente.rpc("ranking_de_comunidad", {
    p_comunidad: e.comunidadA,
    p_desde: "2026-08-01T00:00:00Z",
  });
  const mio = (data ?? []).find(
    (r: { usuario_id: string }) => r.usuario_id === e.alumnoA.id
  );
  expect(mio?.puntos ?? 0).toBe(0);
});

test("sin fecha, el ranking cuenta todo", async () => {
  const { data } = await e.alumnoA.cliente.rpc("ranking_de_comunidad", {
    p_comunidad: e.comunidadA,
    p_desde: null,
  });
  const mio = (data ?? []).find(
    (r: { usuario_id: string }) => r.usuario_id === e.alumnoA.id
  );
  expect(mio?.puntos).toBeGreaterThan(0);
});

test("un alumno de otra empresa recibe vacio", async () => {
  const { data } = await e.alumnoB.cliente.rpc("ranking_de_comunidad", {
    p_comunidad: e.comunidadA,
    p_desde: null,
  });
  expect(data ?? []).toEqual([]);
});

test("los puntos de una academia no abren candados de nivel en otra", async () => {
  // alumnoA con puntos de sobra en A...
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  // ...entra tambien en la academia B, con acceso a su curso.
  await admin.from("inscripciones").insert({
    usuario_id: e.alumnoA.id,
    comunidad_id: e.comunidadB,
    estado: "activo",
    todos_los_cursos: true,
  });
  const { data: modB } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoB, titulo: "MB", orden: 1 })
    .select("id")
    .single();
  const { data: lecB } = await admin
    .from("lecciones")
    .insert({ modulo_id: modB!.id, titulo: "LB", orden: 1 })
    .select("id")
    .single();

  // El curso B exige nivel 2 (20 puntos). En B tiene cero: cerrado, por muchos
  // puntos que tenga en A.
  await admin.from("cursos").update({ nivel_requerido: 2 }).eq("id", e.cursoB);
  const { data: cerradas } = await e.alumnoA.cliente
    .from("lecciones")
    .select("id")
    .eq("id", lecB!.id);
  expect((cerradas ?? []).length).toBe(0);

  // Con dos clases completadas EN B (20 puntos alli), el candado abre.
  const { data: lecB2 } = await admin
    .from("lecciones")
    .insert({ modulo_id: modB!.id, titulo: "LB2", orden: 2 })
    .select("id")
    .single();
  await admin.from("progreso").insert([
    { usuario_id: e.alumnoA.id, leccion_id: lecB!.id },
    { usuario_id: e.alumnoA.id, leccion_id: lecB2!.id },
  ]);
  const { data: abiertas } = await e.alumnoA.cliente
    .from("lecciones")
    .select("id")
    .eq("id", lecB!.id);
  expect((abiertas ?? []).length).toBe(1);
});
