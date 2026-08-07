import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lee una variable de servidor, del sitio donde de verdad esté.
 *
 * Hay dos sitios y no uno, y confundirlos costó un rato:
 *
 * - **`process.env`** tiene lo que existía al compilar, porque Next incrusta
 *   esos valores en el paquete. Por eso `SUPABASE_SECRET_KEY` y
 *   `RESEND_API_KEY` funcionaban en producción: están en `.env.local`, así
 *   que viajaron dentro del build.
 * - **El entorno del worker** tiene los secretos que se subieron con
 *   `wrangler secret put`. Esos NO estaban al compilar, así que en
 *   `process.env` no aparecen: en producción llegan vacíos y la app dice que
 *   no está configurada.
 *
 * `OPENAI_API_KEY` era del segundo tipo, y ese es exactamente el caso para el
 * que existen los secretos: que no haga falta tenerlos en la máquina de quien
 * compila.
 *
 * Se mira primero el worker y después `process.env`, para que en local —donde
 * no hay worker— siga funcionando `.env.local`.
 */
export function variableServidor(nombre: string): string | undefined {
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    const valor = env?.[nombre];
    if (typeof valor === "string" && valor) return valor;
  } catch {
    // Fuera de Cloudflare —`bun run dev`, las pruebas— no hay contexto y lanza.
    // No es un error: significa que toca mirar en `process.env`.
  }
  return process.env[nombre] || undefined;
}
