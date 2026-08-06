/**
 * Genera un enlace de acceso para un correo, sin enviar ningún correo.
 *
 *   bun run enlace-acceso -- --email jefe@empresa.com
 *   bun run enlace-acceso -- --email jefe@empresa.com --url https://mi-app.com
 *
 * Sirve para entrar mientras el emisor de correo no está configurado, y para
 * depurar sin pelearse con la bandeja de entrada.
 *
 * OJO: el enlace que imprime **es** la sesión. Quien lo tenga entra como esa
 * persona hasta que caduque. No lo pegues en un chat ni en un ticket.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secreta = process.env.SUPABASE_SECRET_KEY;
if (!url || !secreta) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en `.env.local`."
  );
}

const args = process.argv.slice(2);
const valor = (nombre: string) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const email = valor("email");
const base = valor("url") ?? "http://localhost:3000";

if (!email) {
  console.error("Uso: bun run enlace-acceso -- --email jefe@empresa.com [--url https://...]");
  process.exit(1);
}

const supabase = createClient(url, secreta, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: `${base}/callback` },
});

if (error) {
  console.error(`No se pudo generar el enlace: ${error.message}`);
  process.exit(1);
}

console.log(`\nEnlace de acceso para ${email}:\n`);
console.log(data.properties.action_link);
console.log("\nCaduca en una hora. Abrelo en el navegador y entraras directo.\n");
process.exit(0);
