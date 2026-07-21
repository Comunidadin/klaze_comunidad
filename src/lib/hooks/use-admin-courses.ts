"use client";

import { enrollmentCubreCurso, resolverEstadoEnrollment, useKlazeStore } from "@/lib/store";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { mergeCursos } from "@/lib/hooks/use-courses";
import type { Course, Enrollment } from "@/lib/types";

export type CourseConAdmin = Course & {
  /** Alumnos con `Enrollment` activo que cubre este curso (`cursoIds === "todos"` o lo incluye). */
  numAlumnos: number;
};

/**
 * Cuenta los enrollments de `comunidadId` cuyo estado efectivo (aplicando
 * `estadoOverrides`, ver `resolverEstadoEnrollment`) es "activo" y cuyo
 * `cursoIds` cubre `cursoId` (`enrollmentCubreCurso`, store.ts) — mismo
 * criterio de acceso que usa `useCourses` para el candado de un alumno, pero
 * contado en vez de evaluado para uno solo.
 */
function contarAlumnosConAcceso(
  cursoId: string,
  comunidadId: string,
  enrollments: Enrollment[],
  estadoOverrides: Record<string, Enrollment["estado"]>
): number {
  return enrollments.filter(
    (e) =>
      e.comunidadId === comunidadId &&
      resolverEstadoEnrollment(e, estadoOverrides) === "activo" &&
      enrollmentCubreCurso(e, cursoId)
  ).length;
}

/**
 * Cursos "crudos" de la comunidad para el admin de `/admin/cursos`: incluye
 * publicados y borradores (a diferencia de `useCourses`, que filtra por
 * `publicado` para el classroom de miembros) y no aplica ninguna lógica de
 * acceso por nivel — el creador siempre ve la estructura completa de todos
 * sus cursos. Cada curso trae `numAlumnos` ya calculado para la tarjeta
 * admin de la lista.
 */
export function useAdminCourses(comunidadId: string): { cursos: CourseConAdmin[] } {
  const cursosEditados = useKlazeStore((s) => s.cursosEditados);
  const enrollmentsExtra = useKlazeStore((s) => s.enrollmentsExtra);
  const estadoOverrides = useKlazeStore((s) => s.estadoOverrides);

  const cursos = mergeCursos(comunidadId, cursosEditados);
  const enrollments = [...mockEnrollments, ...enrollmentsExtra];

  const cursosConAdmin: CourseConAdmin[] = cursos.map((curso) => ({
    ...curso,
    numAlumnos: contarAlumnosConAcceso(curso.id, comunidadId, enrollments, estadoOverrides),
  }));

  return { cursos: cursosConAdmin };
}

/**
 * Un solo curso "crudo" de `comunidadId` por su `id`, para el editor
 * `/admin/cursos/[curso]`. Devuelve `null` tanto si el curso no existe como
 * si pertenece a otra comunidad — el editor no puede distinguir (ni le
 * importa) esos dos casos, en ambos muestra el mismo `EmptyState`.
 */
export function useAdminCourse(comunidadId: string, cursoId: string): CourseConAdmin | null {
  const { cursos } = useAdminCourses(comunidadId);
  return cursos.find((c) => c.id === cursoId) ?? null;
}
