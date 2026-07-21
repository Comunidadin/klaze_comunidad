"use client";

import { resolverEstadoEnrollment, useKlazeStore } from "@/lib/store";
import { mockCourses } from "@/lib/mocks/courses";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { useSession } from "@/lib/hooks/use-session";
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
 * Aplica los overrides de `cursosEditados` (admin) sobre los mocks base.
 * Exportada porque `useMembers` la reutiliza para calcular el progreso
 * promedio por alumno sobre el mismo set de cursos "reales" de la comunidad.
 */
export function mergeCursos(comunidadId: string, cursosEditados: Course[]): Course[] {
  const base = mockCourses.filter((c) => c.comunidadId === comunidadId);
  const overridesMismaComunidad = cursosEditados.filter(
    (c) => c.comunidadId === comunidadId
  );

  const resultado = base.map((curso) => {
    const override = overridesMismaComunidad.find((c) => c.id === curso.id);
    return override ?? curso;
  });

  const nuevos = overridesMismaComunidad.filter(
    (c) => !base.some((b) => b.id === c.id)
  );

  return [...resultado, ...nuevos];
}

export function useCourses(comunidadId: string): { cursos: CourseConAcceso[] } {
  const cursosEditados = useKlazeStore((s) => s.cursosEditados);
  const enrollmentsExtra = useKlazeStore((s) => s.enrollmentsExtra);
  const progreso = useKlazeStore((s) => s.progreso);
  const estadoOverrides = useKlazeStore((s) => s.estadoOverrides);
  const { user } = useSession();

  const cursos = mergeCursos(comunidadId, cursosEditados);
  const enrollments = [...mockEnrollments, ...enrollmentsExtra];

  const enrollment = user
    ? enrollments.find(
        (e) =>
          e.userId === user.id &&
          e.comunidadId === comunidadId &&
          resolverEstadoEnrollment(e, estadoOverrides) === "activo"
      )
    : undefined;

  const cursosConAcceso: CourseConAcceso[] = cursos.map((curso) => {
    const lecciones = leccionesDeCurso(curso);
    const completadas = user
      ? progreso.filter(
          (p) =>
            p.userId === user.id && lecciones.some((l) => l.id === p.leccionId)
        ).length
      : 0;
    const progresoPct =
      lecciones.length === 0 ? 0 : Math.round((completadas / lecciones.length) * 100);

    let acceso: AccesoCurso = "sin-acceso";
    const tieneEnrollment =
      !!enrollment &&
      (enrollment.cursoIds === "todos" || enrollment.cursoIds.includes(curso.id));

    if (tieneEnrollment) {
      const nivelUsuario = user?.nivel ?? 0;
      acceso =
        curso.nivelRequerido === null || nivelUsuario >= curso.nivelRequerido
          ? "si"
          : "candado-nivel";
    }

    return { ...curso, acceso, progresoPct };
  });

  return { cursos: cursosConAcceso };
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
  const cursosEditados = useKlazeStore((s) => s.cursosEditados);
  const progreso = useKlazeStore((s) => s.progreso);
  const toggleLeccionCompleta = useKlazeStore((s) => s.toggleLeccionCompleta);
  const { user } = useSession();

  const override = cursosEditados.find((c) => c.id === cursoId);
  const curso = override ?? mockCourses.find((c) => c.id === cursoId);
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
