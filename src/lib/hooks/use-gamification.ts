"use client";

import { aplicarPerfilOverride, useAppStore } from "@/lib/store";
import { mockUsers } from "@/lib/mocks/users";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { useSession } from "@/lib/hooks/use-session";
import { useFeed } from "@/lib/hooks/use-feed";
import { nivelPorPuntos, puntosParaNivel, NIVEL_MAXIMO } from "@/lib/levels";
import type { User } from "@/lib/types";

export type PeriodoRanking = "7d" | "30d" | "total";

export interface RankingEntry {
  posicion: number;
  user: User;
  /** Puntos del periodo activo ("total" = puntos totales; 7d/30d, ver `puntosDelPeriodo`). */
  puntos: number;
  /** Nivel real del usuario — siempre derivado de `user.puntos` totales (insignia de plataforma), no del periodo ni de `cursoId`. */
  nivel: number;
  /** Tendencia mock del periodo (regla determinística, ver `deltaDeterministico`). */
  delta: "up" | "down" | "same";
}

/** Miembro con los puntos ya resueltos para el ranking (ver docstring de `useGamification` sobre `cursoId`). */
interface MiembroConPuntos {
  user: User;
  puntosTotales: number;
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
function ordenarMiembros(miembros: MiembroConPuntos[], periodo: PeriodoRanking): MiembroConPuntos[] {
  return [...miembros].sort((a, b) => {
    const diff = puntosDelPeriodo(b.puntosTotales, periodo) - puntosDelPeriodo(a.puntosTotales, periodo);
    if (diff !== 0) return diff;
    return a.user.nombre.localeCompare(b.user.nombre, "es");
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

function construirRanking(miembros: MiembroConPuntos[], periodo: PeriodoRanking): RankingEntry[] {
  return ordenarMiembros(miembros, periodo).map((m, i) => {
    const posicion = i + 1;
    return {
      posicion,
      user: m.user,
      puntos: puntosDelPeriodo(m.puntosTotales, periodo),
      nivel: nivelPorPuntos(m.user.puntos),
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

/**
 * Ranking de `comunidadId`. Sin `cursoId`: los puntos de cada miembro son
 * `user.puntos` (comportamiento histórico, usado por `/perfil` — vía
 * `miNivel`/`puntosParaSiguiente`, que NUNCA dependen de `cursoId` — y por
 * `/admin/reportes`, top 5 alumnos de toda la comunidad).
 *
 * Con `cursoId` (Cambio 3: "Ranking" es ahora una pestaña por curso): los
 * puntos de cada miembro son los likes recibidos en los posts que publicó
 * DENTRO de ese curso — reutiliza `useFeed(comunidadId, cursoId)` (que ya
 * resuelve likes de sesión + seed) en vez de re-derivar ese merge acá. El
 * nivel (badge) sigue siendo siempre el global: es una insignia de
 * plataforma, no varía por curso.
 */
export function useGamification(comunidadId: string, cursoId?: string): UseGamificationResult {
  const usuariosCreados = useAppStore((s) => s.usuariosCreados);
  const enrollmentsExtra = useAppStore((s) => s.enrollmentsExtra);
  const perfilOverrides = useAppStore((s) => s.perfilOverrides);
  const { user } = useSession();
  const { posts } = useFeed(comunidadId, cursoId);

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];
  const enrollments = [...mockEnrollments, ...enrollmentsExtra].filter(
    (e) => e.comunidadId === comunidadId
  );

  const miembros = enrollments
    .map((e) => todosLosUsuarios.find((u) => u.id === e.userId))
    .filter((u): u is User => u !== undefined)
    .map((u) => aplicarPerfilOverride(u, perfilOverrides));

  let puntosPorCurso: Map<string, number> | null = null;
  if (cursoId) {
    puntosPorCurso = new Map();
    for (const post of posts) {
      puntosPorCurso.set(post.autorId, (puntosPorCurso.get(post.autorId) ?? 0) + post.likes.length);
    }
  }

  const miembrosConPuntos: MiembroConPuntos[] = miembros.map((u) => ({
    user: u,
    puntosTotales: puntosPorCurso ? (puntosPorCurso.get(u.id) ?? 0) : u.puntos,
  }));

  const rankingPorPeriodo: Record<PeriodoRanking, RankingEntry[]> = {
    "7d": construirRanking(miembrosConPuntos, "7d"),
    "30d": construirRanking(miembrosConPuntos, "30d"),
    total: construirRanking(miembrosConPuntos, "total"),
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
