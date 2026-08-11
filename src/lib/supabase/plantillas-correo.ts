import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plantilla, TipoPlantilla } from "@/lib/plantillas";

/**
 * Las plantillas de correo guardadas de una academia.
 *
 * Solo las **guardadas**: si un tipo no tiene fila, es que usa la de por
 * defecto. Rellenar los huecos con los textos por defecto es cosa de quien
 * pinta —`leerPlantilla` en el servidor, el editor en el panel— y no de aquí,
 * porque son dos respuestas distintas a la misma pregunta: "¿la ha tocado?".
 *
 * Quién puede leerlas y escribirlas lo decide RLS. Aquí no se comprueba nada.
 */

export type PlantillasGuardadas = Partial<Record<TipoPlantilla, Plantilla>>;

export async function listarPlantillas(
  supabase: SupabaseClient,
  comunidadId: string
): Promise<PlantillasGuardadas> {
  const { data, error } = await supabase
    .from("plantillas_correo")
    .select("tipo, asunto, cuerpo")
    .eq("comunidad_id", comunidadId);

  if (error) {
    throw new Error(`No se pudieron leer las plantillas: ${error.message}`);
  }

  const guardadas: PlantillasGuardadas = {};
  for (const fila of data ?? []) {
    guardadas[fila.tipo as TipoPlantilla] = {
      asunto: fila.asunto,
      cuerpo: fila.cuerpo,
    };
  }
  return guardadas;
}

export async function guardarPlantilla(
  supabase: SupabaseClient,
  comunidadId: string,
  tipo: TipoPlantilla,
  plantilla: Plantilla
): Promise<void> {
  const { data, error } = await supabase
    .from("plantillas_correo")
    .upsert(
      {
        comunidad_id: comunidadId,
        tipo,
        asunto: plantilla.asunto.trim(),
        cuerpo: plantilla.cuerpo.trim(),
        actualizada_el: new Date().toISOString(),
      },
      { onConflict: "comunidad_id,tipo" }
    )
    .select("tipo");

  if (error) throw new Error(`No se pudo guardar el correo: ${error.message}`);
  // RLS no lanza: filtra. Un upsert rechazado por política vuelve vacío y sin
  // error, y devolverlo en silencio diría "guardado" sin haber guardado nada.
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar el correo: sin permiso sobre esa academia");
  }
}

/**
 * Borra la fila para volver al texto por defecto.
 *
 * Y no guardar una copia del texto por defecto, que es lo que parecería
 * equivalente: sin fila, el correo mejora solo cuando mejoremos el original.
 * Con una copia, se quedaría congelado el del día que pulsó el botón.
 */
export async function restaurarPlantilla(
  supabase: SupabaseClient,
  comunidadId: string,
  tipo: TipoPlantilla
): Promise<void> {
  const { error } = await supabase
    .from("plantillas_correo")
    .delete()
    .eq("comunidad_id", comunidadId)
    .eq("tipo", tipo);

  // Sin comprobar filas: borrar lo que ya no está es el resultado que se
  // buscaba, no un fallo.
  if (error) throw new Error(`No se pudo restaurar: ${error.message}`);
}
