import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * Suspender una academia tiene que revocar acceso real, no cambiar una
 * insignia. Es la misma regla que ya se aplico a los alumnos, un nivel mas
 * arriba: antes de esta migracion, el boton del superadmin no cerraba nada.
 *
 * El orden de estas pruebas importa: suspenden la academia A y la reactivan al
 * final. Bun ejecuta los `test` de un archivo en orden.
 */

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("susp");
});

afterAll(async () => {
  await desmontar(e);
});

async function estado(valor: "activa" | "suspendida") {
  const { error } = await admin
    .from("comunidades")
    .update({ estado: valor })
    .eq("id", e.comunidadA);
  if (error) throw new Error(error.message);
}

test("con la academia activa, el alumno ve su curso", async () => {
  const { data } = await e.alumnoA.cliente
    .from("cursos")
    .select("id")
    .eq("id", e.cursoAPublicado);
  expect(data ?? []).toHaveLength(1);
});

test("suspendida, el alumno pierde el curso", async () => {
  await estado("suspendida");
  const { data } = await e.alumnoA.cliente
    .from("cursos")
    .select("id")
    .eq("id", e.cursoAPublicado);
  expect(data ?? []).toEqual([]);
});

test("suspendida, el propio dueno pierde sus cursos", async () => {
  const { data } = await e.duenoA.cliente
    .from("cursos")
    .select("id")
    .eq("comunidad_id", e.comunidadA);
  expect(data ?? []).toEqual([]);
});

test("suspendida, ambos siguen leyendo la fila y su estado", async () => {
  // Es lo que permite decirles "tu academia esta suspendida" en vez de
  // ensenarles "Comunidad no encontrada". Si esta prueba se pone roja, la
  // suspension deja de cerrar la puerta y pasa a romperla.
  for (const quien of [e.alumnoA, e.duenoA]) {
    const { data } = await quien.cliente
      .from("comunidades")
      .select("id, estado")
      .eq("id", e.comunidadA)
      .maybeSingle();
    expect(data?.estado).toBe("suspendida");
  }
});

test("suspendida, el dueno tampoco puede editarla", async () => {
  const { data } = await e.duenoA.cliente
    .from("comunidades")
    .update({ nombre: "Renombrada" })
    .eq("id", e.comunidadA)
    .select("id");
  expect(data ?? []).toEqual([]);
});

test("el superadmin la sigue viendo y puede reactivarla", async () => {
  const { data: vista } = await e.superadmin.cliente
    .from("comunidades")
    .select("id, estado")
    .eq("id", e.comunidadA)
    .maybeSingle();
  expect(vista?.estado).toBe("suspendida");

  const { data } = await e.superadmin.cliente
    .from("comunidades")
    .update({ estado: "activa" })
    .eq("id", e.comunidadA)
    .select("id");
  expect(data ?? []).toHaveLength(1);
});

test("un creador no puede suspenderse a si mismo", async () => {
  // Si pudiera, se dejaria fuera sin forma de volver: reactivar es del
  // superadmin, y el creador ya no tendria permiso ni para eso.
  const { data } = await e.duenoA.cliente
    .from("comunidades")
    .update({ estado: "suspendida" })
    .eq("id", e.comunidadA)
    .select("id");
  expect(data ?? []).toEqual([]);
});

test("reactivada, alumno y dueno vuelven a entrar", async () => {
  const { data: delAlumno } = await e.alumnoA.cliente
    .from("cursos")
    .select("id")
    .eq("id", e.cursoAPublicado);
  expect(delAlumno ?? []).toHaveLength(1);

  const { data: delDueno } = await e.duenoA.cliente
    .from("cursos")
    .select("id")
    .eq("comunidad_id", e.comunidadA);
  expect((delDueno ?? []).length).toBeGreaterThan(0);
});
