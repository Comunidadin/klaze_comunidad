"use client";

import { resolverComunidad, useAppStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { mockPosts } from "@/lib/mocks/posts";
import { mockUsers } from "@/lib/mocks/users";
import { cursosDeComunidad } from "@/lib/hooks/use-courses";
import type { CommunitySection, Post, PostComment, User } from "@/lib/types";

export type PostConAutor = Post & { autor: User };

export type ComentarioCreado = {
  postId: string;
  comentario: PostComment;
  parentId: string | null;
};

export type OrdenFeed = "reciente" | "comentado";

/** Cuenta comentarios raíz + respuestas (modelo fijo de 2 niveles). Compartida por `PostCard` y `ContextoRail`. */
export function contarComentariosPost(post: Pick<Post, "comentarios">): number {
  return post.comentarios.reduce((total, raiz) => total + 1 + raiz.respuestas.length, 0);
}

/**
 * Pliega los comentarios nuevos (creados en sesión) sobre el árbol base de
 * un post. Modelo de 2 niveles (raíz + respuestas): un comentario nuevo con
 * `parentId === null` se agrega como raíz; uno con `parentId` se busca entre
 * TODAS las raíces disponibles — tanto las del mock como las raíces creadas
 * en esta misma sesión (procesadas en orden de inserción, así que una raíz
 * creada primero ya está disponible cuando llega una respuesta posterior que
 * la referencia). Si el `parentId` no matchea ninguna raíz, se descarta de
 * forma defensiva en vez de perderse silenciosamente en otro lado.
 */
export function mergeComentarios(
  comentariosBase: PostComment[],
  comentariosCreados: ComentarioCreado[],
  postId: string
): PostComment[] {
  const raices: PostComment[] = comentariosBase.map((c) => ({
    ...c,
    respuestas: [...c.respuestas],
  }));

  for (const entrada of comentariosCreados) {
    if (entrada.postId !== postId) continue;

    if (entrada.parentId === null) {
      raices.push({ ...entrada.comentario, respuestas: [] });
      continue;
    }

    const raiz = raices.find((r) => r.id === entrada.parentId);
    if (!raiz) continue; // parentId inválido/huérfano: se descarta.
    raiz.respuestas = [...raiz.respuestas, entrada.comentario];
  }

  return raices;
}

const AUTOR_DESCONOCIDO: User = {
  id: "u-desconocido",
  email: "",
  nombre: "Usuario",
  avatarUrl: "https://i.pravatar.cc/150?u=u-desconocido",
  bio: "",
  rol: "alumno",
  comunidadIds: [],
  puntos: 0,
  nivel: 1,
  creadoEl: "2026-07-20T12:00:00.000Z",
};

/** Id del espacio "General" (slug `general`) dentro de `secciones` — respaldo al que se remapea un post cuyo `espacioId` ya no existe (espacio eliminado desde `/admin/comunidad`). */
function espacioRespaldoId(secciones: CommunitySection[]): string | undefined {
  return secciones.flatMap((s) => s.espacios).find((e) => e.slug === "general")?.id;
}

/**
 * Feed de una comunidad o, si se pasa `cursoId` (Cambio 3: la comunidad
 * social vive dentro de cada curso), el feed de ESE curso puntual —
 * filtrado por `Post.cursoId` en vez de solo `comunidadId`. Sin `cursoId`
 * conserva el comportamiento histórico (feed agregado de toda la
 * comunidad), que es lo que sigue usando `/admin/comunidad` para moderar.
 *
 * `espacioId` filtra a un solo espacio dentro de ese ámbito (comunidad o
 * curso). `orden` controla el criterio de ordenamiento — los posts fijados
 * siempre van primero, sin importar el orden elegido.
 */
export function useFeed(
  comunidadId: string,
  cursoId?: string,
  espacioId?: string,
  orden: OrdenFeed = "reciente"
): { posts: PostConAutor[] } {
  const postsCreados = useAppStore((s) => s.postsCreados);
  const likesDados = useAppStore((s) => s.likesDados);
  const comentariosCreados = useAppStore((s) => s.comentariosCreados);
  const usuariosCreados = useAppStore((s) => s.usuariosCreados);
  const postsEliminados = useAppStore((s) => s.postsEliminados);
  const postFijadoPorComunidad = useAppStore((s) => s.postFijadoPorComunidad);
  const comunidadesCreadas = useAppStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useAppStore((s) => s.comunidadOverrides);
  const armazon = useAppStore((s) => s.armazon);

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];

  // Secciones "efectivas" para remapear a "general" cualquier post cuyo
  // espacio original ya no exista: las del CURSO (`Course.secciones`, con
  // tal como vinieron del servidor) si hay `cursoId`, o las de la
  // COMUNIDAD (`Community.secciones`, comportamiento histórico de
  // `/admin/comunidad`) si no.
  let seccionesEfectivas: CommunitySection[] = [];
  if (cursoId) {
    const curso = cursosDeComunidad(comunidadId, armazon?.cursos ?? []).find((c) => c.id === cursoId);
    seccionesEfectivas = curso?.secciones ?? [];
  } else {
    const comunidadBase =
      comunidadesCreadas.find((c) => c.id === comunidadId) ??
      mockCommunities.find((c) => c.id === comunidadId);
    seccionesEfectivas = comunidadBase
      ? resolverComunidad(comunidadBase, comunidadOverrides).secciones
      : [];
  }
  const espacioIdsValidos = new Set(seccionesEfectivas.flatMap((s) => s.espacios.map((e) => e.id)));
  const espacioRespaldo = espacioRespaldoId(seccionesEfectivas);

  const fijadoOverride = postFijadoPorComunidad[comunidadId];

  const posts = [...mockPosts, ...postsCreados].filter(
    (p) =>
      p.comunidadId === comunidadId &&
      (!cursoId || p.cursoId === cursoId) &&
      !postsEliminados.includes(p.id)
  );

  let conMergeDeLikesYComentarios: Post[] = posts.map((post) => {
    // likesDados actúa como un conjunto de "toggles": si el par (post,user)
    // está presente, invierte el estado base (lo agrega si no estaba, lo
    // quita si ya estaba en el mock).
    const likes = new Set(post.likes);
    for (const l of likesDados) {
      if (l.postId !== post.id) continue;
      if (likes.has(l.userId)) likes.delete(l.userId);
      else likes.add(l.userId);
    }

    const comentarios = mergeComentarios(
      post.comentarios,
      comentariosCreados,
      post.id
    );

    const espacioIdEfectivo = espacioIdsValidos.has(post.espacioId)
      ? post.espacioId
      : (espacioRespaldo ?? post.espacioId);

    // Si la comunidad tiene un post fijado en sesión, reemplaza por
    // completo al `fijado` del seed (incluido "des-fijar" el que traía el
    // mock) — solo puede haber uno.
    const fijado = fijadoOverride ? post.id === fijadoOverride : post.fijado;

    return {
      ...post,
      likes: Array.from(likes),
      comentarios,
      espacioId: espacioIdEfectivo,
      fijado,
    };
  });

  if (espacioId) {
    conMergeDeLikesYComentarios = conMergeDeLikesYComentarios.filter(
      (p) => p.espacioId === espacioId
    );
  }

  const conAutor: PostConAutor[] = conMergeDeLikesYComentarios.map((post) => ({
    ...post,
    autor:
      todosLosUsuarios.find((u) => u.id === post.autorId) ?? AUTOR_DESCONOCIDO,
  }));

  conAutor.sort((a, b) => {
    if (a.fijado !== b.fijado) return a.fijado ? -1 : 1;
    if (orden === "comentado") {
      const diff = contarComentariosPost(b) - contarComentariosPost(a);
      if (diff !== 0) return diff;
    }
    return new Date(b.creadoEl).getTime() - new Date(a.creadoEl).getTime();
  });

  return { posts: conAutor };
}
