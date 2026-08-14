import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/types";

/**
 * Edita el perfil de quien está en sesión.
 *
 * El identificador no se recibe como parámetro: sale de la sesión. La política
 * además lo exige, así que hay dos barreras — pero la de aquí hace que ni
 * siquiera exista una forma de pedir "edita el perfil de aquel".
 */
export async function actualizarPerfil(
  supabase: SupabaseClient,
  cambios: { nombre: string; bio: string; avatarUrl?: string }
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const id = sesion.user?.id;
  if (!id) throw new Error("Editar el perfil requiere una sesión activa");

  const { error } = await supabase
    .from("perfiles")
    .update({
      nombre: cambios.nombre,
      bio: cambios.bio,
      // Solo si viene: mandarlo siempre borraría el avatar de quien guarda
      // el formulario sin haberlo tocado.
      ...(cambios.avatarUrl !== undefined ? { avatar_url: cambios.avatarUrl } : {}),
    })
    .eq("id", id);

  if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`);
}

export type CambiosComunidad = Partial<
  Pick<
    Community,
    | "nombre"
    | "slug"
    | "logoUrl"
    | "faviconUrl"
    | "colorAcento"
    | "nombresNiveles"
    | "marcaAuth"
    | "nombreIa"
    | "avatarIa"
    | "encuestaUrl"
    | "encuestaObligatoria"
  >
>;

/**
 * Cambia los datos de una academia.
 *
 * Solo se envían los campos presentes: mandar el objeto entero sobrescribiría
 * con `undefined` lo que la pantalla no editaba.
 *
 * Lanza si la política lo rechaza. RLS no lanza —filtra— así que sin esta
 * comprobación un alumno vería "guardado" sin que cambiara nada.
 */
export async function guardarComunidad(
  supabase: SupabaseClient,
  comunidadId: string,
  cambios: CambiosComunidad
): Promise<void> {
  const fila: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) fila.nombre = cambios.nombre;
  // El trigger `congelar_slug_con_alumnos` rechaza este cambio en cuanto la
  // academia tiene alumnos, y ese rechazo sí llega como error: es una excepción
  // de Postgres, no un filtro de RLS.
  if (cambios.slug !== undefined) fila.slug = cambios.slug;
  if (cambios.logoUrl !== undefined) fila.logo_url = cambios.logoUrl;
  // Vacío significa "quitar el favicon": se guarda null y la pestaña vuelve
  // a caer al logo.
  if (cambios.faviconUrl !== undefined) fila.favicon_url = cambios.faviconUrl || null;
  if (cambios.colorAcento !== undefined) fila.color_acento = cambios.colorAcento;
  if (cambios.nombresNiveles !== undefined) fila.nombres_niveles = cambios.nombresNiveles;
  if (cambios.marcaAuth !== undefined) fila.marca_auth = cambios.marcaAuth;
  if (cambios.nombreIa !== undefined) fila.nombre_ia = cambios.nombreIa.trim() || null;
  if (cambios.avatarIa !== undefined) fila.avatar_ia = cambios.avatarIa.trim() || null;
  if (cambios.encuestaUrl !== undefined) fila.encuesta_url = cambios.encuestaUrl || null;
  if (cambios.encuestaObligatoria !== undefined) {
    fila.encuesta_obligatoria = cambios.encuestaObligatoria;
  }

  if (Object.keys(fila).length === 0) return;

  const { data, error } = await supabase
    .from("comunidades")
    .update(fila)
    .eq("id", comunidadId)
    .select("id");

  if (error) throw new Error(`No se pudo guardar la academia: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar la academia: no es tuya");
  }
}
