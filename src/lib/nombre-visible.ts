/**
 * Nombre con el que mostrar a una persona.
 *
 * Una cuenta recién invitada tiene el nombre en blanco hasta que su dueño
 * rellena el perfil, así que `nombre` vacío es lo normal, no la excepción. Sin
 * este respaldo, sus comentarios y publicaciones salen sin firmar.
 *
 * Cae al usuario del correo antes que a "Usuario": es reconocible para quien
 * lo lee, y quien invitó sabe exactamente a quién corresponde.
 */
export function nombreVisible(nombre: string, email: string): string {
  const limpio = nombre.trim();
  if (limpio) return limpio;

  const usuario = email.split("@")[0]?.trim();
  return usuario || "Usuario";
}
