import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lee una variable de servidor, del sitio donde de verdad esté.
 *
 * Hay dos sitios y no uno:
 *
 * - **`process.env`** tiene lo que existía al compilar, porque Next incrusta
 *   esos valores en el paquete. Por eso `SUPABASE_SECRET_KEY` y
 *   `RESEND_API_KEY` funcionaban en producción: están en `.env.local`, así que
 *   viajaron dentro del build.
 * - **El entorno del worker** tiene los secretos subidos con
 *   `wrangler secret put`. Esos no existían al compilar —que es justo para lo
 *   que sirven los secretos— así que en `process.env` no aparecen.
 *
 * Es **asíncrona a propósito**. La versión síncrona de `getCloudflareContext()`
 * lanza si el contexto todavía no está montado, y un `catch` alrededor lo
 * convertía en "no está configurado" sin decir por qué. Con `async: true` el
 * adaptador espera a tenerlo.
 *
 * Fuera de Cloudflare —`bun run dev`, las pruebas— no hay contexto y se cae a
 * `process.env`, que ahí sí tiene lo de `.env.local`.
 */
export async function variableServidor(nombre: string): Promise<string | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const valor = (env as Record<string, unknown>)?.[nombre];
    if (typeof valor === "string" && valor) return valor;
  } catch {
    // Sin worker no hay contexto. No es un error: toca mirar en `process.env`.
  }
  return process.env[nombre] || undefined;
}
