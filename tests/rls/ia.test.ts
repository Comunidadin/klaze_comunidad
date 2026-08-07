import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * El contador de preguntas es lo unico que separa una factura previsible de una
 * sorpresa: la clave de OpenAI la paga el dueno de la plataforma para todas las
 * academias.
 */

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("ia");
});

afterAll(async () => {
  await admin.from("uso_ia").delete().in("usuario_id", [e.alumnoA.id, e.alumnoB.id]);
  await desmontar(e);
});

test("un alumno NO puede escribir su propio contador", async () => {
  // Si pudiera, se pondria a cero y preguntaria sin limite. Por eso `uso_ia`
  // no tiene politica de escritura: solo escribe el Route Handler con la clave
  // secreta.
  const { data } = await e.alumnoA.cliente
    .from("uso_ia")
    .insert({ usuario_id: e.alumnoA.id, dia: "2026-08-07", preguntas: 0 })
    .select();
  expect(data ?? []).toEqual([]);
});

test("tampoco puede bajarlo despues de gastarlo", async () => {
  await admin
    .from("uso_ia")
    .upsert({ usuario_id: e.alumnoA.id, dia: "2026-08-07", preguntas: 20 });

  const { data } = await e.alumnoA.cliente
    .from("uso_ia")
    .update({ preguntas: 0 })
    .eq("usuario_id", e.alumnoA.id)
    .select();
  expect(data ?? []).toEqual([]);

  // Y sigue a 20: el update no paso.
  const { data: real } = await admin
    .from("uso_ia")
    .select("preguntas")
    .eq("usuario_id", e.alumnoA.id)
    .eq("dia", "2026-08-07")
    .single();
  expect(real?.preguntas).toBe(20);
});

test("cada cual lee solo su propio uso", async () => {
  const { data: elSuyo } = await e.alumnoA.cliente
    .from("uso_ia")
    .select("preguntas")
    .eq("usuario_id", e.alumnoA.id);
  expect((elSuyo ?? []).length).toBeGreaterThan(0);

  const { data: elAjeno } = await e.alumnoB.cliente
    .from("uso_ia")
    .select("preguntas")
    .eq("usuario_id", e.alumnoA.id);
  expect(elAjeno ?? []).toEqual([]);
});
