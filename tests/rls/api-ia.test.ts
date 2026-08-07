import { expect, test, beforeAll, afterAll } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

const BASE = "http://localhost:3000";

let e: Escenario;
let hayServidor = false;
let leccionConIA = "";
let leccionSinIA = "";

beforeAll(async () => {
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!hayServidor) return;

  e = await montarEscenario("apiia");

  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1, publicado: true })
    .select("id")
    .single();

  const { data: con } = await admin
    .from("lecciones")
    .insert({
      modulo_id: mod!.id,
      titulo: "Con asistente",
      orden: 1,
      ia_habilitada: true,
      ia_contexto: "El cielo de este curso es de color verde.",
    })
    .select("id")
    .single();
  leccionConIA = con!.id;

  const { data: sin } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "Sin asistente", orden: 2, ia_habilitada: false })
    .select("id")
    .single();
  leccionSinIA = sin!.id;
});

afterAll(async () => {
  if (!hayServidor) return;
  await admin.from("uso_ia").delete().in("usuario_id", [e.alumnoA.id, e.alumnoB.id]);
  await desmontar(e);
});

async function tokenDe(cliente: SupabaseClient): Promise<string> {
  const { data } = await cliente.auth.getSession();
  return data.session!.access_token;
}

function saltar(): boolean {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return true;
  }
  return false;
}

async function preguntar(token: string | null, cuerpo: unknown) {
  return fetch(`${BASE}/api/ia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
}

test("sin sesion, rechaza", async () => {
  if (saltar()) return;
  const r = await preguntar(null, { leccionId: leccionConIA, pregunta: "hola" });
  expect(r.status).toBe(401);
});

test("un alumno de OTRA academia no puede preguntar por esta clase", async () => {
  if (saltar()) return;

  // La comprobacion de acceso la hace RLS con la sesion del alumno, no una
  // condicion escrita a mano en el handler. Si esta prueba se pone roja,
  // cualquiera con cuenta puede leer el material de academias ajenas ---
  // y gastar la clave de OpenAI del dueno de la plataforma.
  const r = await preguntar(await tokenDe(e.alumnoB.cliente), {
    leccionId: leccionConIA,
    pregunta: "de que color es el cielo",
  });
  expect(r.status).toBe(403);

  // Y no se le cobro la pregunta: rechazar debe ser gratis.
  const { data } = await admin
    .from("uso_ia")
    .select("preguntas")
    .eq("usuario_id", e.alumnoB.id);
  expect(data ?? []).toEqual([]);
});

test("una clase con el asistente apagado responde 403", async () => {
  if (saltar()) return;
  const r = await preguntar(await tokenDe(e.alumnoA.cliente), {
    leccionId: leccionSinIA,
    pregunta: "hola",
  });
  expect(r.status).toBe(403);
});

test("faltan datos, responde 400", async () => {
  if (saltar()) return;
  const r = await preguntar(await tokenDe(e.alumnoA.cliente), { leccionId: leccionConIA });
  expect(r.status).toBe(400);
});

test("pasado el tope diario responde 429", async () => {
  if (saltar()) return;

  const hoy = new Date().toISOString().slice(0, 10);
  const tope = Number(process.env.IA_TOPE_DIARIO ?? 20);
  await admin
    .from("uso_ia")
    .upsert({ usuario_id: e.alumnoA.id, dia: hoy, preguntas: tope });

  const r = await preguntar(await tokenDe(e.alumnoA.cliente), {
    leccionId: leccionConIA,
    pregunta: "de que color es el cielo",
  });

  // Sin clave de OpenAI el servidor responde 503 ANTES de mirar el tope, y eso
  // es lo correcto: con el asistente apagado, decir "has agotado tus preguntas"
  // seria mentira. La prueba comprueba la realidad de cada configuracion en vez
  // de exigir una sola.
  if (!process.env.OPENAI_API_KEY) {
    expect(r.status).toBe(503);
    console.log("  (sin OPENAI_API_KEY: se comprueba el 503, no el tope)");
    return;
  }

  expect(r.status).toBe(429);
  const cuerpo = await r.json();
  expect(cuerpo.restantes).toBe(0);
});
