"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useSession } from "@/lib/hooks/use-session";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { marcarLeccion } from "@/lib/supabase/progreso";
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
  return cursosDeComunidad(comunidadId, cursos)
    .filter((c) => c.publicado)
    // Y dentro, fuera los módulos en borrador. Se hace AQUÍ y no en cada
    // pantalla porque este es el punto único: así el progreso, las filas y el
    // "continuar" dejan de contar lo que el miembro no puede abrir, sin que
    // ninguno de ellos tenga que saber que existe el borrador.
    .map((c) => ({ ...c, modulos: c.modulos.filter((m) => m.publicado) }));
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
  const { user } = useSession();

  // Derivar con useMemo, nunca dentro del selector: crear arrays nuevos ahí
  // rompe el invariante de `useSyncExternalStore` en React 19.
  return useMemo(() => {
    const cursos = cursosVisiblesParaMiembro(comunidadId, armazon?.cursos ?? []);
    const nivelUsuario = user ? nivelPorPuntos(user.puntos) : 0;
    const completadasIds = new Set(armazon?.progreso ?? []);

    const cursosConAcceso: CourseConAcceso[] = cursos.map((curso) => {
      const lecciones = leccionesDeCurso(curso);
      // `armazon.progreso` ya son solo las lecciones de esta persona: RLS no
      // deja ver las de nadie más, así que no hay que filtrar por usuario.
      const completadas = lecciones.filter((l) =>
        completadasIds.has(l.id)
      ).length;
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
  }, [armazon, comunidadId, user]);
}

export interface UseLessonResult {
  leccion: Lesson;
  completada: boolean;
  toggle: () => Promise<void>;
}

export function useLesson(
  cursoId: string,
  leccionId: string
): UseLessonResult | null {
  const armazon = useAppStore((s) => s.armazon);
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);

  const curso = (armazon?.cursos ?? []).find((c) => c.id === cursoId);
  if (!curso) return null;

  const leccion = leccionesDeCurso(curso).find((l) => l.id === leccionId);
  if (!leccion) return null;

  const completada = (armazon?.progreso ?? []).includes(leccionId);

  return {
    leccion,
    completada,
    // Escribe en la base y recarga el armazón: sin la recarga, la marca se
    // vería puesta pero desaparecería al cambiar de pantalla.
    toggle: async () => {
      const supabase = crearClienteNavegador();
      await marcarLeccion(supabase, leccionId, !completada);
      establecerArmazon(await cargarArmazon(supabase));
    },
  };
}
