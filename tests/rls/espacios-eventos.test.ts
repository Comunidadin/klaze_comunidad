import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { guardarSecciones, leerSecciones } from "../../src/lib/supabase/espacios";
import {
  guardarEvento,
  leerEventos,
  eliminarEvento,
} from "../../src/lib/supabase/eventos";

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("espev");
});

afterAll(async () => {
  await desmontar(e);
});

test("el dueno guarda secciones con sus espacios y las relee", async () => {
  await guardarSecciones(e.duenoA.cliente, e.cursoAPublicado, [
    {
      id: crypto.randomUUID(),
      titulo: "Comienza aquí",
      orden: 1,
      espacios: [
        {
          id: crypto.randomUUID(),
          slug: "anuncios",
          nombre: "Anuncios",
          icono: "📣",
          orden: 1,
          soloLectura: true,
        },
      ],
    },
  ]);

  const leidas = await leerSecciones(e.duenoA.cliente, e.cursoAPublicado);
  expect(leidas.length).toBe(1);
  expect(leidas[0].espacios[0].nombre).toBe("Anuncios");
  expect(leidas[0].espacios[0].soloLectura).toBe(true);
});

test("un alumno con acceso ve los espacios; uno de otra empresa no", async () => {
  expect((await leerSecciones(e.alumnoA.cliente, e.cursoAPublicado)).length).toBe(1);
  expect((await leerSecciones(e.alumnoB.cliente, e.cursoAPublicado)).length).toBe(0);
});

test("un alumno no puede cambiar los espacios", async () => {
  await expect(
    guardarSecciones(e.alumnoA.cliente, e.cursoAPublicado, [
      { id: crypto.randomUUID(), titulo: "Colado", orden: 1, espacios: [] },
    ])
  ).rejects.toThrow();
});

test("guardar sin una seccion la borra de verdad", async () => {
  await guardarSecciones(e.duenoA.cliente, e.cursoAPublicado, []);
  expect((await leerSecciones(e.duenoA.cliente, e.cursoAPublicado)).length).toBe(0);
});

test("el dueno crea un evento y el alumno lo ve", async () => {
  await guardarEvento(e.duenoA.cliente, {
    id: crypto.randomUUID(),
    cursoId: e.cursoAPublicado,
    comunidadId: e.comunidadA,
    titulo: "Sesión en vivo",
    descripcion: "",
    duracionMin: 60,
    fechaInicio: "2026-09-01T18:00:00Z",
    urlSala: "https://meet.example/x",
  });

  const delAlumno = await leerEventos(e.alumnoA.cliente, e.cursoAPublicado);
  expect(delAlumno.map((v) => v.titulo)).toContain("Sesión en vivo");

  const deOtraEmpresa = await leerEventos(e.alumnoB.cliente, e.cursoAPublicado);
  expect(deOtraEmpresa).toEqual([]);
});

test("un alumno no puede crear eventos", async () => {
  await expect(
    guardarEvento(e.alumnoA.cliente, {
      id: crypto.randomUUID(),
      cursoId: e.cursoAPublicado,
      comunidadId: e.comunidadA,
      titulo: "Colado",
      descripcion: "",
      duracionMin: 30,
      fechaInicio: "2026-09-02T18:00:00Z",
      urlSala: "",
    })
  ).rejects.toThrow();
});

test("el dueno edita y borra su evento", async () => {
  const antes = await leerEventos(e.duenoA.cliente, e.cursoAPublicado);
  const evento = antes[0];

  await guardarEvento(e.duenoA.cliente, { ...evento, titulo: "Sesión movida" });
  const tras = await leerEventos(e.duenoA.cliente, e.cursoAPublicado);
  expect(tras.find((v) => v.id === evento.id)?.titulo).toBe("Sesión movida");

  await eliminarEvento(e.duenoA.cliente, evento.id);
  const finales = await leerEventos(e.duenoA.cliente, e.cursoAPublicado);
  expect(finales.some((v) => v.id === evento.id)).toBe(false);
});
