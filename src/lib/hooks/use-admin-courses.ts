"use client";

import { useAppStore } from "@/lib/store";
import { cursosDeComunidad } from "@/lib/hooks/use-courses";
import { useMembers } from "@/lib/hooks/use-members";
import type { Course } from "@/lib/types";

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
/**
 * Alumnos ACTIVOS con acceso a un curso.
 *
 * Sale de `useMembers`, que ya trae solo los inscritos de esa comunidad con su
 * estado real. Antes se calculaba sobre mocks más overrides del store, y ese
 * cálculo podía discrepar del que hacía la base: dos verdades para la misma
 * pregunta.
 */
function contarAlumnosConAcceso(
  cursoId: string,
  miembros: { estado: string; id: string }[],
  accesos: Map<string, { todos: boolean; cursoIds: string[] }>
): number {
  return miembros.filter((m) => {
    if (m.estado !== "activo") return false;
    const acceso = accesos.get(m.id);
    if (!acceso) return false;
    return acceso.todos || acceso.cursoIds.includes(cursoId);
  }).length;
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
  const armazon = useAppStore((s) => s.armazon);
  const { miembros, accesos } = useMembers(comunidadId);

  // Sin filtrar por `publicado`: el dueno ve sus borradores, y la base ya se
  // los ha entregado.
  const cursos = cursosDeComunidad(comunidadId, armazon?.cursos ?? []);

  const cursosConAdmin: CourseConAdmin[] = cursos.map((curso) => ({
    ...curso,
    numAlumnos: contarAlumnosConAcceso(curso.id, miembros, accesos),
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
