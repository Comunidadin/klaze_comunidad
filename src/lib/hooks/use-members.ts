"use client";

import { useCallback, useEffect, useState } from "react";
import { cursoIdsCubreCurso, useAppStore } from "@/lib/store";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { listarAlumnos, type AlumnoEnComunidad } from "@/lib/supabase/alumnos";
import { cursosVisiblesParaMiembro } from "@/lib/hooks/use-courses";
import { nivelPorPuntos } from "@/lib/levels";
import type { Course, Enrollment, LessonProgress, User } from "@/lib/types";

export type MemberConEstado = User & {
  estado: Enrollment["estado"];
  /** 0-100, promedio de `completadas/total` sobre los cursos con acceso. */
  progresoPromedio: number;
};

/**
 * Progreso promedio de un alumno: para cada curso al que tiene acceso calcula
 * `lecciones completadas / lecciones del curso`, y promedia esos ratios.
 *
 * Un alumno sin cursos accesibles queda en 0 en vez de NaN. `cursosComunidad`
 * debe venir ya filtrada a publicados: un borrador con lecciones no debe
 * arrastrar hacia abajo el porcentaje de alguien que ni siquiera puede verlo.
 *
 * Exportada porque `/admin/reportes` la reutiliza para el avance de un curso
 * puntual — mismo cálculo, pasándole un solo curso.
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

function aMiembro(
  alumno: AlumnoEnComunidad,
  comunidadId: string,
  progresoPromedio: number
): MemberConEstado {
  return {
    id: alumno.usuarioId,
    email: alumno.email,
    nombre: alumno.nombre,
    avatarUrl: alumno.avatarUrl,
    bio: alumno.bio,
    rol: alumno.rol as User["rol"],
    comunidadIds: [comunidadId],
    puntos: alumno.puntos,
    nivel: nivelPorPuntos(alumno.puntos),
    creadoEl: alumno.creadoEl,
    estado: alumno.estado,
    progresoPromedio,
  };
}

/**
 * Es `async` aunque una rama no espere nada, para que el `.then()` que fija el
 * estado no corra de forma síncrona dentro del efecto.
 */
async function leerMiembros(
  comunidadId: string
): Promise<{ alumnos: AlumnoEnComunidad[]; progreso: LessonProgress[] }> {
  if (!comunidadId) return { alumnos: [], progreso: [] };

  const supabase = crearClienteNavegador();
  const alumnos = await listarAlumnos(supabase, comunidadId);

  // El avance NO sale de la tabla `progreso` —es privada, hasta para el dueño—
  // sino de una función que solo devuelve las filas de SUS cursos.
  const { data } = await supabase.rpc("progreso_de_mis_alumnos", {
    p_comunidad: comunidadId,
  });

  const progreso: LessonProgress[] = (
    (data ?? []) as {
      usuario_id: string;
      leccion_id: string;
      completada_el: string;
    }[]
  ).map((p) => ({
    userId: p.usuario_id,
    leccionId: p.leccion_id,
    completadaEl: p.completada_el,
  }));

  return { alumnos, progreso };
}

/**
 * Miembros de `comunidadId` o, si se pasa `cursoId`, solo quienes tienen
 * acceso a ESE curso. Conserva su forma de retorno para que ninguna pantalla
 * cambie.
 */
export function useMembers(
  comunidadId: string,
  cursoId?: string
): {
  miembros: MemberConEstado[];
  /**
   * Qué cursos cubre el acceso de cada alumno, indexado por su id.
   *
   * Se expone porque `useAdminCourses` cuenta alumnos por curso y necesita ese
   * criterio. Antes lo recalculaba sobre mocks y overrides, con el riesgo de
   * discrepar de lo que decide la base: dos verdades para la misma pregunta.
   */
  accesos: Map<string, { todos: boolean; cursoIds: string[] }>;
  /**
   * Lecciones completadas por los alumnos de esta comunidad.
   *
   * Sale de `progreso_de_mis_alumnos`, no de la tabla `progreso`, que es
   * privada de cada alumno. La expone para `/admin/reportes`, que necesita
   * el detalle para sus gráficas.
   */
  progreso: LessonProgress[];
  recargar: () => Promise<void>;
} {
  const armazon = useAppStore((s) => s.armazon);
  const [alumnos, setAlumnos] = useState<AlumnoEnComunidad[]>([]);
  const [progreso, setProgreso] = useState<LessonProgress[]>([]);

  const recargar = useCallback(async () => {
    const r = await leerMiembros(comunidadId);
    setAlumnos(r.alumnos);
    setProgreso(r.progreso);
  }, [comunidadId]);

  useEffect(() => {
    let vivo = true;
    void leerMiembros(comunidadId).then((r) => {
      if (!vivo) return;
      setAlumnos(r.alumnos);
      setProgreso(r.progreso);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId]);

  const cursosComunidad = cursosVisiblesParaMiembro(comunidadId, armazon?.cursos ?? []);

  const miembros = alumnos
    .filter((a) => {
      if (!cursoId) return true;
      return a.todosLosCursos || a.cursoIds.includes(cursoId);
    })
    .map((a) =>
      aMiembro(
        a,
        comunidadId,
        progresoPromedioDe(
          a.todosLosCursos ? "todos" : a.cursoIds,
          cursosComunidad,
          a.usuarioId,
          progreso
        )
      )
    );

  const accesos = new Map(
    alumnos.map((a) => [
      a.usuarioId,
      { todos: a.todosLosCursos, cursoIds: a.cursoIds },
    ])
  );

  return { miembros, accesos, progreso, recargar };
}
