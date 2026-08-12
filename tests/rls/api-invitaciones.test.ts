import { expect, test, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";
import type { SupabaseClient } from "@supabase/supabase-js";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { crearInvitaciones } from "../../src/lib/supabase/invitaciones";
import { TOPES } from "../../src/lib/limites";

const BASE = "http://localhost:3000";

let e: Escenario;
let hayServidor = false;

const sql = new SQL(process.env.SUPABASE_DB_URL!, { max: 1 });

async function usosDe(comunidadId: string): Promise<number> {
  const filas = await sql`
    select usos from public.limites_uso
    where ambito = 'invitaciones' and clave = ${comunidadId} and dia = current_date
  `;
  return filas[0]?.usos ?? 0;
}

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
  if (hayServidor) {
    await sql`delete from public.limites_uso where ambito = 'invitaciones'`;
    await desmontar(e);
  }
  await sql.end();
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

test("un extrano no gasta el cupo de una academia ajena", async () => {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return;
  }

  // El orden dentro del handler es lo que se prueba: primero "¿es tuya?" y
  // solo despues "¿te queda cupo?". Al reves, cualquiera con sesion podria
  // agotar el cupo de una academia ajena con solo conocer su id --- y el freno
  // al abuso seria la herramienta del abuso.
  await sql`delete from public.limites_uso where ambito = 'invitaciones'`;

  const [inv] = await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["cupo-ajeno@prueba.klaze"],
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
      email: "cupo-ajeno@prueba.klaze",
      token: inv.token,
    }),
  });

  expect(r.status).toBe(403);
  expect(await usosDe(e.comunidadA)).toBe(0);
});

test("pasado el tope diario, responde 429 y lo dice", async () => {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return;
  }

  // Sin tope, un creador legitimo puede mandar correo masivo desde TU dominio
  // verificado en Resend y fabricar miles de cuentas de Supabase a tu costa.
  // Las denuncias de spam llegan a tu remitente, no al suyo.
  //
  // El contador se deja en el tope en vez de mandar 50 invitaciones de verdad:
  // eso crearia 50 cuentas reales, que es exactamente el problema del que trata
  // esta prueba.
  await sql`
    insert into public.limites_uso (ambito, clave, dia, usos)
    values ('invitaciones', ${e.comunidadA}, current_date, ${TOPES.invitaciones})
    on conflict (ambito, clave, dia) do update set usos = ${TOPES.invitaciones}
  `;

  const [inv] = await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["pasado-el-tope@prueba.klaze"],
    "todos"
  );

  const r = await fetch(`${BASE}/api/invitaciones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await tokenDe(e.duenoA.cliente)}`,
    },
    body: JSON.stringify({
      comunidadId: e.comunidadA,
      email: "pasado-el-tope@prueba.klaze",
      token: inv.token,
    }),
  });

  expect(r.status).toBe(429);
  // Aqui SI se explica, al contrario que en `/api/recuperar`: quien llama es
  // el dueno autenticado de esta academia, asi que no hay nada que ocultarle.
  const cuerpo = (await r.json()) as { error?: string };
  expect(cuerpo.error).toContain(String(TOPES.invitaciones));

  await sql`delete from public.limites_uso where ambito = 'invitaciones'`;
});
