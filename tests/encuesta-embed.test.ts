import { expect, test } from "bun:test";
import { urlDeEmbed } from "../src/lib/encuesta-embed";

test("extrae el src de un iframe de Typeform", () => {
  const codigo =
    '<iframe src="https://empresa.typeform.com/to/abc123" width="100%" height="500"></iframe>';
  expect(urlDeEmbed(codigo)).toBe("https://empresa.typeform.com/to/abc123");
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
