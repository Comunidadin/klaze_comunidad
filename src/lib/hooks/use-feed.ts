"use client";

import { resolverComunidad, useKlazeStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { mockPosts } from "@/lib/mocks/posts";
import { mockUsers } from "@/lib/mocks/users";
import type { Post, PostComment, User } from "@/lib/types";

/** Categoría de respaldo — nunca se puede eliminar ni renombrar desde /admin/comunidad (ver esa página). */
const CATEGORIA_RESPALDO = "General";

export type PostConAutor = Post & { autor: User };

export type ComentarioCreado = {
  postId: string;
  comentario: PostComment;
  parentId: string | null;
};

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

export function useFeed(
  comunidadId: string,
  categoria?: string
): { posts: PostConAutor[] } {
  const postsCreados = useKlazeStore((s) => s.postsCreados);
  const likesDados = useKlazeStore((s) => s.likesDados);
  const comentariosCreados = useKlazeStore((s) => s.comentariosCreados);
  const usuariosCreados = useKlazeStore((s) => s.usuariosCreados);
  const postsEliminados = useKlazeStore((s) => s.postsEliminados);
  const postFijadoPorComunidad = useKlazeStore((s) => s.postFijadoPorComunidad);
  const comunidadesCreadas = useKlazeStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useKlazeStore((s) => s.comunidadOverrides);

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];

  // Categorías "efectivas" de la comunidad (con overrides de
  // /admin/comunidad ya aplicados) — se usan para remapear a "General"
  // cualquier post cuya categoría original ya no exista (categoría
  // eliminada, ver `guardarCategorias`). "General" nunca es eliminable
  // (regla de esa pantalla), así que el remapeo siempre cae en una
  // categoría real.
  const comunidadBase =
    comunidadesCreadas.find((c) => c.id === comunidadId) ??
    mockCommunities.find((c) => c.id === comunidadId);
  const categoriasComunidad = comunidadBase
    ? resolverComunidad(comunidadBase, comunidadOverrides).categorias
    : [];

  const fijadoOverride = postFijadoPorComunidad[comunidadId];

  const posts = [...mockPosts, ...postsCreados].filter(
    (p) => p.comunidadId === comunidadId && !postsEliminados.includes(p.id)
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

    const categoriaEfectiva = categoriasComunidad.includes(post.categoria)
      ? post.categoria
      : CATEGORIA_RESPALDO;

    // Si la comunidad tiene un post fijado en sesión, reemplaza por
    // completo al `fijado` del seed (incluido "des-fijar" el que traía el
    // mock) — solo puede haber uno.
    const fijado = fijadoOverride ? post.id === fijadoOverride : post.fijado;

    return {
      ...post,
      likes: Array.from(likes),
      comentarios,
      categoria: categoriaEfectiva,
      fijado,
    };
  });

  if (categoria) {
    conMergeDeLikesYComentarios = conMergeDeLikesYComentarios.filter(
      (p) => p.categoria === categoria
    );
  }

  const conAutor: PostConAutor[] = conMergeDeLikesYComentarios.map((post) => ({
    ...post,
    autor:
      todosLosUsuarios.find((u) => u.id === post.autorId) ?? AUTOR_DESCONOCIDO,
  }));

  conAutor.sort((a, b) => {
    if (a.fijado !== b.fijado) return a.fijado ? -1 : 1;
    return new Date(b.creadoEl).getTime() - new Date(a.creadoEl).getTime();
  });

  return { posts: conAutor };
}
