"use client";

import { aplicarPerfilOverride, useKlazeStore } from "@/lib/store";
import { mockUsers } from "@/lib/mocks/users";
import type { User } from "@/lib/types";

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

export interface UseUsuariosResult {
  /** Resuelve un `userId` a su `User` (mock + creados en runtime, con overrides de perfil aplicados). */
  resolver: (userId: string) => User;
}

/**
 * Hook liviano para resolver autores fuera del propio post (p. ej. los
 * comentarios de `CommentThread`, que solo traen `autorId`). Existe para que
 * los componentes de comunidad no importen `mockUsers` directamente —
 * misma regla que ya siguen `useSession`/`useMembers`/`useGamification`.
 */
export function useUsuarios(): UseUsuariosResult {
  const usuariosCreados = useKlazeStore((s) => s.usuariosCreados);
  const perfilOverrides = useKlazeStore((s) => s.perfilOverrides);

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];

  function resolver(userId: string): User {
    const usuario = todosLosUsuarios.find((u) => u.id === userId);
    return usuario ? aplicarPerfilOverride(usuario, perfilOverrides) : AUTOR_DESCONOCIDO;
  }

  return { resolver };
}
