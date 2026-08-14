/**
 * Del código de incrustación pegado, SOLO la URL.
 *
 * El creador pega lo que Typeform (o Google Forms, o Tally…) le dio — un
 * `<iframe …>` entero, el embed «live» nuevo de Typeform (un `div` con
 * `data-tf-live` + script) o la URL a secas. Aquí se extrae la dirección y se
 * valida que sea `https`: el HTML nunca se guarda ni se inyecta, así que un
 * script dentro del código pegado muere en este archivo. El iframe lo
 * construye Klaze con sus propios permisos.
 */

/** El identificador del embed «live» de Typeform, si el texto lo trae. */
export function idTfLive(texto: string): string | null {
  return texto.match(/data-tf-live=["']([A-Za-z0-9]+)["']/i)?.[1] ?? null;
}

/** El id de formulario (`data-tf-widget`) dentro del HTML que devuelve la API. */
export function idTfWidget(html: string): string | null {
  return html.match(/data-tf-widget=["']([A-Za-z0-9]+)["']/i)?.[1] ?? null;
}

/** Un `<iframe src>` o una URL a secas → la URL, solo si es https. */
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

/**
 * La resolución completa, con red cuando hace falta.
 *
 * El id «live» de Typeform NO es el id del formulario: es una indirección
 * que su propia API traduce (`/single-embed/{id}` → HTML con
 * `data-tf-widget="idReal"`). Se resuelve UNA VEZ aquí, al guardar, y lo que
 * viaja a la base es la URL final — el popup de los alumnos no depende de la
 * API de Typeform en cada visita.
 */
export async function resolverEmbed(texto: string): Promise<string | null> {
  const live = idTfLive(texto);
  if (live) {
    try {
      const r = await fetch(`https://api.typeform.com/single-embed/${live}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) return null;
      const { html } = (await r.json()) as { html?: string };
      const widget = idTfWidget(html ?? "");
      return widget ? `https://form.typeform.com/to/${widget}` : null;
    } catch {
      return null;
    }
  }

  return urlDeEmbed(texto);
}
