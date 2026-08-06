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
 * El `setAll` va envuelto en try/catch a propósito: desde un Server
 * Component, Next no permite escribir cookies y lanza. No es un fallo — el
 * refresco de sesión lo hace `src/proxy.ts`, que sí puede escribirlas. Sin
 * ese proxy, ignorar el error aquí sí causaría cierres de sesión aleatorios.
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
