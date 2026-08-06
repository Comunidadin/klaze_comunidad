import { expect, test, beforeAll, afterAll } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { crearInvitaciones } from "../../src/lib/supabase/invitaciones";

const BASE = "http://localhost:3000";

let e: Escenario;
let hayServidor = false;

beforeAll(async () => {
  // `r.ok` y no solo "respondió": un servidor a medio arrancar o roto devuelve
  // 500, y darlo por bueno hacía que estas pruebas fallaran culpando al código
  // en vez de al servidor.
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!hayServidor) return;
  e = await montarEscenario("apiinv");
});

afterAll(async () => {
  if (hayServidor) await desmontar(e);
});

async function tokenDe(cliente: SupabaseClient): Promise<string> {
  const { data } = await cliente.auth.getSession();
  return data.session!.access_token;
}

/**
 * Estas pruebas van contra el servidor de desarrollo porque el Route Handler
 * solo existe ahí. Si no está levantado se saltan con un aviso, en vez de
 * fallar de forma que parezca un fallo del código.
 */
test("sin sesion, rechaza", async () => {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return;
  }

  const r = await fetch(`${BASE}/api/invitaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      comunidadId: e.comunidadA,
      email: "x@prueba.klaze",
      token: "loquesea",
    }),
  });

  expect(r.status).toBe(401);
});

test("rechaza a quien no es dueno de esa comunidad", async () => {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return;
  }

  const [inv] = await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["victima@prueba.klaze"],
    "todos"
  );

  // El alumno de A pide que se envie una invitacion de la comunidad A. Aqui
  // RLS no protege nada: el handler usa la clave secreta. Si esta prueba se
  // pone roja, cualquiera con sesion puede invitar a tu academia.
  const r = await fetch(`${BASE}/api/invitaciones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await tokenDe(e.alumnoA.cliente)}`,
    },
    body: JSON.stringify({
      comunidadId: e.comunidadA,
      email: "victima@prueba.klaze",
      token: inv.token,
    }),
  });

  expect(r.status).toBe(403);
});

test("el dueno de B tampoco puede invitar a la academia de A", async () => {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return;
  }

  const [inv] = await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["otra-victima@prueba.klaze"],
    "todos"
  );

  const r = await fetch(`${BASE}/api/invitaciones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await tokenDe(e.duenoB.cliente)}`,
    },
    body: JSON.stringify({
      comunidadId: e.comunidadA,
      email: "otra-victima@prueba.klaze",
      token: inv.token,
    }),
  });

  expect(r.status).toBe(403);
});

test("faltan datos, responde 400", async () => {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return;
  }

  const r = await fetch(`${BASE}/api/invitaciones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await tokenDe(e.duenoA.cliente)}`,
    },
    body: JSON.stringify({ comunidadId: e.comunidadA }),
  });

  expect(r.status).toBe(400);
});
