import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * La marca de una academia, leída DESDE EL SERVIDOR y sin sesión.
 *
 * Los layouts de `/c/[comunidad]`, `/login/[academia]` y la invitación la usan
 * para pintar el `<style>` del color y el título/favicon de la pestaña antes
 * de que exista un solo componente de cliente. Llama a las RPC públicas
 * (`marca_publica`, `invitacion_publica`) por GET y no por POST, a propósito:
 * son `stable` —PostgREST lo permite— y el `fetch` de Next solo memoiza y
 * cachea GET, y cada layout la pide dos veces por petición (una en
 * `generateMetadata`, otra en el render).
 *
 * Nunca lanza. La marca es decoración: sin red, sin fila o con la academia
 * suspendida se devuelve `null` y la página sale con la marca de Klaze. El
 * `AbortSignal.timeout` existe por lo mismo — una base lenta no puede dejar la
 * pantalla de entrada en blanco.
 */
export interface MarcaServidor {
  nombre: string;
  logoUrl: string | null;
  /** Icono de pestaña propio. Sin él, `iconoDeMarca` cae al logo. */
  faviconUrl: string | null;
  colorAcento: string | null;
}

/**
 * El icono que va a la pestaña: el favicon si el creador subió uno, y si no
 * el logo. Los tres layouts que pintan pestaña usan esto para no repetir el
 * orden de preferencia.
 */
export function iconoDeMarca(marca: MarcaServidor): string | null {
  return marca.faviconUrl ?? marca.logoUrl;
}

async function rpcPublica(
  fn: string,
  params: Record<string, string>
): Promise<Record<string, unknown> | null> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  try {
    const q = new URLSearchParams(params).toString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}?${q}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return null;
    const filas = (await r.json()) as Record<string, unknown>[];
    return filas?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function leerMarcaServidor(slug: string): Promise<MarcaServidor | null> {
  const f = await rpcPublica("marca_publica", { p_slug: slug });
  if (!f) return null;
  return {
    nombre: (f.nombre as string) ?? "",
    logoUrl: (f.logo_url as string) ?? null,
    faviconUrl: (f.favicon_url as string) ?? null,
    colorAcento: (f.color_acento as string) ?? null,
  };
}

export async function leerMarcaInvitacion(token: string): Promise<MarcaServidor | null> {
  const f = await rpcPublica("invitacion_publica", { p_token: token });
  if (!f) return null;
  return {
    nombre: (f.comunidad_nombre as string) ?? "",
    logoUrl: (f.comunidad_logo as string) ?? null,
    faviconUrl: (f.comunidad_favicon as string) ?? null,
    colorAcento: (f.comunidad_color as string) ?? null,
  };
}
