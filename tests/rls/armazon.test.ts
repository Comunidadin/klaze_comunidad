import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { cargarArmazon } from "../../src/lib/supabase/consultas";

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("armazon");
  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "Modulo 1", orden: 1 })
    .select("id")
    .single();
  await admin.from("lecciones").insert({
    modulo_id: mod!.id,
    titulo: "Leccion 1",
    orden: 1,
    duracion_min: 12,
    bloques: [{ id: crypto.randomUUID(), tipo: "video", vimeoId: "123456789" }],
  });
});

afterAll(async () => {
  await desmontar(e);
});

test("el alumno recibe su comunidad y solo sus cursos", async () => {
  const armazon = await cargarArmazon(e.alumnoA.cliente);

  expect(armazon.comunidad?.id).toBe(e.comunidadA);
  const ids = armazon.cursos.map((c) => c.id);
  expect(ids).toContain(e.cursoAPublicado);
  expect(ids).not.toContain(e.cursoB);
  expect(ids).not.toContain(e.cursoABorrador);
});

test("un superadmin dueno de una academia recibe LA SUYA, no otra", async () => {
  // El fallo que esto fija: `cargarArmazon` hacia un `.limit(1)` sobre
  // `comunidades` sin filtro, confiando en que "RLS ya deja pasar solo la
  // tuya". Es falso para un superadmin, cuya politica le deja ver TODAS: la
  // base le devolvia la primera que le viniera bien, y el panel de creador le
  // enseñaba la academia de otra empresa.
  //
  // Con una sola academia en la base no se notaba. En produccion aparecio en
  // cuanto hubo dos.
  const { data: suya, error } = await admin
    .from("comunidades")
    .insert({
      slug: "propia-armazon",
      nombre: "La del superadmin",
      propietario_id: e.superadmin.id,
      plan_id: "pro",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const armazon = await cargarArmazon(e.superadmin.cliente);
  expect(armazon.comunidad?.id).toBe(suya.id);
  expect(armazon.comunidad?.id).not.toBe(e.comunidadA);
  expect(armazon.comunidad?.id).not.toBe(e.comunidadB);

  // Y solo los cursos de esa: antes se descargaba los de todas las academias
  // de la plataforma para pintar los de una.
  const ids = armazon.cursos.map((c) => c.id);
  expect(ids).not.toContain(e.cursoAPublicado);
  expect(ids).not.toContain(e.cursoB);

  await admin.from("comunidades").delete().eq("id", suya.id);
});

test("los cursos llegan con sus modulos y lecciones anidados", async () => {
  const armazon = await cargarArmazon(e.alumnoA.cliente);
  const curso = armazon.cursos.find((c) => c.id === e.cursoAPublicado);

  expect(curso?.modulos.length).toBe(1);
  expect(curso?.modulos[0].lecciones[0].titulo).toBe("Leccion 1");
  expect(curso?.modulos[0].lecciones[0].bloques[0]).toMatchObject({
    tipo: "video",
    vimeoId: "123456789",
  });
});

test("el dueno recibe tambien sus borradores", async () => {
  const armazon = await cargarArmazon(e.duenoA.cliente);
  const ids = armazon.cursos.map((c) => c.id);
  expect(ids).toContain(e.cursoABorrador);
});

test("el perfil llega con el correo de la sesion", async () => {
  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.perfil.email).toBe("alumnoa-armazon@prueba.klaze");
  expect(armazon.perfil.id).toBe(e.alumnoA.id);
});
