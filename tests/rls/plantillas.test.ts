import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import {
  guardarPlantilla,
  listarPlantillas,
  restaurarPlantilla,
} from "../../src/lib/supabase/plantillas-correo";
import {
  PLANTILLAS_POR_DEFECTO,
  componerCorreo,
  leerPlantilla,
  render,
} from "../../src/lib/plantillas";

/**
 * Los correos de cada academia.
 *
 * Dos cosas distintas que comprobar. Una es de aislamiento: el texto que
 * escribe una empresa es suyo, y firmado con su marca — que otra lo lea o lo
 * cambie sería peor que una fuga de datos, sería suplantación.
 *
 * La otra es de contenido: lo que se escribe en un `<textarea>` acaba dentro de
 * un correo HTML, y el nombre que sustituye `{{nombre}}` viene del formulario
 * de otra aplicación.
 */

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("plantillas");
});

afterAll(async () => {
  await desmontar(e);
});

test("el dueno guarda y vuelve a leer la suya", async () => {
  await guardarPlantilla(e.duenoA.cliente, e.comunidadA, "bienvenida", {
    asunto: "Bienvenido a {{academia}}",
    cuerpo: "Hola {{nombre}}, empezamos.",
  });

  const guardadas = await listarPlantillas(e.duenoA.cliente, e.comunidadA);
  expect(guardadas.bienvenida?.asunto).toBe("Bienvenido a {{academia}}");
  // Los otros dos tipos no tienen fila: eso ES "usa la de por defecto".
  expect(guardadas.recuperacion).toBeUndefined();
  expect(guardadas.baja).toBeUndefined();
});

test("el dueno de otra empresa no lee mis correos", async () => {
  const guardadas = await listarPlantillas(e.duenoB.cliente, e.comunidadA);
  expect(guardadas).toEqual({});
});

test("el dueno de otra empresa no puede escribir en mi academia", async () => {
  // Suplantacion, no fuga: el correo sale firmado con MI marca.
  await expect(
    guardarPlantilla(e.duenoB.cliente, e.comunidadA, "baja", {
      asunto: "Te echamos",
      cuerpo: "Adios.",
    })
  ).rejects.toThrow();

  const { data } = await admin
    .from("plantillas_correo")
    .select("tipo")
    .eq("comunidad_id", e.comunidadA)
    .eq("tipo", "baja");
  expect(data ?? []).toEqual([]);
});

test("un alumno no ve ni escribe las plantillas de su academia", async () => {
  const guardadas = await listarPlantillas(e.alumnoA.cliente, e.comunidadA);
  expect(guardadas).toEqual({});

  await expect(
    guardarPlantilla(e.alumnoA.cliente, e.comunidadA, "bienvenida", {
      asunto: "x",
      cuerpo: "y",
    })
  ).rejects.toThrow();
});

test("restaurar borra la fila, no guarda una copia del texto original", async () => {
  await guardarPlantilla(e.duenoA.cliente, e.comunidadA, "recuperacion", {
    asunto: "Mio",
    cuerpo: "Mio tambien",
  });
  await restaurarPlantilla(e.duenoA.cliente, e.comunidadA, "recuperacion");

  // Sin fila y no con una copia: asi, mejorar el texto por defecto llega a
  // quien lo restauro. Con una copia se le habria quedado congelado el de hoy.
  const { data } = await admin
    .from("plantillas_correo")
    .select("tipo")
    .eq("comunidad_id", e.comunidadA)
    .eq("tipo", "recuperacion");
  expect(data ?? []).toEqual([]);
});

test("leerPlantilla cae a la de por defecto cuando no hay fila", async () => {
  const p = await leerPlantilla(admin, e.comunidadB, "baja");
  expect(p).toEqual(PLANTILLAS_POR_DEFECTO.baja);
});

test("leerPlantilla devuelve la guardada cuando la hay", async () => {
  const p = await leerPlantilla(admin, e.comunidadA, "bienvenida");
  expect(p.asunto).toBe("Bienvenido a {{academia}}");
});

test("un asunto guardado en blanco no manda un correo sin asunto", async () => {
  // Un correo sin asunto lo tratan como basura muchos filtros, asi que el
  // campo vacio significa "la de por defecto" y no "manda nada".
  await admin.from("plantillas_correo").upsert({
    comunidad_id: e.comunidadB,
    tipo: "bienvenida",
    asunto: "   ",
    cuerpo: "   ",
  });

  const p = await leerPlantilla(admin, e.comunidadB, "bienvenida");
  expect(p).toEqual(PLANTILLAS_POR_DEFECTO.bienvenida);
});

test("un nombre con html no llega vivo al correo", async () => {
  // `{{nombre}}` sale del formulario de otra aplicacion: quien se registre
  // como `<script>` no puede acabar ejecutando nada en el buzon de nadie.
  const { html } = componerCorreo(
    { asunto: "Hola", cuerpo: "Hola {{nombre}}." },
    {
      academia: "Academia",
      correo: "x@y.com",
      nombre: '<script>alert("x")</script>',
    }
  );

  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
});

test("el asunto NO se escapa: no es html", async () => {
  // Escaparlo dejaria un "&amp;" a la vista en la bandeja de entrada.
  const { asunto } = componerCorreo(
    { asunto: "{{academia}}", cuerpo: "x" },
    { academia: "Ventas & Marketing", correo: "x@y.com" }
  );
  expect(asunto).toBe("Ventas & Marketing");
});

test("sin nombre, la plantilla no saluda a nadie", async () => {
  // "Hola :" es el resultado de sustituir vacio, y el dueño no lo veria nunca
  // porque el si tiene nombre.
  const texto = render("Hola {{nombre}}.", { academia: "A", correo: "marta@x.com" }, false);
  expect(texto).toBe("Hola marta.");
});

test("los renglones en blanco se vuelven parrafos", async () => {
  const { html } = componerCorreo(
    { asunto: "x", cuerpo: "Uno.\n\nDos.\nSigue." },
    { academia: "A", correo: "x@y.com" }
  );
  expect(html).toBe("<p>Uno.</p>\n<p>Dos.<br>Sigue.</p>");
});
