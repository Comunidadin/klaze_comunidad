"use client";

import { useKlazeStore } from "@/lib/store";
import { mockUsers } from "@/lib/mocks/users";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { useSession } from "@/lib/hooks/use-session";
import { nivelPorPuntos, puntosParaNivel, NIVEL_MAXIMO } from "@/lib/levels";
import type { User } from "@/lib/types";

export interface RankingEntry {
  posicion: number;
  user: User;
  puntos: number;
  nivel: number;
}

export function useGamification(comunidadId: string): {
  ranking: RankingEntry[];
  miNivel: number;
  puntosParaSiguiente: number;
} {
  const usuariosCreados = useKlazeStore((s) => s.usuariosCreados);
  const enrollmentsExtra = useKlazeStore((s) => s.enrollmentsExtra);
  const { user } = useSession();

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];
  const enrollments = [...mockEnrollments, ...enrollmentsExtra].filter(
    (e) => e.comunidadId === comunidadId
  );

  const miembros = enrollments
    .map((e) => todosLosUsuarios.find((u) => u.id === e.userId))
    .filter((u): u is User => u !== undefined);

  const ordenados = [...miembros].sort((a, b) => b.puntos - a.puntos);

  const ranking: RankingEntry[] = ordenados.map((u, i) => ({
    posicion: i + 1,
    user: u,
    puntos: u.puntos,
    nivel: nivelPorPuntos(u.puntos),
  }));

  const miNivel = user ? nivelPorPuntos(user.puntos) : 1;
  const puntosParaSiguiente =
    user && miNivel < NIVEL_MAXIMO
      ? Math.max(puntosParaNivel(miNivel + 1) - user.puntos, 0)
      : 0;

  return { ranking, miNivel, puntosParaSiguiente };
}
