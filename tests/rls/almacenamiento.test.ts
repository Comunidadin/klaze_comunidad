import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, comoAnonimo } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { subirImagen, borrarImagen } from "../../src/lib/supabase/almacenamiento";

/**
 * Lo único que impide que un creador pise el logo de otra empresa son las
 * políticas de `storage.objects`: en esa tabla no hay nada que diga de quién es
 * un archivo salvo la primera carpeta de su ruta.
 */

let e: Escenario;
const subidas: string[] = [];

beforeAll(async () => {
  e = await montarEscenario("almacen");
});

afterAll(async () => {
  if (subidas.length) await admin.storage.from("publico").remove(subidas);
  await desmontar(e);
});

/** Un PNG de 1×1 real: el bucket comprueba el tipo, no vale texto disfrazado. */
function pngMinimo(): Blob {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bin], { type: "image/png" });
}

/** Guarda la ruta para poder limpiarla al final. */
function anotar(url: string) {
  const marca = "/storage/v1/object/public/publico/";
  const i = url.indexOf(marca);
  if (i !== -1) subidas.push(decodeURIComponent(url.slice(i + marca.length)));
}

test("el dueno sube el logo de su academia", async () => {
  const url = await subirImagen(
    e.duenoA.cliente,
    { tipo: "academia", comunidadId: e.comunidadA, uso: "logo" },
    pngMinimo(),
    "png"
  );
  anotar(url);
  expect(url).toContain(`/publico/academias/${e.comunidadA}/logo/`);
});

test("esa imagen se ve SIN sesion", async () => {
  // La pantalla de invitación enseña la marca de quien invita antes de que el
  // invitado tenga cuenta: si esto se pone rojo, ahí sale un hueco.
  const anon = comoAnonimo();
  const { data, error } = await anon.storage
    .from("publico")
    .list(`academias/${e.comunidadA}/logo`);
  expect(error).toBeNull();
  expect((data ?? []).length).toBeGreaterThan(0);
});

test("el dueno de B NO puede escribir en la carpeta de A", async () => {
  // Si esta prueba se pone roja, cualquier creador puede reemplazar el logo de
  // otra empresa por lo que quiera.
  await expect(
    subirImagen(
      e.duenoB.cliente,
      { tipo: "academia", comunidadId: e.comunidadA, uso: "logo" },
      pngMinimo(),
      "png"
    )
  ).rejects.toThrow();
});

test("un alumno tampoco puede escribir en la carpeta de su academia", async () => {
  await expect(
    subirImagen(
      e.alumnoA.cliente,
      { tipo: "academia", comunidadId: e.comunidadA, uso: "portada" },
      pngMinimo(),
      "png"
    )
  ).rejects.toThrow();
});

test("cada cual sube su propio avatar", async () => {
  const url = await subirImagen(
    e.alumnoA.cliente,
    { tipo: "avatar", usuarioId: e.alumnoA.id },
    pngMinimo(),
    "png"
  );
  anotar(url);
  expect(url).toContain(`/publico/avatares/${e.alumnoA.id}/`);
});

test("nadie puede subir al avatar de otro", async () => {
  await expect(
    subirImagen(
      e.alumnoB.cliente,
      { tipo: "avatar", usuarioId: e.alumnoA.id },
      pngMinimo(),
      "png"
    )
  ).rejects.toThrow();
});

test("sin sesion no se puede subir nada", async () => {
  await expect(
    subirImagen(
      comoAnonimo(),
      { tipo: "academia", comunidadId: e.comunidadA, uso: "logo" },
      pngMinimo(),
      "png"
    )
  ).rejects.toThrow();
});

test("borrar una URL ajena al bucket no hace nada ni lanza", async () => {
  // Se llama al reemplazar una imagen, y alguien pudo haber pegado una URL de
  // Imgur antes de que existiera la subida: no es nuestra para borrarla.
  await borrarImagen(e.duenoA.cliente, "https://i.imgur.com/loquesea.png");
  await borrarImagen(e.duenoA.cliente, "");
  await borrarImagen(e.duenoA.cliente, undefined);
});

test("el dueno borra su propia imagen", async () => {
  const url = await subirImagen(
    e.duenoA.cliente,
    { tipo: "academia", comunidadId: e.comunidadA, uso: "portada" },
    pngMinimo(),
    "png"
  );

  await borrarImagen(e.duenoA.cliente, url);

  const { data } = await admin.storage
    .from("publico")
    .list(`academias/${e.comunidadA}/portada`);
  expect(data ?? []).toEqual([]);
});
