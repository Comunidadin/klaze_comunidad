"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useSession } from "@/lib/hooks/use-session";
import { useAhora } from "@/lib/hooks/use-ahora";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { marcarLeccion } from "@/lib/supabase/progreso";
import { nivelPorPuntos } from "@/lib/levels";
import { fechaDeApertura } from "@/lib/goteo";
import type { Course, Lesson } from "@/lib/types";

export type AccesoCurso = "si" | "candado-nivel" | "candado-fecha" | "sin-acceso";

export type CourseConAcceso = Course & {
  acceso: AccesoCurso;
  /**
   * Instante en que se abre, o `null` si ya está abierto.
   *
   * Se calcula aquí y no en la tarjeta para que el cálculo ocurra una vez por
   * módulo y no una por render, y para que la tarjeta solo tenga que
   * formatearlo.
   */
  abreEl: Date | null;
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
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const { user } = useSession();
  // El reloj entra por `useAhora` y no por `new Date()` dentro del memo: sin
  // una dependencia que cambie con el tiempo, la cuenta atrás se queda
  // congelada y el módulo sigue bloqueado después de haber abierto. Justo a
  // quien deja la pestaña abierta esperando.
  const ahoraMs = useAhora();

  // Derivar con useMemo, nunca dentro del selector: crear arrays nuevos ahí
  // rompe el invariante de `useSyncExternalStore` en React 19.
  const cursos = useMemo(() => {
    const cursos = cursosVisiblesParaMiembro(comunidadId, armazon?.cursos ?? []);
    const nivelUsuario = user ? nivelPorPuntos(user.puntos) : 0;
    const completadasIds = new Set(armazon?.progreso ?? []);
    const ahora = new Date(ahoraMs);
    const entradaEl = armazon?.entradaEl ?? null;

    // El dueño de la academia no tiene candado, ni por fecha ni por nivel: esto
    // replica la rama del dueño de las políticas de Postgres ("modulos: via su
    // curso" / "lecciones: via su modulo" en
    // 20260812193847_goteo_de_contenido.sql), que le entrega el módulo entero
    // sin mirar `goteo_modo` ni `nivel_requerido`. No es una excepción de
    // pantalla: sin este espejo, el navegador quedaba MÁS restrictivo que la
    // base — Postgres ya le entregaba el contenido y solo la pantalla se lo
    // escondía, justo al revés de lo que promete el editor ("Tú lo ves
    // siempre, para poder prepararlo").
    const esPropietario =
      !!user &&
      !!armazon?.comunidad &&
      armazon.comunidad.id === comunidadId &&
      armazon.comunidad.ownerId === user.id;

    const cursosConAcceso: CourseConAcceso[] = cursos.map((curso) => {
      const lecciones = leccionesDeCurso(curso);
      // `armazon.progreso` ya son solo las lecciones de esta persona: RLS no
      // deja ver las de nadie más, así que no hay que filtrar por usuario.
      const completadas = lecciones.filter((l) =>
        completadasIds.has(l.id)
      ).length;
      const progresoPct =
        lecciones.length === 0 ? 0 : Math.round((completadas / lecciones.length) * 100);

      const abreEl = esPropietario ? null : fechaDeApertura(curso, entradaEl, ahora);

      // El orden importa: primero «no tienes acceso», que es lo más fuerte;
      // luego «eres el dueño», que anula los dos candados de abajo; luego el
      // nivel, que depende de lo que haga el alumno; y por último la fecha, que
      // depende solo de esperar. Si un módulo estuviera bajo dos candados,
      // decirle «sube de nivel» es más accionable que «espera».
      const acceso: AccesoCurso = !user
        ? "sin-acceso"
        : esPropietario
          ? "si"
          : curso.nivelRequerido !== null && nivelUsuario < curso.nivelRequerido
            ? "candado-nivel"
            : abreEl
              ? "candado-fecha"
              : "si";

      return { ...curso, acceso, abreEl, progresoPct };
    });

    return cursosConAcceso;
  }, [armazon, comunidadId, user, ahoraMs]);

  // Recarga el armazón cuando un módulo pasa de cerrado a abierto.
  //
  // Sin esto, `useAhora` sí mueve `abreEl` a `null` y la tarjeta se desbloquea,
  // pero el armazón se cargó UNA VEZ al entrar y sigue trayendo el curso con
  // "0 submódulos · 0 clases" — el candado que ya no debería estar ahí sigue
  // vacío. Justo a quien deja la pestaña abierta esperando, la persona más
  // enganchada, es a quien le pasa esto.
  //
  // Vive aquí y no en cada pantalla que consume `useCourses` porque son varias
  // (la lista de módulos, la ficha del curso, el detalle de un submódulo) y
  // todas comparten el mismo síntoma; un solo sitio evita que alguna se quede
  // sin el arreglo.
  //
  // El `ref` (no un `useState`) guarda qué módulos estaban bloqueados en el
  // render anterior, y por eso no dispara el efecto de nuevo: escribirlo aquí
  // no cambia ninguna dependencia de este `useMemo`, así que no hay bucle. Lo
  // que sí lo cambiaría es guardar la recarga en `armazon` sin que la
  // transición vuelva a ocurrir — y no ocurre: en el siguiente render el curso
  // ya no está en el conjunto de bloqueados, así que no se detecta como "recién
  // abierto" otra vez.
  const bloqueadosPrevios = useRef<Set<string>>(new Set());
  useEffect(() => {
    let vivo = true;
    const bloqueadosAhora = new Set(
      cursos.filter((c) => c.abreEl !== null).map((c) => c.id)
    );
    const seAbrioAlguno = Array.from(bloqueadosPrevios.current).some(
      (id) => !bloqueadosAhora.has(id)
    );
    bloqueadosPrevios.current = bloqueadosAhora;

    if (seAbrioAlguno) {
      // Async y con `.then()` fijando el estado, nunca un `setState` directo
      // dentro del efecto — mismo patrón que `useFeed`/`useEspacios`.
      void cargarArmazon(crearClienteNavegador()).then((nuevo) => {
        if (vivo) establecerArmazon(nuevo);
      });
    }

    return () => {
      vivo = false;
    };
  }, [cursos, establecerArmazon]);

  return { cursos };
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
