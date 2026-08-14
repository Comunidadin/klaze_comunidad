"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  comentarLeccion,
  leerComentarios,
  type ComentarioLeccion,
} from "@/lib/supabase/comentarios-leccion";
import { leerRanking } from "@/lib/supabase/ranking";
import type { User } from "@/lib/types";

/**
 * Comentario listo para pintar.
 *
 * Conserva la forma `{ autor: User }` que ya consume la pantalla de lección,
 * aunque de la base solo lleguen nombre y avatar: rellenar el resto con
 * valores neutros sale más barato que reescribir el componente.
 */
export interface LessonCommentConAutor {
  id: string;
  autor: User;
  cuerpo: string;
  creadoEl: string;
  /** `null` en los de primer nivel; el id de su raíz en las respuestas. */
  padreId: string | null;
}

function aComentario(c: ComentarioLeccion): LessonCommentConAutor {
  return {
    id: c.id,
    autor: {
      id: c.autorId,
      email: "",
      nombre: c.autorNombre,
      avatarUrl: c.autorAvatar,
      bio: "",
      rol: "alumno",
      comunidadIds: [],
      puntos: 0,
      nivel: c.autorNivel,
      creadoEl: "",
    },
    cuerpo: c.cuerpo,
    creadoEl: c.creadoEl,
    padreId: c.padreId,
  };
}

export interface UseLessonCommentsResult {
  comentarios: LessonCommentConAutor[];
  cargando: boolean;
  /**
   * Publica un comentario. Ya no recibe el `userId`: el autor sale de la
   * sesión, así que no existe forma de firmar a nombre de otro.
   */
  agregar: (cuerpo: string, padreId?: string | null) => Promise<void>;
}

/**
 * Es `async` aunque la rama sin lección no espere nada, para que el `.then()`
 * que fija el estado no corra de forma síncrona dentro del efecto.
 */
async function leer(
  leccionId: string,
  comunidadId: string
): Promise<LessonCommentConAutor[]> {
  if (!leccionId) return [];
  const supabase = crearClienteNavegador();
  // El nivel junto a cada autor es el de ESTA academia (ranking derivado);
  // el contador global del perfil se retiro con multi-academia.
  const puntosPor = comunidadId ? await leerRanking(supabase, comunidadId) : new Map<string, number>();
  const lista = await leerComentarios(supabase, leccionId, puntosPor);
  return lista.map(aComentario);
}

/**
 * Comentarios de una lección.
 *
 * Antes eran decorado: se generaban de un cálculo sobre el identificador de la
 * lección, aparecían solo en el curso 1, y escribir uno y recargar lo borraba.
 * Ahora viven en su propia tabla, con los mismos permisos que el feed.
 */
export function useLessonComments(leccionId: string, comunidadId: string): UseLessonCommentsResult {
  // El estado guarda DE QUÉ lección son los comentarios, no solo los
  // comentarios. Así "está cargando" se deriva de comparar identificadores en
  // vez de fijarse a mano, y al navegar a otra lección no se ven un instante
  // los comentarios de la anterior bajo el vídeo nuevo.
  const [estado, setEstado] = useState<{
    leccionId: string;
    lista: LessonCommentConAutor[];
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    void leer(leccionId, comunidadId).then((lista) => {
      if (vivo) setEstado({ leccionId, lista });
    });
    return () => {
      vivo = false;
    };
  }, [leccionId, comunidadId]);

  const agregar = useCallback(
    async (cuerpo: string, padreId: string | null = null) => {
      await comentarLeccion(crearClienteNavegador(), leccionId, cuerpo, padreId);
      setEstado({ leccionId, lista: await leer(leccionId, comunidadId) });
    },
    [leccionId, comunidadId]
  );

  const alDia = estado?.leccionId === leccionId;

  return {
    comentarios: alDia ? estado.lista : [],
    cargando: !alDia,
    agregar,
  };
}
