import { expect, test } from "bun:test";
import { correoAltaAcademia } from "../src/lib/plantillas";

/**
 * El correo que recibe un creador al que se le da de alta su academia.
 *
 * Es lógica pura —arma HTML a partir de cinco cadenas—, así que no necesita
 * base. Se prueba aquí y no en `tests/rls/plantillas.test.ts` por eso.
 *
 * Lo que hay que vigilar es que llegue lo imprescindible para entrar: el
 * enlace, el correo y la contraseña. Un correo de bienvenida cordial al que le
 * falte una de las tres deja a alguien fuera de una academia que ya es suya, y
 * quien lo manda no se entera nunca porque el suyo de prueba llega bien.
 */

const BASE = {
  origen: "https://klaze.app",
  empresa: "Mentoría Élite",
  slug: "mentoria-elite",
  correo: "jefe@empresa.com",
};

test("lleva el enlace de entrada, el correo y la contraseña", () => {
  const { asunto, html } = correoAltaAcademia({ ...BASE, password: "Klaze-abc123" });

  expect(asunto).toBe("Tu academia Mentoría Élite ya está lista");
  expect(html).toContain("https://klaze.app/login");
  expect(html).toContain("jefe@empresa.com");
  expect(html).toContain("Klaze-abc123");
});

test("y la puerta de sus alumnos, que es la que va a repartir", () => {
  const { html } = correoAltaAcademia({ ...BASE, password: "Klaze-abc123" });
  expect(html).toContain("https://klaze.app/login/mentoria-elite");
});

test("sin contraseña no se inventa ninguna: le manda a usar la suya", () => {
  // Pasa cuando ese correo ya tenía cuenta en Klaze —estudiaba en la academia
  // de otro—. Cambiársela le dejaría fuera de allí sin avisar.
  const { html } = correoAltaAcademia({ ...BASE, password: null });

  expect(html).toContain("https://klaze.app/login");
  expect(html).toContain("tu contraseña de siempre");
  expect(html).not.toContain("Contraseña:");
});

test("el nombre de la academia se escapa: entra desde un webhook", () => {
  // Por el súper enlace, `empresa` sale del cuerpo que manda la pasarela de
  // pago. Sin escapar, quien controle ese formulario mete HTML en el buzón de
  // otra persona.
  const { html } = correoAltaAcademia({
    ...BASE,
    empresa: '<script>alert("x")</script>',
    password: "Klaze-abc123",
  });

  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
});
