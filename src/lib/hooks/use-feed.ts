"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { leerFijado, leerPagina, POR_PAGINA } from "@/lib/supabase/feed";
import { leerRanking } from "@/lib/supabase/ranking";
import type { Post } from "@/lib/types";
import type { PostConAutor } from "@/lib/supabase/feed";

export type { PostConAutor } from "@/lib/supabase/feed";

/** Cuenta comentarios raíz + respuestas (modelo fijo de 2 niveles). */
export function contarComentariosPost(post: Pick<Post, "comentarios">): number {
  return post.comentarios.reduce((total, raiz) => total + 1 + raiz.respuestas.length, 0);
}

export interface UseFeedResult {
  /** Publicaciones cargadas, de más nueva a más vieja. Sin la fijada. */
  posts: PostConAutor[];
  /** La publicación fijada del curso, si la hay. Va aparte de la paginación. */
  fijado: PostConAutor | null;
  cargando: boolean;
  /** `true` si la última página vino llena: puede haber más. */
  hayMas: boolean;
  cargarMas: () => Promise<void>;
  recargar: () => Promise<void>;
}

/**
 * Es `async` aunque la rama sin academia no espere nada, para que el `setState`
 * de quien la llama nunca corra de forma síncrona dentro del efecto.
 */
async function leerTodo(
  comunidadId: string,
  espacioId: string | undefined
): Promise<{
  pagina: PostConAutor[];
  elFijado: PostConAutor | null;
  puntosPor: Map<string, number>;
}> {
  if (!comunidadId) return { pagina: [], elFijado: null, puntosPor: new Map() };

  const supabase = crearClienteNavegador();
  // Los niveles junto a cada autor salen del ranking DE ESTA academia — el
  // contador global del perfil se retiró con multi-academia. Primero el mapa,
  // porque las páginas lo necesitan para armar cada post.
  const puntosPor = await leerRanking(supabase, comunidadId);
  const [pagina, elFijado] = await Promise.all([
    leerPagina(supabase, { comunidadId, espacioId }, null, puntosPor),
    leerFijado(supabase, comunidadId, puntosPor),
  ]);

  return { pagina, elFijado, puntosPor };
}

/**
 * El feed de la academia, opcionalmente acotado a un espacio.
 *
 * Recibía además un `cursoId` y una lista de cursos, porque cada módulo tenía
 * su propio feed y `/admin/comunidad` moderaba el de todos a la vez. Al subir
 * la comunidad al nivel de la academia, la pantalla del alumno y la del panel
 * piden lo mismo, y toda esa maquinaria —la clave de cursos, la referencia
 * estable del array vacío— se fue con ella.
 *
 * Es el primer hook que rompe la firma síncrona del proyecto, y es deliberado:
 * el feed crece sin techo, así que no viaja en el armazón como el resto. Aquí
 * el estado de carga sí es información que la pantalla necesita.
 *
 * El orden es siempre por fecha descendente. La opción de "más comentado"
 * desapareció: ordenar así un feed paginado exige contar comentarios en la
 * base, y hacerlo sobre lo ya cargado daría un orden que cambia según cuánto
 * hayas bajado — un control que miente es peor que uno que no está.
 */
export function useFeed(comunidadId: string, espacioId?: string): UseFeedResult {
  const [posts, setPosts] = useState<PostConAutor[]>([]);
  const [fijado, setFijado] = useState<PostConAutor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  // Ref y no estado: `cargarMas` lo necesita pero pintar no depende de él.
  const puntosPorRef = useRef<Map<string, number>>(new Map());

  const recargar = useCallback(async () => {
    const { pagina, elFijado, puntosPor } = await leerTodo(comunidadId, espacioId);
    puntosPorRef.current = puntosPor;
    setPosts(pagina);
    setFijado(elFijado);
    setHayMas(pagina.length === POR_PAGINA);
    setCargando(false);
  }, [comunidadId, espacioId]);

  useEffect(() => {
    let vivo = true;
    // Se llama a `leerTodo` y no a `recargar` para que el `setState` viva en un
    // `.then()` y nunca corra de forma síncrona dentro del efecto.
    void leerTodo(comunidadId, espacioId).then(({ pagina, elFijado, puntosPor }) => {
      if (!vivo) return;
      puntosPorRef.current = puntosPor;
      setPosts(pagina);
      setFijado(elFijado);
      setHayMas(pagina.length === POR_PAGINA);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId, espacioId]);

  const cargarMas = useCallback(async () => {
    if (posts.length === 0 || !hayMas) return;
    const ultima = posts[posts.length - 1].creadoEl;

    const siguiente = await leerPagina(
      crearClienteNavegador(),
      { comunidadId, espacioId },
      ultima,
      puntosPorRef.current
    );

    setPosts((previas) => [...previas, ...siguiente]);
    setHayMas(siguiente.length === POR_PAGINA);
  }, [posts, hayMas, comunidadId, espacioId]);

  return { posts, fijado, cargando, hayMas, cargarMas, recargar };
}
