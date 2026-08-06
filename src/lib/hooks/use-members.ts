"use client";

import {
  aplicarPerfilOverride,
  cursoIdsCubreCurso,
  enrollmentCubreCurso,
  resolverEstadoEnrollment,
  useAppStore,
} from "@/lib/store";
import { mockUsers } from "@/lib/mocks/users";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { cursosVisiblesParaMiembro } from "@/lib/hooks/use-courses";
import type { Course, Enrollment, LessonProgress, User } from "@/lib/types";

export type MemberConEstado = User & {
  estado: Enrollment["estado"];
  /** 0-100, promedio de `completadas/total` sobre los cursos con acceso. */
  progresoPromedio: number;
};

/**
 * Progreso promedio de un alumno: para cada curso al que tiene acceso
 * (según `cursoIds` de su enrollment — "todos" o una lista puntual) calcula
 * `lecciones completadas / lecciones del curso`, y promedia esos ratios.
 * Un alumno sin cursos accesibles (comunidad recién creada, sin cursos aún)
 * queda en 0 en vez de NaN. `cursosComunidad` debe venir ya filtrada a
 * cursos publicados (`cursosVisiblesParaMiembro`) — un borrador con
 * lecciones no debe arrastrar hacia abajo el % de un alumno con acceso
 * "todos" que ni siquiera puede verlo.
 *
 * Exportada porque `/admin/reportes` la reutiliza para calcular el % de
 * avance de un curso puntual — mismo cálculo, solo que ahí se le pasa
 * `cursosComunidad` con un único curso en vez de todos los del alumno.
 */
export function progresoPromedioDe(
  cursoIds: Enrollment["cursoIds"],
  cursosComunidad: Course[],
  userId: string,
  progreso: LessonProgress[]
): number {
  const cursosConAcceso = cursosComunidad.filter((c) => cursoIdsCubreCurso(cursoIds, c.id));

  if (cursosConAcceso.length === 0) return 0;

  const ratios = cursosConAcceso.map((curso) => {
    const lecciones = curso.modulos.flatMap((m) => m.lecciones);
    if (lecciones.length === 0) return 0;
    const completadas = progreso.filter(
      (p) => p.userId === userId && lecciones.some((l) => l.id === p.leccionId)
    ).length;
    return completadas / lecciones.length;
  });

  const promedio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.round(promedio * 100);
}

/**
 * Miembros de `comunidadId` o, si se pasa `cursoId` (Cambio 3: "Miembros" es
 * ahora una pestaña por curso), solo quienes tienen acceso a ESE curso
 * (`enrollmentCubreCurso`, punto único de verdad para ese criterio). Sin
 * `cursoId` conserva el comportamiento histórico (directorio completo de la
 * comunidad), que es lo que sigue usando `/admin/alumnos` y `/admin/reportes`.
 */
export function useMembers(comunidadId: string, cursoId?: string): { miembros: MemberConEstado[] } {
  const usuariosCreados = useAppStore((s) => s.usuariosCreados);
  const enrollmentsExtra = useAppStore((s) => s.enrollmentsExtra);
  const perfilOverrides = useAppStore((s) => s.perfilOverrides);
  const estadoOverrides = useAppStore((s) => s.estadoOverrides);
  const armazon = useAppStore((s) => s.armazon);
  const progreso = useAppStore((s) => s.progreso);

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];
  const enrollments = [...mockEnrollments, ...enrollmentsExtra].filter(
    (e) => e.comunidadId === comunidadId && (!cursoId || enrollmentCubreCurso(e, cursoId))
  );
  const cursosComunidad = cursosVisiblesParaMiembro(comunidadId, armazon?.cursos ?? []);

  const miembros = enrollments
    .map((e) => {
      const usuario = todosLosUsuarios.find((u) => u.id === e.userId);
      if (!usuario) return null;
      const estado = resolverEstadoEnrollment(e, estadoOverrides);
      const progresoPromedio = progresoPromedioDe(
        e.cursoIds,
        cursosComunidad,
        e.userId,
        progreso
      );
      return {
        ...aplicarPerfilOverride(usuario, perfilOverrides),
        estado,
        progresoPromedio,
      };
    })
    .filter((m): m is MemberConEstado => m !== null);

  return { miembros };
}
