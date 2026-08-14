/**
 * Del código de incrustación pegado, SOLO la URL.
 *
 * El creador pega lo que Typeform (o Google Forms, o Tally…) le dio — un
 * `<iframe …>` entero o la URL a secas. Aquí se extrae el `src` y se valida
 * que sea `https`: el HTML nunca se guarda ni se inyecta, así que un script
 * dentro del código pegado muere en este archivo. El iframe lo construye
 * Klaze con sus propios permisos.
 */
export function urlDeEmbed(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return null;

  // ¿Vino un <iframe …>? El src es lo único que interesa.
  const src = limpio.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1] ?? limpio;

  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
