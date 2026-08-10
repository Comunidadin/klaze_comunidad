import { expect, test } from "bun:test";
import { slugDesde } from "../src/lib/slug";

/**
 * El identificador de una academia sale del nombre que su dueño escribió en un
 * formulario, sin que nadie lo revise. Así que estas pruebas son la lista de lo
 * que la gente escribe de verdad: acentos, mayúsculas, comillas, emojis y
 * nombres de empresa de tres líneas.
 *
 * No tocan la base — `slugLibre` sí, y se prueba en `api-plataforma.test.ts`
 * junto al alta que la usa.
 */

test("quita los acentos en vez de dejarlos en la URL", () => {
  // Sin esto acabaría en /c/mentor%C3%ADa: funciona, pero no se puede dictar.
  expect(slugDesde("Mentoría")).toBe("mentoria");
  expect(slugDesde("Diseño Gráfico")).toBe("diseno-grafico");
  expect(slugDesde("Educación Física")).toBe("educacion-fisica");
});

test("junta lo que no es letra ni numero en un solo guion", () => {
  expect(slugDesde("Mentoría Pro 2026!")).toBe("mentoria-pro-2026");
  expect(slugDesde("Marketing  &  Ventas")).toBe("marketing-ventas");
  expect(slugDesde('Academia "El Salto"')).toBe("academia-el-salto");
});

test("no deja guiones colgando por delante ni por detras", () => {
  expect(slugDesde("  ¡Hola!  ")).toBe("hola");
  expect(slugDesde("---Klaze---")).toBe("klaze");
});

test("un nombre sin letras no deja la academia sin direccion", () => {
  // Pasa: hay quien pone solo emojis. Un slug vacío crearía una comunidad en
  // `/c/`, que no lleva a ninguna parte.
  expect(slugDesde("🚀🔥")).toBe("academia");
  expect(slugDesde("")).toBe("academia");
  expect(slugDesde("   ")).toBe("academia");
});

test("recorta los nombres largos sin dejar el guion del corte", () => {
  const largo = slugDesde(
    "Academia Internacional de Formación Profesional Avanzada para Emprendedores"
  );
  expect(largo.length).toBeLessThanOrEqual(40);
  expect(largo.endsWith("-")).toBe(false);
  expect(largo.startsWith("academia-internacional")).toBe(true);
});

test("solo produce minusculas, numeros y guiones", () => {
  // La comprobación que hace `/api/academias` antes de aceptar un slug a mano.
  const entradas = [
    "ÑOÑO S.L.",
    "Curso #1 — 50% OFF",
    "Ana's Academy",
    "Formación_Online",
  ];
  for (const entrada of entradas) {
    expect(slugDesde(entrada)).toMatch(/^[a-z0-9-]+$/);
  }
});
