import { expect, test, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * El goteo, comprobado donde importa: en la base.
 *
 * El candado por nivel vivia solo en el navegador y por eso no protegia nada
 * --- un alumno pedia la clase por su id y Postgres se la daba. Estas pruebas
 * existen para que al goteo no le pase lo mismo: cada una pide el contenido POR
 * SU ID con la sesion del alumno, que es lo que haria alguien con las
 * herramientas del navegador abiertas.
 */
const sql = new SQL(process.env.SUPABASE_DB_URL!, { max: 1 });

let e: Escenario;
let submoduloId: string;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("goteo");

  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "Submodulo", orden: 1, publicado: true })
    .select("id")
    .single();
  submoduloId = mod!.id;

  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: submoduloId, titulo: "Clase", orden: 1 })
    .select("id")
    .single();
  leccionId = lec!.id;
});

afterAll(async () => {
  await sql.end();
  await desmontar(e);
});

/** Deja el modulo sin goteo, que es el estado por defecto. */
async function sinGoteo() {
  await admin
    .from("cursos")
    .update({ goteo_modo: "ninguno", goteo_dias: null, goteo_desde: null })
    .eq("id", e.cursoAPublicado);
}

/** Mueve la fecha de entrada del alumno A para simular antiguedad. */
async function entroHace(dias: number) {
  await sql`
    update public.inscripciones
       set creado_el = now() - make_interval(days => ${dias})
     where usuario_id = ${e.alumnoA.id} and comunidad_id = ${e.comunidadA}
  `;
}

/** Lo que el alumno A saca de la base pidiendolo POR SU ID. */
async function loQueVeElAlumno() {
  const { data: submodulos } = await e.alumnoA.cliente
    .from("modulos").select("id").eq("id", submoduloId);
  const { data: clases } = await e.alumnoA.cliente
    .from("lecciones").select("id").eq("id", leccionId);
  const { data: modulo } = await e.alumnoA.cliente
    .from("cursos").select("id").eq("id", e.cursoAPublicado);
  return {
    submodulos: (submodulos ?? []).length,
    clases: (clases ?? []).length,
    modulo: (modulo ?? []).length,
  };
}

test("G1. con el plazo pendiente no salen ni los submodulos ni las clases", async () => {
  await entroHace(2);
  await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: 7, goteo_desde: null })
    .eq("id", e.cursoAPublicado);

  const visto = await loQueVeElAlumno();
  expect(visto.submodulos).toBe(0);
  expect(visto.clases).toBe(0);
});

test("G2. pero la fila del modulo SI se sigue viendo", async () => {
  // Contraintuitivo y a proposito: sin ella el alumno no ve "se abre el
  // martes", ve que el modulo no existe. Es la misma division que ya hay entre
  // `inscrito_en` (ves la fila) y `pertenece_a` (ves el contenido).
  await entroHace(2);
  await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: 7, goteo_desde: null })
    .eq("id", e.cursoAPublicado);

  const visto = await loQueVeElAlumno();
  expect(visto.modulo).toBe(1);
});

test("G3. cumplido el plazo, sale todo", async () => {
  // Una regla que ademas rompe el caso bueno no es una regla, es una averia.
  await entroHace(30);
  await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: 7, goteo_desde: null })
    .eq("id", e.cursoAPublicado);

  const visto = await loQueVeElAlumno();
  expect(visto.submodulos).toBe(1);
  expect(visto.clases).toBe(1);
});

test("G4. modo fecha: antes no, despues si", async () => {
  await admin
    .from("cursos")
    .update({
      goteo_modo: "fecha",
      goteo_dias: null,
      goteo_desde: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq("id", e.cursoAPublicado);
  expect((await loQueVeElAlumno()).clases).toBe(0);

  await admin
    .from("cursos")
    .update({ goteo_desde: new Date(Date.now() - 86_400_000).toISOString() })
    .eq("id", e.cursoAPublicado);
  expect((await loQueVeElAlumno()).clases).toBe(1);
});

test("G5. el dueno lo ve siempre, tambien con el plazo pendiente", async () => {
  // Si se rompe, un creador no puede preparar su temario antes de que abra.
  await admin
    .from("cursos")
    .update({
      goteo_modo: "fecha",
      goteo_dias: null,
      goteo_desde: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq("id", e.cursoAPublicado);

  const { data } = await e.duenoA.cliente.from("lecciones").select("id").eq("id", leccionId);
  expect((data ?? []).length).toBe(1);
});

test("G6. el candado por nivel ahora tambien corta en la base", async () => {
  // Hasta hoy `nivel_requerido` se aplicaba SOLO en `use-courses.ts`: un alumno
  // por debajo del nivel pedia la clase por su id y la base se la entregaba.
  await sinGoteo();
  await admin.from("perfiles").update({ puntos: 0 }).eq("id", e.alumnoA.id);
  await admin.from("cursos").update({ nivel_requerido: 5 }).eq("id", e.cursoAPublicado);

  expect((await loQueVeElAlumno()).clases).toBe(0);

  await admin.from("cursos").update({ nivel_requerido: null }).eq("id", e.cursoAPublicado);
  expect((await loQueVeElAlumno()).clases).toBe(1);
});

test("G7. las clases de un submodulo en borrador ya no salen", async () => {
  // El fallo que aparecio explorando: `lecciones` no comprobaba `m.publicado`,
  // asi que el submodulo se escondia y sus clases no.
  await sinGoteo();
  await admin.from("modulos").update({ publicado: false }).eq("id", submoduloId);

  const visto = await loQueVeElAlumno();
  expect(visto.submodulos).toBe(0);
  expect(visto.clases).toBe(0);

  await admin.from("modulos").update({ publicado: true }).eq("id", submoduloId);
});

test("G8. los umbrales de nivel dicen lo mismo en Postgres y en TypeScript", async () => {
  // Los umbrales existen en dos sitios: `NIVEL_UMBRALES` y el array dentro de
  // `privado.nivel_por_puntos`. Esta prueba es lo unico que impide que se
  // separen sin que nadie se entere.
  const { nivelPorPuntos } = await import("../../src/lib/levels");

  for (const puntos of [-50, -1, 0, 1, 19, 20, 64, 65, 154, 155, 814, 1715, 99_999]) {
    const [f] = await sql`select privado.nivel_por_puntos(${puntos}) as n`;
    expect(f.n).toBe(nivelPorPuntos(puntos));
  }
});

test("G9. la base rechaza una configuracion de goteo a medias", async () => {
  const { error } = await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: null, goteo_desde: null })
    .eq("id", e.cursoAPublicado);
  expect(error?.message ?? "").toContain("cursos_goteo_coherente");

  await sinGoteo();
});
