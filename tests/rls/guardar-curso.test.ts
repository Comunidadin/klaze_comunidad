import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { guardarCurso } from "../../src/lib/supabase/guardar-curso";
import { cargarArmazon } from "../../src/lib/supabase/consultas";
import type { Course } from "../../src/lib/types";

let e: Escenario;
beforeAll(async () => {
  e = await montarEscenario("guardar");
});
afterAll(async () => {
  await desmontar(e);
});

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
