import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Arnés de las pruebas de aislamiento.
 *
 * OJO: `bun test` **no** carga `.env.local` por su cuenta — en entorno de
 * pruebas Bun se salta ese archivo a propósito. Por eso el script
 * `test:rls` pasa `--env-file=.env.local` explícitamente (la bandera
 * funciona aunque no aparezca en `bun test --help`). Sin ella, estas tres
 * variables llegan vacías y el arnés falla antes de la primera prueba.
 *
 * La clave secreta vive ahí y NO en una variable
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

  let { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // El proyecto es real y compartido: si una prueba anterior murio a medias,
  // sus usuarios siguen ahi y este correo ya existe. Se borra el resto y se
  // reintenta, para que una ejecucion rota no envenene a la siguiente.
  if (error?.message?.includes("already been registered")) {
    await borrarPorEmail(email);
    ({ data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    }));
  }

  if (error) throw new Error(`No se pudo crear ${email}: ${error.message}`);
  if (!data?.user) throw new Error(`Supabase no devolvio usuario para ${email}`);

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

/**
 * Borra un usuario por completo, incluidas las comunidades que posea.
 *
 * El orden importa: `comunidades.propietario_id` es ON DELETE RESTRICT a
 * proposito —borrar una cuenta no debe llevarse por delante una academia
 * entera— asi que mientras exista una comunidad suya, el usuario no se puede
 * borrar. Aqui se quita primero la comunidad; en produccion se traspasa.
 */
async function borrarPorEmail(email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const usuario = data?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (!usuario) return;
  await borrarUsuario(usuario.id);
}

async function borrarUsuario(id: string) {
  await admin.from("comunidades").delete().eq("propietario_id", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`No se pudo borrar el usuario ${id}: ${error.message}`);
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
  for (const id of ids) await borrarUsuario(id);
}
