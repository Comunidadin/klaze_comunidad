import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Puntos por persona en una comunidad, opcionalmente acotados a un curso y a
 * una fecha.
 *
 * Existe como función de la base y no como consulta directa porque un alumno
 * debe ver la posición de sus compañeros pero **no puede leer su progreso** —
 * esa tabla es privada. Esta devuelve totales, nunca el detalle de qué lección
 * vio cada uno.
 *
 * Devuelve un `Map` porque quien la consume ya tiene la lista de miembros y
 * solo necesita cruzar puntos por identificador.
 */
export async function leerRanking(
  supabase: SupabaseClient,
  comunidadId: string,
  opciones: { desde?: Date | null; cursoId?: string } = {}
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("ranking_de_comunidad", {
    p_comunidad: comunidadId,
    p_desde: opciones.desde ? opciones.desde.toISOString() : null,
    p_curso: opciones.cursoId ?? null,
  });

  if (error) throw new Error(`No se pudo leer el ranking: ${error.message}`);

  return new Map(
    ((data ?? []) as { usuario_id: string; puntos: number }[]).map((r) => [
      r.usuario_id,
      r.puntos,
    ])
  );
}
