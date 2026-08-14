import { expect, test } from "bun:test";
import { conRemitente } from "../src/lib/correo";

/**
 * El nombre que firma cada correo.
 *
 * `RESEND_FROM` es una sola variable global, así que durante meses todos los
 * correos de todas las academias salieron firmados «Mentoría V7.0» — incluido
 * el de bienvenida de una academia que no era esa. El arreglo: la dirección
 * sigue siendo la verificada en Resend, pero el nombre visible lo pone quien
 * manda — la academia, o «Klaze» para los correos de la plataforma.
 *
 * Lógica pura sobre cadenas: se prueba sin base y sin red.
 */

test("reemplaza el nombre visible y conserva la dirección verificada", () => {
  expect(conRemitente("Mentoría V7.0 <acceso@pr.ejemplo.com>", "Academia Trading")).toBe(
    "Academia Trading <acceso@pr.ejemplo.com>"
  );
});

test("una base sin nombre también sirve: solo la dirección", () => {
  expect(conRemitente("acceso@pr.ejemplo.com", "Academia Trading")).toBe(
    "Academia Trading <acceso@pr.ejemplo.com>"
  );
});

test("sin nombre, la base queda tal cual", () => {
  expect(conRemitente("Mentoría V7.0 <acceso@pr.ejemplo.com>", undefined)).toBe(
    "Mentoría V7.0 <acceso@pr.ejemplo.com>"
  );
  expect(conRemitente("Mentoría V7.0 <acceso@pr.ejemplo.com>", "   ")).toBe(
    "Mentoría V7.0 <acceso@pr.ejemplo.com>"
  );
});

test("el nombre de la academia no puede romper la cabecera", () => {
  // El nombre lo escribe el dueño en Configuración, y por el súper enlace
  // llega del cuerpo de un webhook. Unos <> o un salto de línea ahí dentro
  // son otra dirección u otra cabecera, no un nombre.
  expect(
    conRemitente("acceso@pr.ejemplo.com", 'Mi "Academia" <atacante@evil.com>\r\nBcc: x')
  ).toBe("Mi Academia atacante@evil.com Bcc: x <acceso@pr.ejemplo.com>");
});

test("un nombre que se queda vacío al limpiar no deja un hueco delante", () => {
  expect(conRemitente("Mentoría V7.0 <acceso@pr.ejemplo.com>", '"<>"')).toBe(
    "Mentoría V7.0 <acceso@pr.ejemplo.com>"
  );
});
