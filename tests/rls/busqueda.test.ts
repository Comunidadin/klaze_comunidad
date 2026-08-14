import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * `buscar_en_comunidad` es `security invoker`: las politicas deciden que
 * aparece. Estas pruebas cubren lo que la hace distinta de un ilike a pelo —
 * palabras en cualquier orden, sin acentos — y que no cruza academias.
 */

let e: Escenario;

async function buscar(cliente: Escenario["alumnoA"]["cliente"], comunidad: string, q: string) {
  const { data, error } = await cliente.rpc("buscar_en_comunidad", {
    p_comunidad: comunidad,
    p_q: q,
  });
  expect(error).toBeNull();
  return (data ?? []) as { tipo: string; titulo: string }[];
}

beforeAll(async () => {
  e = await montarEscenario("busca");

  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1 })
    .select("id").single();
  await admin.from("lecciones").insert({
    modulo_id: mod!.id, titulo: "Cómo usar la comunidad", orden: 1,
  });
});

afterAll(async () => {
  await desmontar(e);
});

test("encuentra por palabras sueltas, sin el orden ni la frase exacta", async () => {
  const filas = await buscar(e.alumnoA.cliente, e.comunidadA, "comunidad usar");
  expect(filas.some((f) => f.tipo === "clase" && f.titulo === "Cómo usar la comunidad")).toBe(true);
});

test("ignora los acentos en ambas direcciones", async () => {
  const filas = await buscar(e.alumnoA.cliente, e.comunidadA, "como");
  expect(filas.some((f) => f.titulo === "Cómo usar la comunidad")).toBe(true);
});

test("si falta una de las palabras, no hay resultado", async () => {
  const filas = await buscar(e.alumnoA.cliente, e.comunidadA, "usar cohetes");
  expect(filas.filter((f) => f.tipo === "clase")).toEqual([]);
});

test("un alumno de otra academia no ve nada al buscar aqui", async () => {
  const filas = await buscar(e.alumnoB.cliente, e.comunidadA, "comunidad");
  expect(filas).toEqual([]);
});

test("los comodines del LIKE son texto, no comodines", async () => {
  const filas = await buscar(e.alumnoA.cliente, e.comunidadA, "co%unidad");
  expect(filas.filter((f) => f.tipo === "clase")).toEqual([]);
});
