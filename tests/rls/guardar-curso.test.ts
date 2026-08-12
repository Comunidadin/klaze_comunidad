import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import {
  borrarCurso,
  cambiarPublicadoCurso,
  guardarCurso,
  reordenarCursos,
} from "../../src/lib/supabase/guardar-curso";
import { cargarArmazon } from "../../src/lib/supabase/consultas";
import type { Course } from "../../src/lib/types";

let e: Escenario;
beforeAll(async () => {
  e = await montarEscenario("guardar");
});
afterAll(async () => {
  await desmontar(e);
});

/** El curso del escenario tal como lo devuelve el armazón del dueño. */
async function leerCursoDelDueno() {
  const { cursos } = await cargarArmazon(e.duenoA.cliente);
  const curso = cursos.find((c) => c.id === e.cursoAPublicado);
  if (!curso) throw new Error("El escenario no trajo el curso publicado");
  return curso;
}

function cursoDePrueba(comunidadId: string, slug: string): Course {
  return {
    id: crypto.randomUUID(),
    comunidadId,
    slug,
    titulo: "Curso guardado",
    descripcion: "",
    portadaUrl: "",
    precioReferencial: 0,
    nivelRequerido: null,
    publicado: true,
    orden: 1,
    secciones: [],
    modulos: [
      {
        id: crypto.randomUUID(),
        titulo: "Modulo 1",
        orden: 1,
        lecciones: [
          {
            id: crypto.randomUUID(),
            titulo: "Leccion 1",
            orden: 1,
            duracionMin: 5,
            bloques: [
              { id: crypto.randomUUID(), tipo: "video", vimeoId: "987654321" },
            ],
            recursos: [],
          },
        ],
      },
      { id: crypto.randomUUID(), titulo: "Modulo 2", orden: 2, lecciones: [] },
    ],
  };
}

test("guardar un curso conserva modulos, lecciones y el id de Vimeo", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-guardado-1");
  await guardarCurso(e.duenoA.cliente, curso);

  const armazon = await cargarArmazon(e.duenoA.cliente);
  const leido = armazon.cursos.find((c) => c.id === curso.id);

  expect(leido?.titulo).toBe("Curso guardado");
  expect(leido?.modulos.length).toBe(2);
  const piezas = leido?.modulos[0].lecciones[0].bloques ?? [];
  expect(piezas).toHaveLength(1);
  expect(piezas[0]).toMatchObject({ tipo: "video", vimeoId: "987654321" });
});

test("guardar sin un modulo lo borra de verdad", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-guardado-2");
  await guardarCurso(e.duenoA.cliente, curso);

  await guardarCurso(e.duenoA.cliente, { ...curso, modulos: [curso.modulos[0]] });

  const armazon = await cargarArmazon(e.duenoA.cliente);
  const leido = armazon.cursos.find((c) => c.id === curso.id);
  expect(leido?.modulos.length).toBe(1);
});

test("quitar una leccion la borra sin tocar las demas", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-guardado-3");
  curso.modulos[0].lecciones.push({
    id: crypto.randomUUID(),
    titulo: "Leccion 2",
    orden: 2,
    duracionMin: 3,
    // Una clase con varias piezas: video, explicacion y un formulario debajo.
    // Antes esto eran tres clases seguidas o no se podia.
    bloques: [
      { id: crypto.randomUUID(), tipo: "video", vimeoId: "111222333" },
      {
        id: crypto.randomUUID(),
        tipo: "texto",
        doc: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Explicacion" }] },
          ],
        },
      },
      {
        id: crypto.randomUUID(),
        tipo: "embed",
        url: "https://docs.google.com/forms/d/e/x/viewform?embedded=true",
        alto: 640,
      },
    ],
    recursos: [],
  });
  await guardarCurso(e.duenoA.cliente, curso);

  const sinLa2 = {
    ...curso,
    modulos: curso.modulos.map((m, i) =>
      i === 0 ? { ...m, lecciones: [m.lecciones[0]] } : m
    ),
  };
  await guardarCurso(e.duenoA.cliente, sinLa2);

  const armazon = await cargarArmazon(e.duenoA.cliente);
  const leido = armazon.cursos.find((c) => c.id === curso.id);
  expect(leido?.modulos[0].lecciones.length).toBe(1);
  expect(leido?.modulos[0].lecciones[0].titulo).toBe("Leccion 1");
});

test("el armazon devuelve los cursos por su orden", async () => {
  // El orden ES el temario: "Introduccion" no puede salir detras de
  // "Avanzada". Antes no habia columna y la lista salia como la devolviera
  // Postgres, que no promete nada --- un fallo que aparece cuando ya hay
  // muchos modulos, o sea cuando ya es caro descubrirlo.
  const tercero = { ...cursoDePrueba(e.comunidadA, "orden-c"), titulo: "C", orden: 30 };
  const primero = { ...cursoDePrueba(e.comunidadA, "orden-a"), titulo: "A", orden: 10 };
  const segundo = { ...cursoDePrueba(e.comunidadA, "orden-b"), titulo: "B", orden: 20 };

  // Se guardan al reves de como deben salir.
  await guardarCurso(e.duenoA.cliente, tercero);
  await guardarCurso(e.duenoA.cliente, segundo);
  await guardarCurso(e.duenoA.cliente, primero);

  const { cursos } = await cargarArmazon(e.duenoA.cliente);
  const titulos = cursos
    .filter((c) => c.slug.startsWith("orden-"))
    .map((c) => c.titulo);
  expect(titulos).toEqual(["A", "B", "C"]);

  await admin.from("cursos").delete().in("id", [primero.id, segundo.id, tercero.id]);
});

test("reordenar cambia el orden sin tocar el contenido", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-reordenado");
  await guardarCurso(e.duenoA.cliente, curso);

  await reordenarCursos(e.duenoA.cliente, [{ id: curso.id, orden: 7 }]);

  const { cursos } = await cargarArmazon(e.duenoA.cliente);
  const leido = cursos.find((c) => c.id === curso.id);
  expect(leido?.orden).toBe(7);
  // Mover una fila de sitio no puede arrastrar el temario: por eso esto no
  // pasa por `guardarCurso`, que sube el curso entero y borra lo que sobra.
  expect(leido?.modulos.length).toBe(2);
  expect(leido?.modulos[0].lecciones.length).toBe(1);

  await admin.from("cursos").delete().eq("id", curso.id);
});

test("un alumno no puede reordenar ni publicar los cursos de su academia", async () => {
  await expect(
    reordenarCursos(e.alumnoA.cliente, [{ id: e.cursoAPublicado, orden: 99 }])
  ).rejects.toThrow();

  await expect(
    cambiarPublicadoCurso(e.alumnoA.cliente, e.cursoAPublicado, false)
  ).rejects.toThrow();

  const { data } = await admin
    .from("cursos")
    .select("orden, publicado")
    .eq("id", e.cursoAPublicado)
    .single();
  expect(data?.orden).not.toBe(99);
  expect(data?.publicado).toBe(true);
});

test("borrar un curso se lleva sus modulos y sus lecciones", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-borrado");
  await guardarCurso(e.duenoA.cliente, curso);

  const moduloId = curso.modulos[0].id;
  const leccionId = curso.modulos[0].lecciones[0].id;

  await borrarCurso(e.duenoA.cliente, curso.id);

  const { cursos } = await cargarArmazon(e.duenoA.cliente);
  expect(cursos.find((c) => c.id === curso.id)).toBeUndefined();

  // Con la clave secreta, que se salta RLS: si las filas hijas siguieran ahi,
  // una lectura con sesion no lo notaria —la politica las esconde igual— y
  // quedarian huerfanas para siempre. El `on delete cascade` es lo que se
  // comprueba aqui.
  const { data: modulos } = await admin.from("modulos").select("id").eq("id", moduloId);
  const { data: lecciones } = await admin.from("lecciones").select("id").eq("id", leccionId);
  expect(modulos ?? []).toEqual([]);
  expect(lecciones ?? []).toEqual([]);
});

test("borrar un curso se lleva el progreso de sus alumnos", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-con-progreso");
  await guardarCurso(e.duenoA.cliente, curso);
  const leccionId = curso.modulos[0].lecciones[0].id;

  const { error } = await admin
    .from("progreso")
    .insert({ usuario_id: e.alumnoA.id, leccion_id: leccionId });
  if (error) throw new Error(error.message);

  await borrarCurso(e.duenoA.cliente, curso.id);

  // No es un detalle tecnico: es la razon por la que el dialogo lo avisa y
  // pide escribir la palabra. Lo que se borra tambien es de sus alumnos.
  const { data } = await admin.from("progreso").select("leccion_id").eq("leccion_id", leccionId);
  expect(data ?? []).toEqual([]);
});

test("el dueno de otra empresa no puede borrar mi curso", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-ajeno");
  await guardarCurso(e.duenoA.cliente, curso);

  // Tiene que LANZAR: RLS filtra en vez de lanzar, asi que un delete rechazado
  // vuelve vacio y sin error. Si `borrarCurso` no comprobara `data.length`,
  // esto pasaria por eliminado sin haber eliminado nada.
  await expect(borrarCurso(e.duenoB.cliente, curso.id)).rejects.toThrow();

  const { data } = await admin.from("cursos").select("id").eq("id", curso.id);
  expect(data?.length).toBe(1);
});

test("un alumno no puede borrar un curso de su propia academia", async () => {
  await expect(borrarCurso(e.alumnoA.cliente, e.cursoAPublicado)).rejects.toThrow();

  const { data } = await admin.from("cursos").select("id").eq("id", e.cursoAPublicado);
  expect(data?.length).toBe(1);
});

test("una imagen de referencia sobrevive al guardado, con su pie", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-con-imagen");
  curso.modulos[0].lecciones[0].bloques = [
    { id: crypto.randomUUID(), tipo: "video", vimeoId: "444" },
    {
      id: crypto.randomUUID(),
      tipo: "imagen",
      url: "https://ejemplo.test/captura.png",
      pie: "Paso 3 del formulario",
    },
  ];

  await guardarCurso(e.duenoA.cliente, curso);

  const { cursos } = await cargarArmazon(e.duenoA.cliente);
  const piezas = cursos.find((c) => c.id === curso.id)?.modulos[0].lecciones[0].bloques ?? [];

  // El orden importa igual que con las demas piezas: la imagen va DEBAJO del
  // video, y si `bloques` se guardara como objeto acabaria encima.
  expect(piezas.map((b) => b.tipo)).toEqual(["video", "imagen"]);
  expect(piezas[1]).toMatchObject({
    url: "https://ejemplo.test/captura.png",
    pie: "Paso 3 del formulario",
  });

  await admin.from("cursos").delete().eq("id", curso.id);
});

test("un alumno no puede guardar un curso en la comunidad de su dueno", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-intruso");
  await expect(guardarCurso(e.alumnoA.cliente, curso)).rejects.toThrow();
});

test("una clase con video, texto y embed conserva sus piezas y su orden", async () => {
  const curso = cursoDePrueba(e.comunidadA, "curso-piezas");
  curso.modulos[0].lecciones.push({
    id: crypto.randomUUID(),
    titulo: "Clase compuesta",
    orden: 2,
    duracionMin: 8,
    bloques: [
      { id: crypto.randomUUID(), tipo: "video", vimeoId: "555" },
      {
        id: crypto.randomUUID(),
        tipo: "texto",
        doc: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }],
        },
      },
      { id: crypto.randomUUID(), tipo: "embed", url: "https://typeform.com/to/x", alto: 640 },
    ],
    recursos: [],
  });

  await guardarCurso(e.duenoA.cliente, curso);

  const { cursos } = await cargarArmazon(e.duenoA.cliente);
  const leido = cursos.find((c) => c.slug === "curso-piezas");
  const piezas = leido?.modulos[0].lecciones.find((l) => l.titulo === "Clase compuesta")?.bloques;

  // El ORDEN importa: si se guardara como objeto en vez de array, el video
  // podria acabar debajo del formulario sin que nada fallara.
  expect(piezas?.map((b) => b.tipo)).toEqual(["video", "texto", "embed"]);
  expect(piezas?.[2]).toMatchObject({ url: "https://typeform.com/to/x", alto: 640 });
});

test("el goteo se guarda y se vuelve a leer igual", async () => {
  // Un campo que se guarda pero no se lee —o al reves— es de los fallos que no
  // dan error: el creador configura el goteo, recarga y se le ha ido.
  const curso = await leerCursoDelDueno();

  await guardarCurso(e.duenoA.cliente, {
    ...curso,
    goteoModo: "dias",
    goteoDias: 7,
    goteoDesde: null,
  });

  const { data } = await admin
    .from("cursos")
    .select("goteo_modo, goteo_dias, goteo_desde")
    .eq("id", curso.id)
    .single();

  expect(data!.goteo_modo).toBe("dias");
  expect(data!.goteo_dias).toBe(7);
  expect(data!.goteo_desde).toBeNull();

  await guardarCurso(e.duenoA.cliente, {
    ...curso,
    goteoModo: "ninguno",
    goteoDias: null,
    goteoDesde: null,
  });
});
