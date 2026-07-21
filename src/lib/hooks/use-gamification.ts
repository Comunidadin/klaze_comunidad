"use client";

import { aplicarPerfilOverride, useKlazeStore } from "@/lib/store";
import { mockUsers } from "@/lib/mocks/users";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { useSession } from "@/lib/hooks/use-session";
import { nivelPorPuntos, puntosParaNivel, NIVEL_MAXIMO } from "@/lib/levels";
import type { User } from "@/lib/types";

export type PeriodoRanking = "7d" | "30d" | "total";

export interface RankingEntry {
  posicion: number;
  user: User;
  /** Puntos del periodo activo ("total" = `user.puntos`; 7d/30d, ver `puntosDelPeriodo`). */
  puntos: number;
  /** Nivel real del usuario — siempre derivado de `user.puntos` totales, no del periodo. */
  nivel: number;
  /** Tendencia mock del periodo (regla determinística, ver `deltaDeterministico`). */
  delta: "up" | "down" | "same";
}

// Mock: no hay historial real de puntos por fecha, así que 7d/30d se derivan
// como un porcentaje fijo del total acumulado (redondeado). Son proporciones
// arbitrarias pero estables — el mismo usuario siempre obtiene el mismo
// puntaje de periodo mientras no cambien sus puntos totales.
const PORCENTAJE_PERIODO: Record<Exclude<PeriodoRanking, "total">, number> = {
  "7d": 0.15,
  "30d": 0.45,
};

function puntosDelPeriodo(puntosTotales: number, periodo: PeriodoRanking): number {
  if (periodo === "total") return puntosTotales;
  return Math.round(puntosTotales * PORCENTAJE_PERIODO[periodo]);
}

/**
 * Ordena por puntos del periodo desc.; en caso de empate usa el nombre
 * (localeCompare "es") como criterio secundario estable, así el orden no
 * "salta" entre renders cuando dos personas tienen el mismo puntaje.
 */
function ordenarMiembros(miembros: User[], periodo: PeriodoRanking): User[] {
  return [...miembros].sort((a, b) => {
    const diff = puntosDelPeriodo(b.puntos, periodo) - puntosDelPeriodo(a.puntos, periodo);
    if (diff !== 0) return diff;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

/**
 * Delta mock determinístico (sin `Math.random`): no hay historial real de
 * posiciones pasadas, así que la tendencia se deriva de la paridad de la
 * posición actual dentro del periodo. Regla: la posición #1 siempre se
 * muestra "same" (sostiene el liderato); el resto alterna "up" (posición
 * impar) / "down" (posición par). Para el periodo "total" no aplica ninguna
 * tendencia (es el acumulado histórico completo, no hay "movimiento" que
 * mostrar), así que siempre es "same".
 */
function deltaDeterministico(periodo: PeriodoRanking, posicion: number): RankingEntry["delta"] {
  if (periodo === "total") return "same";
  if (posicion === 1) return "same";
  return posicion % 2 === 0 ? "down" : "up";
}

function construirRanking(miembros: User[], periodo: PeriodoRanking): RankingEntry[] {
  return ordenarMiembros(miembros, periodo).map((u, i) => {
    const posicion = i + 1;
    return {
      posicion,
      user: u,
      puntos: puntosDelPeriodo(u.puntos, periodo),
      nivel: nivelPorPuntos(u.puntos),
      delta: deltaDeterministico(periodo, posicion),
    };
  });
}

export interface UseGamificationResult {
  /** Ranking del periodo "total" — se mantiene por retrocompatibilidad con consumidores existentes. */
  ranking: RankingEntry[];
  /** Ranking completo, ya calculado para los tres periodos. */
  rankingPorPeriodo: Record<PeriodoRanking, RankingEntry[]>;
  miNivel: number;
  puntosParaSiguiente: number;
}

export function useGamification(comunidadId: string): UseGamificationResult {
  const usuariosCreados = useKlazeStore((s) => s.usuariosCreados);
  const enrollmentsExtra = useKlazeStore((s) => s.enrollmentsExtra);
  const perfilOverrides = useKlazeStore((s) => s.perfilOverrides);
  const { user } = useSession();

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];
  const enrollments = [...mockEnrollments, ...enrollmentsExtra].filter(
    (e) => e.comunidadId === comunidadId
  );

  const miembros = enrollments
    .map((e) => todosLosUsuarios.find((u) => u.id === e.userId))
    .filter((u): u is User => u !== undefined)
    .map((u) => aplicarPerfilOverride(u, perfilOverrides));

  const rankingPorPeriodo: Record<PeriodoRanking, RankingEntry[]> = {
    "7d": construirRanking(miembros, "7d"),
    "30d": construirRanking(miembros, "30d"),
    total: construirRanking(miembros, "total"),
  };

  const miNivel = user ? nivelPorPuntos(user.puntos) : 1;
  const puntosParaSiguiente =
    user && miNivel < NIVEL_MAXIMO
      ? Math.max(puntosParaNivel(miNivel + 1) - user.puntos, 0)
      : 0;

  return {
    ranking: rankingPorPeriodo.total,
    rankingPorPeriodo,
    miNivel,
    puntosParaSiguiente,
  };
}
