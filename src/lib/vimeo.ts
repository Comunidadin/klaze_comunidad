// Utilidades para trabajar con IDs de video de Vimeo a partir de distintos
// formatos de entrada (ID plano, URL corta, URL con query, URL de player).

const VIMEO_ID_PATTERN = /(?:^|\/\/|\.)vimeo\.com\/(?:video\/)?(\d+)/;

/**
 * Extrae el ID numérico de Vimeo de un input arbitrario.
 * Acepta: "123456789", "vimeo.com/123456789",
 * "https://vimeo.com/123456789?x=1", "player.vimeo.com/video/123456789".
 * Retorna null si no se puede reconocer un ID.
 */
export function extractVimeoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(VIMEO_ID_PATTERN);
  return match ? match[1] : null;
}

/** URL de embed del player de Vimeo para un ID dado. */
export function vimeoEmbedUrl(id: string): string {
  return `https://player.vimeo.com/video/${id}`;
}
