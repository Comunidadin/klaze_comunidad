import { expect, test } from "bun:test";
import { parseInline, parseMarkdown } from "../src/lib/markdown";

test("texto plano queda como un parrafo intacto", () => {
  const b = parseMarkdown("hola mundo");
  expect(b).toEqual([
    { tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "hola mundo" }]] },
  ]);
});

test("titulos ## y ###, y # se aplana a nivel 2", () => {
  const b = parseMarkdown("# Uno\n## Dos\n### Tres");
  expect(b.map((x) => (x.tipo === "titulo" ? x.nivel : null))).toEqual([2, 2, 3]);
});

test("negrita, cursiva y enlace http en una linea", () => {
  const i = parseInline("hay **fuerte**, *suave* y [klaze](https://klaze.app) aqui");
  expect(i).toEqual([
    { tipo: "texto", texto: "hay " },
    { tipo: "negrita", texto: "fuerte" },
    { tipo: "texto", texto: ", " },
    { tipo: "cursiva", texto: "suave" },
    { tipo: "texto", texto: " y " },
    { tipo: "enlace", texto: "klaze", href: "https://klaze.app" },
    { tipo: "texto", texto: " aqui" },
  ]);
});

test("un enlace javascript: no se convierte en enlace", () => {
  const i = parseInline("[roba](javascript:alert(1))");
  expect(i.every((n) => n.tipo !== "enlace")).toBe(true);
});

test("un enlace data: tampoco", () => {
  const i = parseInline("[x](data:text/html,hola)");
  expect(i.every((n) => n.tipo !== "enlace")).toBe(true);
});

test("lista con - agrupa items consecutivos", () => {
  const b = parseMarkdown("- uno\n- dos\n\ntexto");
  expect(b[0]).toEqual({
    tipo: "lista",
    items: [[{ tipo: "texto", texto: "uno" }], [{ tipo: "texto", texto: "dos" }]],
  });
  expect(b[1].tipo).toBe("parrafo");
});

test("sintaxis cortada a mitad no lanza y queda como texto", () => {
  expect(() => parseMarkdown("esto quedo **a med")).not.toThrow();
  const b = parseMarkdown("esto quedo **a med");
  expect(b[0]).toEqual({
    tipo: "parrafo",
    lineas: [[{ tipo: "texto", texto: "esto quedo **a med" }]],
  });
});

test("entrada vacia devuelve cero bloques", () => {
  expect(parseMarkdown("")).toEqual([]);
  expect(parseMarkdown("\n\n  \n")).toEqual([]);
});

test("las normas reales: titulos con numero y parrafos", () => {
  const b = parseMarkdown("## 3. No hagas spam\n\nNo compartas publicidad.");
  expect(b[0].tipo).toBe("titulo");
  expect(b[1].tipo).toBe("parrafo");
});
