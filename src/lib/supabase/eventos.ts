import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityEvent } from "@/lib/types";

/**
 * Eventos de un curso, del más próximo al más lejano.
 *
 * Devuelve `comunidadId` vacío: la tabla no lo guarda porque el evento cuelga
 * del curso, y el curso de la comunidad. El tipo lo exige por historia, y
 * ningún consumidor lo lee desde que el calendario vive dentro del curso.
 */
export async function leerEventos(
  supabase: SupabaseClient,
  cursoId: string
): Promise<CommunityEvent[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select("id, curso_id, titulo, descripcion, fecha_inicio, duracion_min, url_sala")
    .eq("curso_id", cursoId)
    .order("fecha_inicio");

  if (error) throw new Error(`No se pudieron leer los eventos: ${error.message}`);

  return (data ?? []).map((f) => ({
    id: f.id,
    comunidadId: "",
    cursoId: f.curso_id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    fechaInicio: f.fecha_inicio,
    duracionMin: f.duracion_min,
    urlSala: f.url_sala,
  }));
}

/**
 * Crea o actualiza un evento.
 *
 * Lanza si la política lo rechaza. RLS no lanza —filtra— así que sin esta
 * comprobación un alumno vería "evento guardado" sin que existiera.
 */
export async function guardarEvento(
  supabase: SupabaseClient,
  evento: CommunityEvent
): Promise<void> {
  const { data, error } = await supabase
    .from("eventos")
    .upsert({
      id: evento.id,
      curso_id: evento.cursoId,
      titulo: evento.titulo,
      descripcion: evento.descripcion,
      fecha_inicio: evento.fechaInicio,
      duracion_min: evento.duracionMin,
      url_sala: evento.urlSala,
    })
    .select("id");

  if (error) throw new Error(`No se pudo guardar el evento: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar el evento: sin permiso sobre ese curso");
  }
}

export async function eliminarEvento(
  supabase: SupabaseClient,
  eventoId: string
): Promise<void> {
  const { error } = await supabase.from("eventos").delete().eq("id", eventoId);
  if (error) throw new Error(`No se pudo eliminar el evento: ${error.message}`);
}
