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

  // El embed "live" de Typeform no trae iframe: es un div con el
  // identificador del formulario (y un script, que aquí muere como todos).
  // Ese identificador ES el formulario: https://form.typeform.com/to/{id}.
  const tfLive = limpio.match(/data-tf-live=["']([A-Za-z0-9]+)["']/i)?.[1];
  if (tfLive) return `https://form.typeform.com/to/${tfLive}`;

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
