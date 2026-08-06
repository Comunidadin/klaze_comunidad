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
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1, tipo: "texto" })
    .select("id")
    .single();
  leccionId = lec!.id;
});

afterAll(async () => {
  await desmontar(e);
});

async function puntosDe(usuarioId: string): Promise<number> {
  const { data } = await admin
    .from("perfiles")
    .select("puntos")
    .eq("id", usuarioId)
    .single();
  return data!.puntos;
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
    .insert({ modulo_id: mod!.id, titulo: "L2", orden: 1, tipo: "texto" })
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
