import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * El directorio de miembros de un módulo.
 *
 * Existe por un fallo que las otras 149 pruebas no podían ver: el directorio
 * leía `inscripciones`, cuya política solo enseña la fila propia y las de la
 * academia que administras. Las pruebas de aislamiento confirmaban justo eso
 * —que un alumno NO ve las inscripciones ajenas— y pasaban. Nadie preguntaba
 * si la pantalla que las usaba seguía sirviendo para algo.
 *
 * Por eso aquí se pregunta por la pantalla y no por la tabla: cuántas personas
 * ve un alumno, no qué filas le deja leer RLS.
 */

let e: Escenario;
let companero: { id: string; cliente: import("@supabase/supabase-js").SupabaseClient };
let suspendido: { id: string; cliente: import("@supabase/supabase-js").SupabaseClient };

async function inscribir(usuario: string, comunidad: string, curso: string, estado: string) {
  const { data, error } = await admin
    .from("inscripciones")
    .insert({ usuario_id: usuario, comunidad_id: comunidad, estado, todos_los_cursos: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await admin
    .from("inscripcion_cursos")
    .insert({ inscripcion_id: data.id, curso_id: curso });
  if (e2) throw new Error(e2.message);
}

/** Los nombres del directorio, ordenados, para comparar sin depender del orden. */
async function directorio(
  cliente: import("@supabase/supabase-js").SupabaseClient,
  curso: string
): Promise<string[]> {
  const { data, error } = await cliente.rpc("miembros_del_curso", { p_curso: curso });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { nombre: string }[]).map((f) => f.nombre).sort();
}

beforeAll(async () => {
  e = await montarEscenario("directorio");

  companero = await comoUsuario("companero-directorio@prueba.klaze");
  suspendido = await comoUsuario("suspendido-directorio@prueba.klaze");

  await inscribir(companero.id, e.comunidadA, e.cursoAPublicado, "activo");
  await inscribir(suspendido.id, e.comunidadA, e.cursoAPublicado, "suspendido");

  // Nombres para distinguirlos: el directorio devuelve perfiles, no correos.
  await admin.from("perfiles").update({ nombre: "Alumna A" }).eq("id", e.alumnoA.id);
  await admin.from("perfiles").update({ nombre: "Companero" }).eq("id", companero.id);
  await admin.from("perfiles").update({ nombre: "Suspendido" }).eq("id", suspendido.id);
});

afterAll(async () => {
  await desmontar(e);
  await limpiarUsuarios([companero.id, suspendido.id]);
});

test("un alumno ve a sus companeros, no solo a si mismo", async () => {
  // La prueba del fallo original: aqui salia ["Alumna A"] y nada mas.
  expect(await directorio(e.alumnoA.cliente, e.cursoAPublicado)).toEqual([
    "Alumna A",
    "Companero",
  ]);
});

test("un suspendido desaparece del directorio", async () => {
  const nombres = await directorio(e.alumnoA.cliente, e.cursoAPublicado);
  expect(nombres).not.toContain("Suspendido");
});

test("no lista a quien no tiene acceso a ESE modulo", async () => {
  // `cursoASinAcceso` es de la misma academia y esta publicado: nadie lo compro.
  expect(await directorio(e.duenoA.cliente, e.cursoASinAcceso)).toEqual([]);
});

test("un alumno de otra empresa no lista este directorio ni con el id a mano", async () => {
  expect(await directorio(e.alumnoB.cliente, e.cursoAPublicado)).toEqual([]);
});

test("el dueno ve el directorio de sus modulos sin estar inscrito", async () => {
  expect(await directorio(e.duenoA.cliente, e.cursoAPublicado)).toEqual([
    "Alumna A",
    "Companero",
  ]);
});

test("el directorio no lleva el correo de nadie", async () => {
  const { data } = await e.alumnoA.cliente.rpc("miembros_del_curso", {
    p_curso: e.cursoAPublicado,
  });
  const fila = (data as Record<string, unknown>[])[0];
  // Columnas fijas: no hay forma de pedirle el correo porque no lo devuelve.
  // `alias` es lo de delante de la arroba, para poder firmar a quien no puso
  // nombre; el dominio no sale, asi que no es una direccion.
  expect(Object.keys(fila).sort()).toEqual([
    "alias",
    "avatar_url",
    "bio",
    "creado_el",
    "nombre",
    "puntos",
    "usuario_id",
  ]);
});

test("un borrador no tiene directorio ni para quien lo compro", async () => {
  // `alumnoA` tiene acceso a `cursoABorrador` en el escenario, a proposito.
  expect(await directorio(e.alumnoA.cliente, e.cursoABorrador)).toEqual([]);
});
