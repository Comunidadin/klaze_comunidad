import { expect, test, beforeAll } from "bun:test";

/**
 * Las cabeceras de seguridad, contra el servidor de desarrollo.
 *
 * Viven en `next.config.ts`, que es un archivo que nadie vuelve a mirar. Una
 * cabecera que desaparece no rompe ninguna pantalla ni ninguna prueba: la app
 * sigue funcionando exactamente igual y solo se pierde la proteccion. Es el
 * tipo de cosa que hay que atar a algo que se ponga rojo.
 */
const BASE = "http://localhost:3000";

let cabeceras: Headers | null = null;

beforeAll(async () => {
  cabeceras = await fetch(`${BASE}/login`)
    .then((r) => (r.ok ? r.headers : null))
    .catch(() => null);
});

function saltar(): boolean {
  if (!cabeceras) {
    console.log("SALTADA: arranca `bun run dev` para probar las cabeceras");
    return true;
  }
  return false;
}

test("C1. el panel no se puede meter en un iframe ajeno", () => {
  if (saltar()) return;
  // Sin esto, el panel se enmarca en la web de otro con botones invisibles
  // encima. Bastan un par de clics de un dueno que cree estar en otra pagina
  // para eliminar un modulo o suspender a un alumno.
  expect(cabeceras!.get("x-frame-options")).toBe("DENY");
  expect(cabeceras!.get("content-security-policy-report-only")).toContain(
    "frame-ancestors 'none'"
  );
});

test("C2. estan las cuatro que no rompen nada", () => {
  if (saltar()) return;
  expect(cabeceras!.get("x-content-type-options")).toBe("nosniff");
  expect(cabeceras!.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(cabeceras!.get("permissions-policy")).toContain("camera=()");
  expect(cabeceras!.get("strict-transport-security")).toContain("max-age=");
});

test("C3. la CSP va en modo aviso, no bloqueando", () => {
  if (saltar()) return;
  // Deliberado: una clase puede insertar el formulario de cualquier servicio y
  // ensenar imagenes de cualquier dominio. Una CSP estrecha rompe clases EN
  // SILENCIO --- el alumno ve un hueco en blanco y nadie se entera. En modo
  // aviso el navegador la comprueba y la anota sin bloquear, que es lo que hace
  // falta para saber que haria antes de dejarla mandar.
  //
  // El dia que se pase a bloquear, esta prueba se da la vuelta a proposito.
  expect(cabeceras!.get("content-security-policy-report-only")).not.toBeNull();
  expect(cabeceras!.get("content-security-policy")).toBeNull();
});

test("C4. la CSP no estrangula lo que el producto necesita", () => {
  if (saltar()) return;
  const csp = cabeceras!.get("content-security-policy-report-only")!;
  // Imagenes y embeds de dominios que no se pueden conocer al compilar: eso ES
  // el producto. Apretar aqui seria romper las clases de los creadores.
  expect(csp).toContain("img-src 'self' data: blob: https:");
  expect(csp).toContain("frame-src https:");
  // Pero lo que si se puede cerrar, esta cerrado.
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
});
