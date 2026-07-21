"use client";

import { useKlazeStore } from "@/lib/store";
import { mockPosts } from "@/lib/mocks/posts";
import { mockUsers } from "@/lib/mocks/users";
import type { Post, PostComment, User } from "@/lib/types";

export type PostConAutor = Post & { autor: User };

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

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];

  let posts = [...mockPosts, ...postsCreados].filter(
    (p) => p.comunidadId === comunidadId
  );

  if (categoria) {
    posts = posts.filter((p) => p.categoria === categoria);
  }

  const conMergeDeLikesYComentarios: Post[] = posts.map((post) => {
    // likesDados actúa como un conjunto de "toggles": si el par (post,user)
    // está presente, invierte el estado base (lo agrega si no estaba, lo
    // quita si ya estaba en el mock).
    const likes = new Set(post.likes);
    for (const l of likesDados) {
      if (l.postId !== post.id) continue;
      if (likes.has(l.userId)) likes.delete(l.userId);
      else likes.add(l.userId);
    }

    const comentariosNuevosDeEstePost = comentariosCreados.filter(
      (c) => c.postId === post.id
    );

    const comentarios: PostComment[] = post.comentarios.map((c) => ({
      ...c,
      respuestas: [
        ...c.respuestas,
        ...comentariosNuevosDeEstePost
          .filter((n) => n.parentId === c.id)
          .map((n) => n.comentario),
      ],
    }));

    const comentariosNuevosDeNivelSuperior = comentariosNuevosDeEstePost
      .filter((n) => n.parentId === null)
      .map((n) => n.comentario);

    return {
      ...post,
      likes: Array.from(likes),
      comentarios: [...comentarios, ...comentariosNuevosDeNivelSuperior],
    };
  });

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
