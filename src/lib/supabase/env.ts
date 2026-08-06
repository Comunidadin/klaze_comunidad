/**
 * Lectura y validación de las variables de entorno de Supabase.
 *
 * Ambas son `NEXT_PUBLIC_`, es decir que viajan al navegador. Eso es
 * correcto **solo** para la clave publicable (`sb_publishable_...`): está
 * pensada para ser pública y no da más permisos de los que las políticas
 * de la base concedan a quien inicia sesión. La clave secreta
 * (`sb_secret_...`) NUNCA se pone aquí ni en ninguna variable
 * `NEXT_PUBLIC_` — Supabase rechaza con 401 cualquier petición que la use
 * desde un navegador, precisamente para que un descuido no se convierta en
 * una fuga.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * `true` solo cuando las dos variables están presentes.
 *
 * Existe para que la app siga arrancando mientras el proyecto de Supabase
 * todavía no está creado: el `proxy` y los futuros hooks consultan esto y
 * se quedan quietos en vez de reventar. Sin esta guarda, un `.env.local`
 * ausente rompe todas las rutas en vez de degradar al modo de datos
 * locales que la demo usa hoy.
 */
export const supabaseConfigurado =
  SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;

/**
 * Falla ruidosamente y en español. Se llama desde los constructores de
 * cliente, que no tienen forma de funcionar a medias: si alguien los invoca
 * sin configuración, es un error de programación y conviene que se vea.
 */
export function exigirConfiguracion(): void {
  if (supabaseConfigurado) return;
  throw new Error(
    "Supabase no está configurado. Copia `.env.example` a `.env.local` y " +
      "rellena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
      "con los valores de tu proyecto (Dashboard → Project Settings → API Keys)."
  );
}
