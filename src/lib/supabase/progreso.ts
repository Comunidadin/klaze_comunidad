import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Marca o desmarca una lección para el usuario de la sesión.
 *
 * El `usuario_id` no se recibe como parámetro a propósito: sale de la sesión.
 * La política de `progreso` exige además que coincida con `auth.uid()`, así que
 * hay dos barreras — pero la de aquí es la que hace que ni siquiera exista una
 * forma de pedir "marca esta lección a nombre de otro".
 *
 * Desmarcar borra la fila en vez de guardar un `false`. El progreso es un
 * conjunto de lecciones vistas, no un estado por lección: guardar los "no
 * vistas" llenaría la tabla de filas que no dicen nada.
 */
export async function marcarLeccion(
  supabase: SupabaseClient,
  leccionId: string,
  completada: boolean
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const usuarioId = sesion.user?.id;
  if (!usuarioId) throw new Error("marcarLeccion requiere una sesión activa");

  const { error } = completada
    ? await supabase
        .from("progreso")
        .upsert({ usuario_id: usuarioId, leccion_id: leccionId })
    : await supabase
        .from("progreso")
        .delete()
        .eq("usuario_id", usuarioId)
        .eq("leccion_id", leccionId);

  if (error) throw new Error(`No se pudo guardar el progreso: ${error.message}`);
}
