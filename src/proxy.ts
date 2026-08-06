import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabaseConfigurado,
} from "@/lib/supabase/env";

/**
 * Refresca el token de sesión de Supabase en cada petición y reescribe las
 * cookies. Es obligatorio: los Server Components no pueden escribir
 * cookies, así que sin este archivo las sesiones caducan solas y el usuario
 * se ve expulsado sin motivo aparente.
 *
 * OJO — en Next.js 16 este archivo se llama `proxy.ts`. El nombre
 * `middleware.ts` quedó obsoleto y el framework ya no lo lee.
 *
 * No decide redirecciones por rol: eso lo siguen haciendo los 4 layouts de
 * grupo, que es donde vive esa lógica hoy (ver CLAUDE.md). Aquí solo se
 * mantiene viva la sesión.
 */
export async function proxy(request: NextRequest) {
  // Mientras no exista el proyecto de Supabase, dejar pasar la petición
  // intacta. Así la demo con datos locales sigue funcionando en vez de
  // romperse en todas las rutas por un `.env.local` que aún no existe.
  if (!supabaseConfigurado) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Esta llamada es la que dispara el refresco. No quitarla ni sustituirla
  // por una lectura de cookie: sin ella el token nunca se renueva.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  /**
   * Excluye estáticos e imágenes para no pagar un refresco de sesión por
   * cada icono. Todo lo demás pasa por aquí.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)",
  ],
};
