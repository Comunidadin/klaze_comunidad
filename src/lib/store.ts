import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Enrollment } from "@/lib/types";
import type { Armazon } from "@/lib/supabase/consultas";

/**
 * Estado de interfaz, y nada más.
 *
 * Todo el dominio —usuarios, academias, cursos, inscripciones, planes, feed—
 * vive en Postgres y se lee por los módulos de `src/lib/supabase/`. Aquí solo
 * queda lo que el servidor trajo al entrar (`armazon`) y una preferencia de
 * lectura de este navegador (`espaciosVistos`).
 *
 * Hubo un tiempo en que este archivo guardaba comunidades, usuarios,
 * inscripciones y tres mapas de "overrides" para simular ediciones sin tocar
 * los datos semilla. Cada uno de ellos era un sitio donde la app podía
 * discrepar de la base.
 */

/**
 * Claves que NO se guardan en localStorage.
 *
 * Son datos del servidor atados a una sesión: persistirlos significaría que
 * quien abra este navegador después vea el contenido —y la identidad— de quien
 * lo usó antes, sin haber iniciado sesión. La sesión real la guarda Supabase
 * en su propia cookie, y `establecerArmazon` los repone en cada arranque.
 */
const CLAVES_SIN_PERSISTIR: string[] = ["armazon", "currentUserId"];

/** Exportado porque `/admin/cursos` la reutiliza para derivar el slug de un curso nuevo. */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface AppState {
  /**
   * Datos traídos del servidor al iniciar sesión: quién eres, tu academia y
   * sus cursos.
   *
   * NO se persiste en localStorage — ver `partialize`.
   */
  armazon: Armazon | null;
  /**
   * Lo fija `establecerArmazon`, nunca a mano. Se conserva como campo aparte
   * (en vez de leer `armazon.perfil.id` en cada sitio) porque varias acciones
   * internas del store lo usan y así no cambian.
   */
  currentUserId: string | null;
  establecerArmazon: (armazon: Armazon | null) => void;

  /**
   * Última visita de cada espacio (espacioId -> ISO).
   *
   * Vive en el navegador y no en la base a propósito: es una preferencia de
   * lectura de ESTE dispositivo. Guardarla en Postgres obligaría a decidir qué
   * pasa cuando alguien lee en el móvil y luego abre el portátil, y esa
   * complejidad no compra nada.
   *
   * `useEspacios` cuenta como "no leídos" los posts de ese espacio con
   * `creadoEl` posterior a esta fecha; sin entrada, cuenta todos.
   */
  espaciosVistos: Record<string, string>;
  marcarEspacioVisto: (espacioId: string) => void;

  /**
   * La academia elegida en ESTE navegador, cuando se pertenece a varias.
   *
   * Preferencia de interfaz, como `espaciosVistos`: se persiste (es solo un
   * id) y `cargarArmazon` la usa para decidir qué academia cargar. Si deja de
   * estar en la lista —te echaron, se suspendió— se ignora sola.
   */
  academiaActivaId: string | null;
  fijarAcademiaActiva: (id: string | null) => void;

  /**
   * Academias donde el alumno descartó la tarjeta «Empieza aquí»
   * (comunidadId -> true). Preferencia de este navegador, persistida.
   */
  checklistOculto: Record<string, true>;
  ocultarChecklist: (comunidadId: string) => void;

  /**
   * Hasta cuándo están vistas las notificaciones de cada academia
   * (comunidadId -> ISO). Al abrir la campanita se adelanta a «ahora».
   */
  notificacionesVistas: Record<string, string>;
  marcarNotificacionesVistas: (comunidadId: string) => void;
}

/**
 * `true` si un `cursoIds` de enrollment (`"todos"` o una lista puntual) cubre
 * `cursoId`. Punto único de verdad para "¿este acceso incluye este curso?" —
 * usarla en cualquier código que decida acceso o cuente alumnos a partir de
 * `Enrollment.cursoIds`/`Invitation.cursoIds`, para no reimplementar el
 * mismo ternario `cursoIds === "todos" || cursoIds.includes(...)` en cada
 * hook (ya divergió una vez entre `useCourses` y `useAdminCourses`).
 */
export function cursoIdsCubreCurso(
  cursoIds: Enrollment["cursoIds"],
  cursoId: string
): boolean {
  return cursoIds === "todos" || cursoIds.includes(cursoId);
}

/** Atajo de `cursoIdsCubreCurso` para un `Enrollment` completo. */
export function enrollmentCubreCurso(enrollment: Enrollment, cursoId: string): boolean {
  return cursoIdsCubreCurso(enrollment.cursoIds, cursoId);
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUserId: null,
      espaciosVistos: {},
      armazon: null,

      // Único punto que fija la sesión. Antes lo hacía `login(email)`, que
      // aceptaba cualquier contraseña porque solo comprobaba que el correo
      // existiera en un array. Ahora la sesión la da Supabase y esto solo
      // recoge lo que trajo.
      establecerArmazon: (armazon) =>
        set({ armazon, currentUserId: armazon?.perfil.id ?? null }),

      marcarEspacioVisto: (espacioId) => {
        set((state) => ({
          espaciosVistos: {
            ...state.espaciosVistos,
            [espacioId]: new Date().toISOString(),
          },
        }));
      },

      academiaActivaId: null,
      fijarAcademiaActiva: (id) => set({ academiaActivaId: id }),

      checklistOculto: {},
      ocultarChecklist: (comunidadId) =>
        set((state) => ({
          checklistOculto: { ...state.checklistOculto, [comunidadId]: true },
        })),

      notificacionesVistas: {},
      marcarNotificacionesVistas: (comunidadId) =>
        set((state) => ({
          notificacionesVistas: {
            ...state.notificacionesVistas,
            [comunidadId]: new Date().toISOString(),
          },
        })),
    }),
    {
      name: "intercambio-v1",
      skipHydration: true,
      /**
       * `armazon` y `currentUserId` quedan fuera de localStorage a propósito.
       *
       * Son datos del servidor atados a una sesión: persistirlos significaría
       * que quien abra este navegador después vea el contenido —y la
       * identidad— de quien lo usó antes, sin haber iniciado sesión. La sesión
       * real la guarda Supabase en su cookie, y `establecerArmazon` los repone
       * en cada arranque.
       */
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([clave]) => !CLAVES_SIN_PERSISTIR.includes(clave)
          )
        ) as AppState,
    }
  )
);
