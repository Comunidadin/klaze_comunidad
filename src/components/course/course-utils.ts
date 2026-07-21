import type { Course, CourseModule, Lesson } from "@/lib/types";

/** Todas las lecciones de un curso, en el orden en que aparecen (módulo → lección). */
export function leccionesOrdenadas(curso: Course): Lesson[] {
  return [...curso.modulos]
    .sort((a, b) => a.orden - b.orden)
    .flatMap((m) => [...m.lecciones].sort((x, y) => x.orden - y.orden));
}

/** Módulos ordenados, cada uno con sus lecciones ordenadas. */
export function modulosOrdenados(curso: Course): CourseModule[] {
  return [...curso.modulos]
    .sort((a, b) => a.orden - b.orden)
    .map((m) => ({ ...m, lecciones: [...m.lecciones].sort((x, y) => x.orden - y.orden) }));
}

/** El módulo que contiene una lección dada, o `undefined` si no pertenece al curso. */
export function moduloDeLeccion(curso: Course, leccionId: string): CourseModule | undefined {
  return curso.modulos.find((m) => m.lecciones.some((l) => l.id === leccionId));
}

export interface EstadisticasCurso {
  numLecciones: number;
  totalMin: number;
}

/** Número de lecciones y duración total (minutos) de un curso. */
export function estadisticasCurso(curso: Course): EstadisticasCurso {
  const lecciones = leccionesOrdenadas(curso);
  return {
    numLecciones: lecciones.length,
    totalMin: lecciones.reduce((acc, l) => acc + l.duracionMin, 0),
  };
}

/** "45 min" / "1 h" / "2 h 15 min" — nunca "0 h 0 min". */
export function formatDuracion(totalMin: number): string {
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;
  return `${horas} h ${minutos} min`;
}

/**
 * Primera lección no completada, en orden de módulo/lección. `null` si el
 * curso no tiene lecciones o si todas están completadas (ver
 * `todasCompletadas` para distinguir ese caso del de "sin lecciones").
 */
export function primeraLeccionPendiente(
  curso: Course,
  leccionesCompletadasIds: Set<string>
): Lesson | null {
  const lecciones = leccionesOrdenadas(curso);
  return lecciones.find((l) => !leccionesCompletadasIds.has(l.id)) ?? null;
}

export interface ProgresoModulo {
  completadas: number;
  total: number;
  pct: number;
}

/**
 * Progreso de un módulo individual — mismo cálculo que `progresoPct` de
 * `useCourses` pero acotado a las lecciones de un único módulo, para las
 * tarjetas de portada del grid de módulos.
 */
export function progresoDeModulo(
  modulo: CourseModule,
  leccionesCompletadasIds: Set<string>
): ProgresoModulo {
  const total = modulo.lecciones.length;
  const completadas = modulo.lecciones.filter((l) => leccionesCompletadasIds.has(l.id)).length;
  const pct = total === 0 ? 0 : Math.round((completadas / total) * 100);
  return { completadas, total, pct };
}
