import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, limpiarUsuarios } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * El súper enlace: alguien compra Klaze y su academia se monta sola.
 *
 * Estas pruebas preguntan lo que preguntaría quien acaba de pagar: ¿existe mi
 * academia, entro yo, y cuando dejo de pagar mis alumnos ven que está
 * suspendida en vez de que no existe?
 *
 * Se saltan si el servidor de desarrollo no está levantado, en vez de fallar de
 * forma que parezca un fallo del código.
 */

const BASE = "http://localhost:3000";
const CREADOR = "creador-apiplat@prueba.klaze";
const SEGUNDO = "segundo-apiplat@prueba.klaze";

let e: Escenario;
let hayServidor = false;
let token: string;
let tokenAcademia: string;
let canalId: string;
const slugsCreados: string[] = [];

async function idDe(email: string): Promise<string | null> {
  const { data } = await admin.rpc("perfil_por_email", { p_email: email });
  return (data as string | null) ?? null;
}

async function academiasDe(email: string) {
  const id = await idDe(email);
  if (!id) return [];
  const { data } = await admin
    .from("comunidades")
    .select("slug, nombre, estado, plan_id")
    .eq("propietario_id", id);
  return data ?? [];
}

/** Borra al creador y, antes, la academia que posea — el FK es RESTRICT. */
async function borrarCreador(email: string) {
  const id = await idDe(email);
  if (!id) return;
  await admin.from("comunidades").delete().eq("propietario_id", id);
  await limpiarUsuarios([id]);
}

const json = (cuerpo: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
});

beforeAll(async () => {
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!hayServidor) return;

  e = await montarEscenario("apiplat");
  await borrarCreador(CREADOR);
  await borrarCreador(SEGUNDO);

  const { data, error } = await admin
    .from("canales_venta")
    .insert({ tipo: "plataforma", nombre: "Plan Pro", plan_id: "pro" })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);
  token = data.token;
  canalId = data.id;

  // Uno de academia, para comprobar que los tipos no se cruzan.
  const { data: otro, error: e2 } = await admin
    .from("canales_venta")
    .insert({ tipo: "academia", comunidad_id: e.comunidadA, nombre: "Oferta" })
    .select("token")
    .single();
  if (e2) throw new Error(e2.message);
  tokenAcademia = otro.token;
});

afterAll(async () => {
  if (!hayServidor) return;
  await borrarCreador(CREADOR);
  await borrarCreador(SEGUNDO);
  if (slugsCreados.length > 0) {
    await admin.from("comunidades").delete().in("slug", slugsCreados);
  }
  await admin.from("canales_venta").delete().eq("id", canalId);
  await desmontar(e);
});

function saltada(): boolean {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return true;
  }
  return false;
}

test("un token inexistente no dice ni que no existe", async () => {
  if (saltada()) return;
  const r = await fetch(`${BASE}/api/plataforma/nodeberiaexistir`, json({ email: CREADOR }));
  expect(r.status).toBe(404);
});

test("un token de academia no sirve para crear academias", async () => {
  if (saltada()) return;
  // Sin filtrar por tipo, cualquier creador podria regalarse academias con el
  // token de su propio enlace de compra.
  const r = await fetch(`${BASE}/api/plataforma/${tokenAcademia}`, json({ email: CREADOR }));
  expect(r.status).toBe(404);
});

test("y el super enlace tampoco sirve para inscribir alumnos", async () => {
  if (saltada()) return;
  const r = await fetch(`${BASE}/api/compras/${token}`, json({ email: CREADOR }));
  expect(r.status).toBe(404);
});

test("una compra monta la academia entera", async () => {
  if (saltada()) return;

  const r = await fetch(
    `${BASE}/api/plataforma/${token}`,
    json({ email: CREADOR, empresa: "Mentoría Pro 2026!" })
  );
  expect(r.status).toBe(200);

  const cuerpo = await r.json();
  expect(cuerpo.ok).toBe(true);
  // El identificador sale del nombre de la empresa, sin acentos ni simbolos.
  expect(cuerpo.slug).toBe("mentoria-pro-2026");
  slugsCreados.push(cuerpo.slug);

  const academias = await academiasDe(CREADOR);
  expect(academias.length).toBe(1);
  expect(academias[0].nombre).toBe("Mentoría Pro 2026!");
  expect(academias[0].estado).toBe("activa");
  // El plan lo decide el enlace, no el formulario.
  expect(academias[0].plan_id).toBe("pro");
});

test("el creador queda con rol de creador y inscrito en lo suyo", async () => {
  if (saltada()) return;

  const id = await idDe(CREADOR);
  const { data: perfil } = await admin
    .from("perfiles")
    .select("rol")
    .eq("id", id as string)
    .single();
  expect(perfil?.rol).toBe("creador");

  // Sin esta inscripcion, "Ver como alumno" le enseña su academia vacia: el
  // contenido solo llega a quien tiene inscripcion, y ser el dueño no es una.
  const { data: inscripcion } = await admin
    .from("inscripciones")
    .select("estado, todos_los_cursos")
    .eq("usuario_id", id as string)
    .single();
  expect(inscripcion?.estado).toBe("activo");
  expect(inscripcion?.todos_los_cursos).toBe(true);
});

test("dos empresas con el mismo nombre no chocan", async () => {
  if (saltada()) return;

  const r = await fetch(
    `${BASE}/api/plataforma/${token}`,
    json({ email: SEGUNDO, empresa: "Mentoría Pro 2026!" })
  );
  expect(r.status).toBe(200);

  const cuerpo = await r.json();
  // `comunidades.slug` es unico: sin el sufijo, la segunda compra fallaria y
  // alguien se quedaria pagando sin academia.
  expect(cuerpo.slug).toBe("mentoria-pro-2026-2");
  slugsCreados.push(cuerpo.slug);
});

test("el mismo comprador no acaba con dos academias", async () => {
  if (saltada()) return;

  // Esta prueba encontro un fallo de verdad. `crearAcademia` es idempotente por
  // IDENTIFICADOR, y el identificador sale del nombre de la empresa: repetir la
  // compra sin ese campo —o escribiendolo distinto— daba una segunda academia
  // vacia, y sus alumnos se quedaban en la primera.
  //
  // Una compra por persona: quien vuelve a pagar renueva, no abre otra escuela.
  const r = await fetch(`${BASE}/api/plataforma/${token}`, json({ email: CREADOR }));
  expect(r.status).toBe(200);
  expect((await r.json()).slug).toBe("mentoria-pro-2026");

  const academias = await academiasDe(CREADOR);
  expect(academias.length).toBe(1);
});

test("la baja suspende su academia sin borrar nada", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/plataforma/${token}/baja`, json({ email: CREADOR }));
  expect(r.status).toBe(200);
  expect((await r.json()).ok).toBe(true);

  const academias = await academiasDe(CREADOR);
  expect(academias.length).toBe(1);
  // Suspendida y no borrada: detras hay cursos, publicaciones y el progreso de
  // sus alumnos. Y "suspendida" es lo que deja que la app diga eso en vez de
  // "academia no encontrada".
  expect(academias[0].estado).toBe("suspendida");
});

test("volver a pagar la reactiva", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/plataforma/${token}`, json({ email: CREADOR }));
  expect(r.status).toBe(200);

  const academias = await academiasDe(CREADOR);
  expect(academias[0].estado).toBe("activa");
});

test("una baja de quien no tiene academia no revienta", async () => {
  if (saltada()) return;

  // `alumnoa-apiplat` tiene cuenta pero no posee ninguna academia: es el caso
  // que distingue "no existe" de "no es dueño de nada".
  const r = await fetch(
    `${BASE}/api/plataforma/${token}/baja`,
    json({ email: "alumnoa-apiplat@prueba.klaze" })
  );
  expect(r.status).toBe(200);

  const cuerpo = await r.json();
  expect(cuerpo.ok).toBe(false);
  expect(cuerpo.motivo).toBe("sin_cuenta");
});

test("un cuerpo sin correo queda registrado y no crea nada", async () => {
  if (saltada()) return;

  const r = await fetch(`${BASE}/api/plataforma/${token}`, json({ plan: "pro" }));
  expect(r.status).toBe(200);
  expect((await r.json()).motivo).toBe("sin_email");

  const { data } = await admin
    .from("recepciones_canal")
    .select("resultado")
    .eq("canal_id", canalId)
    .eq("resultado", "sin_email");
  expect((data ?? []).length).toBeGreaterThan(0);
});
