import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  exigirConfiguracion,
} from "@/lib/supabase/env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Hay que crear uno nuevo **en cada render** — nunca compartir la
 * instancia entre peticiones, porque lleva colgada la sesión de un usuario
 * concreto.
 *
 * OJO — este proyecto NO tiene `proxy.ts`, y es deliberado. La guía de
 * Supabase pide uno para refrescar la sesión, pero en Next 16 el proxy corre
 * obligatoriamente en Node (`runtime` no es configurable ahí) y el adaptador
 * de Cloudflare rechaza el middleware de Node: con `proxy.ts` presente, el
 * build para Workers falla.
 *
 * Se puede prescindir de él porque el diseño no lee Supabase desde Server
 * Components: la app consulta desde el navegador y el aislamiento lo aplica
 * RLS. `createBrowserClient` refresca su propio token.
 *
 * Consecuencia para quien use este cliente: en un Route Handler, la sesión
 * de la cookie puede venir caducada. Si eso importa, que el cliente mande el
 * token en la cabecera `Authorization` en vez de confiar en la cookie.
 *
 * El `setAll` va en try/catch porque desde un Server Component Next no
 * permite escribir cookies y lanza.
 */
export async function crearClienteServidor() {
  exigirConfiguracion();
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component: el proxy se encarga. Ver docstring.
        }
      },
    },
  });
}
