import { expect, test } from "bun:test";
import { urlDeEmbed } from "../src/lib/encuesta-embed";

test("extrae el src de un iframe de Typeform", () => {
  const codigo =
    '<iframe src="https://empresa.typeform.com/to/abc123" width="100%" height="500"></iframe>';
  expect(urlDeEmbed(codigo)).toBe("https://empresa.typeform.com/to/abc123");
});

test("el embed live de Typeform (div + script, sin iframe) se convierte en su URL", () => {
  const codigo =
    '<div data-tf-live="01M016RPRH3C1M68JE97S33KG4"></div><script src="//embed.typeform.com/next/embed.js"></script>';
  expect(urlDeEmbed(codigo)).toBe(
    "https://form.typeform.com/to/01M016RPRH3C1M68JE97S33KG4"
  );
});

test("una URL pelada tambien vale", () => {
  expect(urlDeEmbed("https://docs.google.com/forms/d/e/XYZ/viewform")).toBe(
    "https://docs.google.com/forms/d/e/XYZ/viewform"
  );
});

test("http (sin s) se rechaza", () => {
  expect(urlDeEmbed("http://inseguro.com/form")).toBeNull();
  expect(urlDeEmbed('<iframe src="http://inseguro.com/f"></iframe>')).toBeNull();
});

test("javascript: y basura se rechazan", () => {
  expect(urlDeEmbed("javascript:alert(1)")).toBeNull();
  expect(urlDeEmbed("esto no es una url")).toBeNull();
  expect(urlDeEmbed("")).toBeNull();
});

test("del iframe solo sobrevive la URL, nunca atributos ni scripts", () => {
  const hostil =
    '<iframe src="https://ok.com/f" onload="alert(1)"></iframe><script>robar()</script>';
  expect(urlDeEmbed(hostil)).toBe("https://ok.com/f");
});
