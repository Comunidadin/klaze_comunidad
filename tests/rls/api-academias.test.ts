import { expect, test, beforeAll, afterAll } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

const BASE = "http://localhost:3000";
const SLUG = "alta-prueba-api";
const EMAIL = "alta-api@prueba.klaze";

let e: Escenario;
let hayServidor = false;

beforeAll(async () => {
  // `r.ok` y no solo "respondió": un servidor a medio arrancar devuelve 500, y
  // darlo por bueno hacía que estas pruebas fallaran culpando al código.
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!hayServidor) return;
  e = await montarEscenario("apiacad");
});

afterAll(async () => {
  if (!hayServidor) return;
  // La academia que crean estas pruebas no cuelga del escenario: se limpia
  // aparte, y ANTES de la cuenta, porque `propietario_id` es ON DELETE RESTRICT.
  await admin.from("comunidades").delete().eq("slug", SLUG);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const creado = data?.users?.find((u) => u.email?.toLowerCase() === EMAIL);
  if (creado) await admin.auth.admin.deleteUser(creado.id);
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

async function alta(token: string | null, cuerpo: unknown) {
  return fetch(`${BASE}/api/academias`, {
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
  const r = await alta(null, { email: EMAIL, empresa: "X", slug: SLUG });
  expect(r.status).toBe(401);
});

test("un creador no puede dar de alta academias", async () => {
  if (saltar()) return;
  // Si esta prueba se pone roja, cualquier creador con sesion puede fabricarse
  // academias y cuentas a voluntad. Aqui RLS no protege nada: el handler usa
  // la clave secreta.
  const r = await alta(await tokenDe(e.duenoA.cliente), {
    email: EMAIL,
    empresa: "X",
    slug: SLUG,
  });
  expect(r.status).toBe(403);

  const { data } = await admin.from("comunidades").select("id").eq("slug", SLUG);
  expect(data ?? []).toEqual([]);
});

test("un alumno tampoco", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.alumnoA.cliente), {
    email: EMAIL,
    empresa: "X",
    slug: SLUG,
  });
  expect(r.status).toBe(403);
});

test("faltan datos, responde 400", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.superadmin.cliente), { email: EMAIL });
  expect(r.status).toBe(400);
});

test("un slug con mayusculas o espacios se rechaza", async () => {
  if (saltar()) return;
  // El slug va en la URL de todos sus alumnos: si entra mal, el enlace se
  // rompe y renombrarlo despues deja fuera a quien lo tuviera guardado.
  const r = await alta(await tokenDe(e.superadmin.cliente), {
    email: EMAIL,
    empresa: "X",
    slug: "Mi Empresa",
  });
  expect(r.status).toBe(400);
});

test("el superadmin da de alta y la contrasena temporal sirve para entrar", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.superadmin.cliente), {
    email: EMAIL,
    empresa: "Empresa de Prueba",
    slug: SLUG,
  });
  expect(r.ok).toBe(true);

  const cuerpo = await r.json();
  expect(cuerpo.yaExistia).toBe(false);
  expect(typeof cuerpo.passwordTemporal).toBe("string");

  const { data } = await admin
    .from("comunidades")
    .select("id, nombre, propietario_id")
    .eq("slug", SLUG)
    .maybeSingle();
  expect(data?.nombre).toBe("Empresa de Prueba");
  expect(data?.propietario_id).toBe(cuerpo.usuarioId);

  // Lo que de verdad importa: que esa contrasena abra la puerta. Si no, la
  // pantalla ensena algo que no sirve y el creador se queda fuera.
  const suyo = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await suyo.auth.signInWithPassword({
    email: EMAIL,
    password: cuerpo.passwordTemporal,
  });
  expect(error).toBeNull();
});

test("repetir el mismo slug no duplica", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.superadmin.cliente), {
    email: EMAIL,
    empresa: "Otro nombre",
    slug: SLUG,
  });
  expect(r.ok).toBe(true);

  const cuerpo = await r.json();
  expect(cuerpo.yaExistia).toBe(true);
  expect(cuerpo.passwordTemporal).toBeNull();

  const { data } = await admin.from("comunidades").select("id").eq("slug", SLUG);
  expect(data ?? []).toHaveLength(1);
});
