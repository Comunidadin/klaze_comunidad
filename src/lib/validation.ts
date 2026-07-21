// Validaciones compartidas de formularios. Extraído de registro/recuperar
// (Task 5 dejó el regex duplicado en cada página) y reutilizado por Accesos
// (Task 12) para validar la lista de correos pegados por el creador.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `true` si `email` tiene forma de correo válida (sin espacios, con `@` y dominio). */
export function esEmailValido(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}
