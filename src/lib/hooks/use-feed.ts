"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cursosDeComunidad } from "@/lib/hooks/use-courses";
import { leerFijado, leerPagina, POR_PAGINA } from "@/lib/supabase/feed";
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

/** Referencia estable para "sin cursos": un `[]` nuevo relanzaría el efecto en bucle. */
const SIN_CURSOS: string[] = [];

/**
 * Es `async` aunque la rama sin cursos no espere nada, para que el `setState`
 * de quien la llama nunca corra de forma síncrona dentro del efecto.
 */
async function leerTodo(
  claveCursos: string,
  cursoId: string | undefined,
  espacioId: string | undefined
): Promise<{ pagina: PostConAutor[]; elFijado: PostConAutor | null }> {
  const ids = claveCursos ? claveCursos.split(",") : [];
  if (ids.length === 0) return { pagina: [], elFijado: null };

  const supabase = crearClienteNavegador();
  const [pagina, elFijado] = await Promise.all([
    leerPagina(supabase, { cursoIds: ids, espacioId }, null),
    // Solo hay fijada dentro de un curso concreto: en la vista de toda la
    // academia no tendría sentido destacar la de uno solo.
    cursoId ? leerFijado(supabase, cursoId) : Promise.resolve(null),
  ]);

  return { pagina, elFijado };
}

/**
 * Feed de un curso o, sin `cursoId`, de toda la academia — que es lo que
 * modera `/admin/comunidad`.
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
export function useFeed(
  comunidadId: string,
  cursoId?: string,
  espacioId?: string
): UseFeedResult {
  const armazon = useAppStore((s) => s.armazon);
  const [posts, setPosts] = useState<PostConAutor[]>([]);
  const [fijado, setFijado] = useState<PostConAutor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);

  const cursosDeLaComunidad = cursosDeComunidad(comunidadId, armazon?.cursos ?? []);
  const cursoIds = !comunidadId
    ? SIN_CURSOS
    : cursoId
      ? [cursoId]
      : cursosDeLaComunidad.map((c) => c.id);

  // Clave estable para el efecto: el array se recrea en cada render, así que
  // depender de él directamente relanzaría la carga sin parar.
  const claveCursos = cursoIds.join(",");

  const recargar = useCallback(async () => {
    const { pagina, elFijado } = await leerTodo(claveCursos, cursoId, espacioId);
    setPosts(pagina);
    setFijado(elFijado);
    setHayMas(pagina.length === POR_PAGINA);
    setCargando(false);
  }, [claveCursos, cursoId, espacioId]);

  useEffect(() => {
    let vivo = true;
    // Se llama a `leerTodo` y no a `recargar` para que el `setState` viva en un
    // `.then()` y nunca corra de forma síncrona dentro del efecto.
    void leerTodo(claveCursos, cursoId, espacioId).then(({ pagina, elFijado }) => {
      if (!vivo) return;
      setPosts(pagina);
      setFijado(elFijado);
      setHayMas(pagina.length === POR_PAGINA);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [claveCursos, cursoId, espacioId]);

  const cargarMas = useCallback(async () => {
    if (posts.length === 0 || !hayMas) return;
    const ids = claveCursos ? claveCursos.split(",") : [];
    const ultima = posts[posts.length - 1].creadoEl;

    const siguiente = await leerPagina(
      crearClienteNavegador(),
      { cursoIds: ids, espacioId },
      ultima
    );

    setPosts((previas) => [...previas, ...siguiente]);
    setHayMas(siguiente.length === POR_PAGINA);
  }, [posts, hayMas, claveCursos, espacioId]);

  return { posts, fijado, cargando, hayMas, cargarMas, recargar };
}
