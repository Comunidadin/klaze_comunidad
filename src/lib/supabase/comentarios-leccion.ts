import type { SupabaseClient } from "@supabase/supabase-js";
import { nombreVisible } from "@/lib/nombre-visible";
import { nivelPorPuntos } from "@/lib/levels";

export interface ComentarioLeccion {
  id: string;
  autorId: string;
  autorNombre: string;
  autorAvatar: string;
  /** Nivel del autor, derivado de sus puntos al leer. */
  autorNivel: number;
  cuerpo: string;
  /** `null` para los de primer nivel; el id de su raíz para las respuestas. */
  padreId: string | null;
  creadoEl: string;
}

interface FilaPerfilAutor {
  nombre: string;
  email: string;
  avatar_url: string;
}

/**
 * Comentarios de una lección, del más antiguo al más nuevo.
 *
 * A diferencia del feed, aquí no hay paginación: los comentarios de una clase
 * son docenas, no miles, y partirlos costaría más de lo que ahorra.
 *
 * El nombre de la clave foránea es obligatorio aunque hoy solo haya un camino
 * a `perfiles`: el día que esta tabla gane otra referencia, sin él la consulta
 * se rompe entera con "more than one relationship was found" — que es
 * exactamente lo que pasó en el feed.
 */
export async function leerComentarios(
  supabase: SupabaseClient,
  leccionId: string,
  /** Puntos por usuario en ESTA academia (`leerRanking`) — de ahí el nivel. */
  puntosPor: Map<string, number>
): Promise<ComentarioLeccion[]> {
  const { data, error } = await supabase
    .from("comentarios_leccion")
    .select(
      "id, autor_id, cuerpo, padre_id, creado_el, perfiles!comentarios_leccion_autor_id_fkey ( nombre, email, avatar_url )"
    )
    .eq("leccion_id", leccionId)
    .order("creado_el", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron leer los comentarios: ${error.message}`);
  }

  return (data ?? []).map((f) => {
    const perfil = (Array.isArray(f.perfiles) ? f.perfiles[0] : f.perfiles) as
      | FilaPerfilAutor
      | undefined;
    return {
      id: f.id,
      autorId: f.autor_id,
      autorNombre: nombreVisible(perfil?.nombre ?? "", perfil?.email ?? ""),
      autorAvatar: perfil?.avatar_url ?? "",
      autorNivel: nivelPorPuntos(puntosPor.get(f.autor_id) ?? 0),
      cuerpo: f.cuerpo,
      padreId: f.padre_id,
      creadoEl: f.creado_el,
    };
  });
}

/**
 * El autor sale de la sesión: no existe forma de comentar a nombre de otro.
 *
 * Lanza si la política lo rechaza — comentar en una lección a la que no tienes
 * acceso — en vez de fallar en silencio y dejar creer que se guardó.
 */
export async function comentarLeccion(
  supabase: SupabaseClient,
  leccionId: string,
  cuerpo: string,
  padreId: string | null
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const autorId = sesion.user?.id;
  if (!autorId) throw new Error("Comentar requiere una sesión activa");

  const { data, error } = await supabase
    .from("comentarios_leccion")
    .insert({ leccion_id: leccionId, autor_id: autorId, cuerpo, padre_id: padreId })
    .select("id");

  if (error) throw new Error(`No se pudo comentar: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo comentar: sin acceso a esa lección");
  }
}

/** Borra un comentario. La política permite a su autor y al dueño. */
export async function eliminarComentarioLeccion(
  supabase: SupabaseClient,
  comentarioId: string
): Promise<void> {
  const { error } = await supabase
    .from("comentarios_leccion")
    .delete()
    .eq("id", comentarioId);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
}
