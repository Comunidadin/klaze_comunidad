import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunitySection } from "@/lib/types";

interface FilaEspacio {
  id: string;
  slug: string;
  nombre: string;
  icono: string;
  orden: number;
  solo_lectura: boolean;
}

/**
 * Secciones de la academia con sus espacios, en orden.
 *
 * PostgREST no garantiza el orden de las filas anidadas, así que los espacios
 * se ordenan aquí aunque las secciones ya vengan ordenadas por la consulta.
 */
export async function leerSecciones(
  supabase: SupabaseClient,
  comunidadId: string
): Promise<CommunitySection[]> {
  const { data, error } = await supabase
    .from("secciones")
    .select("id, titulo, orden, espacios ( id, slug, nombre, icono, orden, solo_lectura )")
    .eq("comunidad_id", comunidadId)
    .order("orden");

  if (error) throw new Error(`No se pudieron leer los espacios: ${error.message}`);

  return (data ?? []).map((s) => ({
    id: s.id,
    titulo: s.titulo,
    orden: s.orden,
    espacios: ((s.espacios ?? []) as FilaEspacio[])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        nombre: e.nombre,
        icono: e.icono,
        orden: e.orden,
        soloLectura: e.solo_lectura,
      })),
  }));
}

/**
 * Guarda la estructura completa de espacios de la academia.
 *
 * Borra lo que ya no está, igual que `guardarCurso`: sin esa limpieza, quitar
 * un espacio en el editor no lo quitaría de la base y reaparecería al recargar.
 * Los espacios de una sección eliminada caen por cascada.
 *
 * Lanza si la política rechaza la escritura. RLS no lanza —filtra— así que sin
 * esta comprobación un alumno vería "guardado" sin que se guardara nada.
 */
export async function guardarSecciones(
  supabase: SupabaseClient,
  comunidadId: string,
  secciones: CommunitySection[]
): Promise<void> {
  const ids = secciones.map((s) => s.id);
  const borrar = supabase.from("secciones").delete().eq("comunidad_id", comunidadId);
  const { error: errBorrar } = ids.length
    ? await borrar.not("id", "in", `(${ids.join(",")})`)
    : await borrar;
  if (errBorrar) {
    throw new Error(`No se pudieron limpiar los espacios: ${errBorrar.message}`);
  }

  if (secciones.length === 0) return;

  const { data: guardadas, error: errSec } = await supabase
    .from("secciones")
    .upsert(
      secciones.map((s) => ({
        id: s.id,
        comunidad_id: comunidadId,
        titulo: s.titulo,
        orden: s.orden,
      }))
    )
    .select("id");

  if (errSec) throw new Error(`No se pudieron guardar las secciones: ${errSec.message}`);
  if (!guardadas || guardadas.length === 0) {
    throw new Error("No se pudieron guardar los espacios: sin permiso sobre esa academia");
  }

  for (const seccion of secciones) {
    const idsEsp = seccion.espacios.map((e) => e.id);
    const borrarEsp = supabase.from("espacios").delete().eq("seccion_id", seccion.id);
    const { error: e1 } = idsEsp.length
      ? await borrarEsp.not("id", "in", `(${idsEsp.join(",")})`)
      : await borrarEsp;
    if (e1) throw new Error(`No se pudieron limpiar los espacios: ${e1.message}`);

    if (seccion.espacios.length === 0) continue;

    const { error: e2 } = await supabase.from("espacios").upsert(
      seccion.espacios.map((e) => ({
        id: e.id,
        seccion_id: seccion.id,
        slug: e.slug,
        nombre: e.nombre,
        icono: e.icono,
        orden: e.orden,
        solo_lectura: e.soloLectura ?? false,
      }))
    );
    if (e2) throw new Error(`No se pudieron guardar los espacios: ${e2.message}`);
  }
}
