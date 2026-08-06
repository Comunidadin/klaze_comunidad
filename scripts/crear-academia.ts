/**
 * Da de alta una academia desde la terminal: la cuenta del dueño, su perfil
 * como creador y la comunidad.
 *
 *   bun run crear-academia -- --email jefe@empresa.com --empresa "Mi Empresa" --slug mi-empresa
 *
 * La lógica vive en `src/lib/academia.ts`, compartida con `POST /api/academias`
 * —la pantalla de alta del superadmin— para que las dos no diverjan. Este
 * archivo es solo la envoltura de línea de comandos: lee argumentos, construye
 * el cliente con la clave secreta e imprime el resultado.
 *
 * Sigue existiendo aunque la pantalla ya lo haga: si la app no arranca o la
 * sesión del superadmin se pierde, esta es la puerta de atrás para dejar la
 * base en un estado del que la app pueda partir.
 */
import { createClient } from "@supabase/supabase-js";
import { crearAcademia } from "../src/lib/academia";

function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreta) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en `.env.local`."
    );
  }
  return createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const valor = (nombre: string) => {
    const i = args.indexOf(`--${nombre}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const email = valor("email");
  const empresa = valor("empresa");
  const slug = valor("slug");

  if (!email || !empresa || !slug) {
    console.error(
      'Uso: bun run crear-academia -- --email jefe@empresa.com --empresa "Mi Empresa" --slug mi-empresa'
    );
    process.exit(1);
  }

  const r = await crearAcademia(clienteAdmin(), { email, empresa, slug });

  if (r.yaExistia) {
    console.log(`La academia "${slug}" ya existia. No se ha tocado nada.`);
  } else {
    console.log("Academia creada.");
    console.log(`  comunidad: ${r.comunidadId}`);
    console.log(`  dueno:     ${r.usuarioId}`);
    if (r.passwordTemporal) {
      console.log(`\n  Entra en /login con ${email}`);
      console.log(`  Contrasena temporal: ${r.passwordTemporal}`);
      console.log("  No se guarda en ningun sitio: apuntala ahora.");
    } else {
      console.log(`\n${email} ya tenia cuenta: entra con su contrasena de siempre.`);
    }
  }
  process.exit(0);
}
