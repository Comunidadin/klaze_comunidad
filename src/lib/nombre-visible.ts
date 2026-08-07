/**
 * Nombre con el que mostrar a una persona.
 *
 * Una cuenta recién invitada tiene el nombre en blanco hasta que su dueño
 * rellena el perfil, así que `nombre` vacío es lo normal, no la excepción. Sin
 * este respaldo, sus comentarios y publicaciones salen sin firmar.
 *
 * Cae al usuario del correo antes que a "Usuario": es reconocible para quien
 * lo lee, y quien invitó sabe exactamente a quién corresponde.
 *
 * El segundo argumento admite el correo entero o solo la parte de delante de
 * la arroba. Eso no es laxitud: el directorio de miembros no recibe correos
 * —a un compañero de clase no le incumben— y solo puede dar el alias. Con una
 * firma más estrecha habría que repetir esta misma regla en SQL, y una regla
 * repetida es una regla que un día se corrige a medias.
 */
export function nombreVisible(nombre: string, correoOAlias: string): string {
  const limpio = nombre.trim();
  if (limpio) return limpio;

  const usuario = correoOAlias.split("@")[0]?.trim();
  return usuario || "Usuario";
}
