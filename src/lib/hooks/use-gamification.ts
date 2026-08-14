"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/hooks/use-session";
import { useMembers } from "@/lib/hooks/use-members";
import { useDirectorio } from "@/lib/hooks/use-directorio-curso";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { leerRanking } from "@/lib/supabase/ranking";
import { nivelPorPuntos, puntosParaNivel, NIVEL_MAXIMO } from "@/lib/levels";
import type { User } from "@/lib/types";

export type PeriodoRanking = "7d" | "30d" | "total";

export interface RankingEntry {
  posicion: number;
  user: User;
  /** Puntos del periodo: lecciones completadas en esa ventana x 10. */
  puntos: number;
  /** Nivel real, siempre derivado de los puntos totales — es una insignia de plataforma, no del periodo ni del curso. */
  nivel: number;
  delta: "up" | "down" | "same";
}

const DIA = 24 * 60 * 60 * 1000;

/** Cuántos puntos vale una clase. Debe coincidir con `ranking_de_comunidad` y `privado.puntos_en` (10 × clase). */
export const PUNTOS_POR_LECCION = 10;

/**
 * Tendencia. No hay historial de posiciones pasadas guardado, así que se deriva
 * de la posición actual: el #1 sostiene el liderato y el resto alterna.
 *
 * Es decorativa y se admite como tal. Una tendencia de verdad exigiría guardar
 * la clasificación de cada día y un proceso que la calcule — demasiado para una
 * flecha.
 */
function deltaDeterministico(
  periodo: PeriodoRanking,
  posicion: number
): RankingEntry["delta"] {
  if (periodo === "total") return "same";
  if (posicion === 1) return "same";
  return posicion % 2 === 0 ? "down" : "up";
}

function construirRanking(
  miembros: User[],
  puntosPorUsuario: Map<string, number>,
  periodo: PeriodoRanking
): RankingEntry[] {
  return [...miembros]
    .sort((a, b) => {
      const diff = (puntosPorUsuario.get(b.id) ?? 0) - (puntosPorUsuario.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      // Desempate estable por nombre: sin él, dos personas con los mismos
      // puntos se intercambian de sitio entre renders.
      return a.nombre.localeCompare(b.nombre, "es");
    })
    .map((u, i) => ({
      posicion: i + 1,
      user: u,
      puntos: puntosPorUsuario.get(u.id) ?? 0,
      nivel: nivelPorPuntos(u.puntos),
      delta: deltaDeterministico(periodo, i + 1),
    }));
}

export interface UseGamificationResult {
  /** Ranking del periodo "total" — se mantiene por los consumidores existentes. */
  ranking: RankingEntry[];
  rankingPorPeriodo: Record<PeriodoRanking, RankingEntry[]>;
  miNivel: number;
  puntosParaSiguiente: number;
}

type PuntosPorPeriodo = Record<PeriodoRanking, Map<string, number>>;

/** Referencia estable para el estado inicial: crear mapas nuevos en cada render dispararía efectos en bucle. */
const VACIO: PuntosPorPeriodo = {
  "7d": new Map(),
  "30d": new Map(),
  total: new Map(),
};

/**
 * Es `async` aunque la rama sin comunidad no espere nada, para que el `.then()`
 * que fija el estado no corra de forma síncrona dentro del efecto.
 */
async function leerPuntos(
  comunidadId: string,
  cursoId: string | undefined,
  ahora: number
): Promise<PuntosPorPeriodo> {
  if (!comunidadId) return VACIO;

  const supabase = crearClienteNavegador();
  const [siete, treinta, total] = await Promise.all([
    leerRanking(supabase, comunidadId, { desde: new Date(ahora - 7 * DIA), cursoId }),
    leerRanking(supabase, comunidadId, { desde: new Date(ahora - 30 * DIA), cursoId }),
    leerRanking(supabase, comunidadId, { desde: null, cursoId }),
  ]);

  return { "7d": siete, "30d": treinta, total };
}

/**
 * Ranking de una comunidad o, con `cursoId`, de ese curso.
 *
 * Los puntos salen de las lecciones completadas: 10 por lección, otorgados por
 * un trigger de la base. Antes eran un número fijo de los datos semilla que
 * nadie modificaba nunca, y los periodos de 7 y 30 días se derivaban
 * multiplicando el total por un porcentaje inventado. Ahora los tres salen de
 * fechas reales.
 *
 * Acotar por curso importa: la pestaña de ranking vive dentro de un curso, y
 * sin acotar compararía a quien va por la mitad de un curso de 40 lecciones con
 * quien terminó uno de 5.
 */
export function useGamification(
  comunidadId: string,
  cursoId?: string
): UseGamificationResult {
  const { user } = useSession();
  const { miembros } = useMembers(comunidadId, cursoId);
  const [puntos, setPuntos] = useState<PuntosPorPeriodo>(VACIO);

  useEffect(() => {
    let vivo = true;
    // La fecha se fija al montar y no en cada render: recalcularla movería la
    // ventana entre llamadas y el ranking parpadearía.
    const ahora = Date.now();
    void leerPuntos(comunidadId, cursoId, ahora).then((p) => {
      if (vivo) setPuntos(p);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId, cursoId]);

  const rankingPorPeriodo = useMemo(
    () => ({
      "7d": construirRanking(miembros, puntos["7d"], "7d"),
      "30d": construirRanking(miembros, puntos["30d"], "30d"),
      total: construirRanking(miembros, puntos.total, "total"),
    }),
    [miembros, puntos]
  );

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

/**
 * El ranking del AREA DE ALUMNO.
 *
 * `useGamification` lista miembros con `useMembers`, que lee `inscripciones`
 * — y esa tabla solo se la enseña RLS a su dueño y al administrador: a un
 * alumno el ranking le salia con una sola persona (él). Aquí la lista sale de
 * `miembros_de_comunidad`, la puerta pensada para compañeros de clase, y los
 * periodos de `ranking_de_comunidad`, como siempre.
 */
export function useRankingComunidad(comunidadId: string): UseGamificationResult {
  const { user } = useSession();
  const directorio = useDirectorio(comunidadId);
  const [puntos, setPuntos] = useState<PuntosPorPeriodo>(VACIO);

  useEffect(() => {
    let vivo = true;
    const ahora = Date.now();
    void leerPuntos(comunidadId, undefined, ahora).then((p) => {
      if (vivo) setPuntos(p);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId]);

  const miembros: User[] = useMemo(
    () =>
      directorio.map((m) => ({
        id: m.id,
        email: "",
        nombre: m.nombre,
        avatarUrl: m.avatarUrl,
        bio: m.bio,
        rol: "alumno" as const,
        comunidadIds: [comunidadId],
        puntos: m.puntos,
        nivel: m.nivel,
        creadoEl: m.creadoEl,
      })),
    [directorio, comunidadId]
  );

  const rankingPorPeriodo = useMemo(
    () => ({
      "7d": construirRanking(miembros, puntos["7d"], "7d"),
      "30d": construirRanking(miembros, puntos["30d"], "30d"),
      total: construirRanking(miembros, puntos.total, "total"),
    }),
    [miembros, puntos]
  );

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
