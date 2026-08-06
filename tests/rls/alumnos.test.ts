import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { listarAlumnos, cambiarEstadoAlumno } from "../../src/lib/supabase/alumnos";

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("alumnos");
  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1 })
    .select("id")
    .single();
  await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1, tipo: "texto" });
});

afterAll(async () => {
  await desmontar(e);
});

test("el dueno ve a sus alumnos y no a los de otra empresa", async () => {
  const lista = await listarAlumnos(e.duenoA.cliente, e.comunidadA);
  const ids = lista.map((a) => a.usuarioId);
  expect(ids).toContain(e.alumnoA.id);
  expect(ids).not.toContain(e.alumnoB.id);
});

test("la lista trae el estado y los cursos de cada alumno", async () => {
  const lista = await listarAlumnos(e.duenoA.cliente, e.comunidadA);
  const alumno = lista.find((a) => a.usuarioId === e.alumnoA.id);
  expect(alumno?.estado).toBe("activo");
  expect(alumno?.todosLosCursos).toBe(false);
  expect(alumno?.cursoIds).toContain(e.cursoAPublicado);
});

test("suspender corta el acceso a cursos Y a lecciones", async () => {
  await cambiarEstadoAlumno(e.duenoA.cliente, e.alumnoA.id, e.comunidadA, "suspendido");

  const { data: cursos } = await e.alumnoA.cliente.from("cursos").select("id");
  expect(cursos ?? []).toEqual([]);

  // Cursos y lecciones tienen politicas distintas y podrian divergir: si una
  // se arregla y la otra no, el video seguiria alcanzable por su id.
  const { data: lecciones } = await e.alumnoA.cliente.from("lecciones").select("id");
  expect(lecciones ?? []).toEqual([]);

  await cambiarEstadoAlumno(e.duenoA.cliente, e.alumnoA.id, e.comunidadA, "activo");
  const { data: tras } = await e.alumnoA.cliente.from("cursos").select("id");
  expect((tras ?? []).length).toBeGreaterThan(0);
});

test("el dueno ve el avance de sus alumnos, con la fecha", async () => {
  // Atada al curso de ESTE escenario: los archivos de prueba corren en
  // paralelo y un `.limit(1)` suelto coge la lección de cualquier otro.
  const { data: mod } = await admin
    .from("modulos")
    .select("id")
    .eq("curso_id", e.cursoAPublicado)
    .limit(1)
    .single();
  const { data: lec } = await admin
    .from("lecciones")
    .select("id")
    .eq("modulo_id", mod!.id)
    .limit(1)
    .single();
  await admin
    .from("progreso")
    .upsert({ usuario_id: e.alumnoA.id, leccion_id: lec!.id });

  const { data } = await e.duenoA.cliente.rpc("progreso_de_mis_alumnos", {
    p_comunidad: e.comunidadA,
  });

  expect((data ?? []).map((p: { usuario_id: string }) => p.usuario_id)).toContain(
    e.alumnoA.id
  );
  // La fecha SI se incluye: sin ella no hay grafico de actividad, y en una
  // plataforma de formacion es informacion normal para quien ensena. Lo que
  // sigue acotado es quien la ve: solo el dueno de esa academia.
  expect(data?.[0]).toHaveProperty("completada_el");
});

test("el dueno de B no ve el avance de los alumnos de A", async () => {
  const { data } = await e.duenoB.cliente.rpc("progreso_de_mis_alumnos", {
    p_comunidad: e.comunidadA,
  });
  expect(data ?? []).toEqual([]);
});

test("el dueno de B no puede suspender a un alumno de A", async () => {
  await cambiarEstadoAlumno(e.duenoB.cliente, e.alumnoA.id, e.comunidadA, "suspendido");

  // RLS no lanza: filtra. La escritura no afecta a ninguna fila, asi que hay
  // que comprobarlo por el efecto y no por el error.
  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  expect((data ?? []).length).toBeGreaterThan(0);
});
