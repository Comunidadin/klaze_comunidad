"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useSession } from "@/lib/hooks/use-session";
import { nivelPorPuntos } from "@/lib/levels";
import type { Course, Lesson } from "@/lib/types";

export type AccesoCurso = "si" | "candado-nivel" | "sin-acceso";

export type CourseConAcceso = Course & {
  acceso: AccesoCurso;
  progresoPct: number;
};

function leccionesDeCurso(curso: Course): Lesson[] {
  return curso.modulos.flatMap((m) => m.lecciones);
}

/**
 * Cursos de `comunidadId` dentro de los que el servidor nos entregó.
 *
 * Antes se llamaba `mergeCursos` y mezclaba mocks con overrides del admin. Ya
 * no hay nada que mezclar: la lista viene de Postgres y es la única verdad.
 * El segundo parámetro es esa lista (normalmente `armazon.cursos`), no unos
 * overrides.
 */
export function cursosDeComunidad(comunidadId: string, cursos: Course[]): Course[] {
  return cursos.filter((c) => c.comunidadId === comunidadId);
}

/**
 * Cursos que un miembro puede llegar a ver: los publicados.
 *
 * El filtro de `publicado` se conserva aquí aunque RLS ya lo aplique. No es
 * redundancia inútil: al dueño la base SÍ le manda sus borradores, y este
 * helper lo usan también pantallas de cara al miembro (p. ej. el progreso
 * promedio en `useMembers`), donde un borrador no debe contar.
 */
export function cursosVisiblesParaMiembro(
  comunidadId: string,
  cursos: Course[]
): Course[] {
  return cursosDeComunidad(comunidadId, cursos).filter((c) => c.publicado);
}

/**
 * Cursos del classroom, con su candado y su porcentaje de avance.
 *
 * OJO con `acceso`: la base solo entrega los cursos que el acceso del alumno
 * cubre (ver `privado.cubre_curso`), así que "sin-acceso" ya no ocurre para un
 * miembro — un curso que no compró no llega, no llega con candado. El estado
 * se conserva en el tipo porque el dueño sí recibe todos los suyos.
 */
export function useCourses(comunidadId: string): { cursos: CourseConAcceso[] } {
  const armazon = useAppStore((s) => s.armazon);
  const progreso = useAppStore((s) => s.progreso);
  const { user } = useSession();

  // Derivar con useMemo, nunca dentro del selector: crear arrays nuevos ahí
  // rompe el invariante de `useSyncExternalStore` en React 19.
  return useMemo(() => {
    const cursos = cursosVisiblesParaMiembro(comunidadId, armazon?.cursos ?? []);
    const nivelUsuario = user ? nivelPorPuntos(user.puntos) : 0;

    const cursosConAcceso: CourseConAcceso[] = cursos.map((curso) => {
      const lecciones = leccionesDeCurso(curso);
      const completadas = user
        ? progreso.filter(
            (p) => p.userId === user.id && lecciones.some((l) => l.id === p.leccionId)
          ).length
        : 0;
      const progresoPct =
        lecciones.length === 0 ? 0 : Math.round((completadas / lecciones.length) * 100);

      const acceso: AccesoCurso = !user
        ? "sin-acceso"
        : curso.nivelRequerido === null || nivelUsuario >= curso.nivelRequerido
          ? "si"
          : "candado-nivel";

      return { ...curso, acceso, progresoPct };
    });

    return { cursos: cursosConAcceso };
  }, [armazon, comunidadId, progreso, user]);
}

export interface UseLessonResult {
  leccion: Lesson;
  completada: boolean;
  toggle: () => void;
}

export function useLesson(
  cursoId: string,
  leccionId: string
): UseLessonResult | null {
  const armazon = useAppStore((s) => s.armazon);
  const progreso = useAppStore((s) => s.progreso);
  const toggleLeccionCompleta = useAppStore((s) => s.toggleLeccionCompleta);
  const { user } = useSession();

  const curso = (armazon?.cursos ?? []).find((c) => c.id === cursoId);
  if (!curso) return null;

  const leccion = leccionesDeCurso(curso).find((l) => l.id === leccionId);
  if (!leccion) return null;

  const completada = user
    ? progreso.some((p) => p.userId === user.id && p.leccionId === leccionId)
    : false;

  return {
    leccion,
    completada,
    toggle: () => toggleLeccionCompleta(leccionId),
  };
}
