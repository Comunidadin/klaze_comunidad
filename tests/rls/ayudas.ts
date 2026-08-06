import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Arnés de las pruebas de aislamiento.
 *
 * Bun carga `.env.local` solo, así que estas variables llegan sin
 * configuración extra. La clave secreta vive ahí y NO en una variable
 * `NEXT_PUBLIC_`: se salta todas las políticas RLS, y solo se usa para
 * montar el escenario de cada prueba, nunca para comprobar el resultado.
 * Si se usara para comprobar, las pruebas pasarían siempre y no
 * demostrarían nada.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLICABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRETA = process.env.SUPABASE_SECRET_KEY!;

if (!URL || !PUBLICABLE || !SECRETA) {
  throw new Error(
    "Faltan variables de entorno. Las pruebas de RLS necesitan " +
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y " +
      "SUPABASE_SECRET_KEY en `.env.local`. La secreta se saca del panel " +
      "(Project Settings → API Keys) y nunca se versiona."
  );
}

/** Cliente con clave secreta: se salta RLS. Solo para montar el escenario. */
export const admin = createClient(URL, SECRETA, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Crea un usuario confirmado y devuelve un cliente ya autenticado como él.
 *
 * Usa contraseña aunque la app entre por enlace de correo: la API de
 * administración la admite, y es la única forma de conseguir una sesión
 * dentro de una prueba sin tener que leer un buzón.
 */
export async function comoUsuario(
  email: string
): Promise<{ id: string; cliente: SupabaseClient }> {
  const password = "prueba-" + email;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`No se pudo crear ${email}: ${error.message}`);

  const cliente = createClient(URL, PUBLICABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: errorSesion } = await cliente.auth.signInWithPassword({
    email,
    password,
  });
  if (errorSesion) {
    throw new Error(`No se pudo entrar como ${email}: ${errorSesion.message}`);
  }

  return { id: data.user.id, cliente };
}

/** Cliente sin sesión. Para las pruebas de acceso público. */
export function comoAnonimo(): SupabaseClient {
  return createClient(URL, PUBLICABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Borra los usuarios creados por una prueba. Llamar siempre en el cierre:
 * el proyecto es real y compartido, y los restos de una prueba rota hacen
 * fallar a la siguiente por correo duplicado.
 */
export async function limpiarUsuarios(ids: string[]) {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}
