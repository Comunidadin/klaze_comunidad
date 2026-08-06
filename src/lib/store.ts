import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Community,
  Enrollment,
  Plan,
  User,
} from "@/lib/types";
import type { Armazon } from "@/lib/supabase/consultas";

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

/** Override persistido de nombre/bio de un usuario (ver `actualizarPerfil`). */
export interface PerfilOverride {
  nombre: string;
  bio: string;
}

export interface AppState {
  /**
   * Datos traídos del servidor al iniciar sesión: quién eres, tu academia y
   * sus cursos. Reemplaza a los mocks como origen del armazón.
   *
   * NO se persiste en localStorage — ver `partialize`. Son datos del servidor
   * y guardarlos significaría enseñar el contenido de una sesión anterior a
   * quien abra después ese mismo navegador.
   */
  armazon: Armazon | null;
  /**
   * Lo fija `establecerArmazon`, nunca a mano. Se conserva como campo aparte
   * (en vez de leer `armazon.perfil.id` en cada sitio) porque varias acciones
   * internas del store lo usan y así no cambian.
   */
  currentUserId: string | null;
  establecerArmazon: (armazon: Armazon | null) => void;
  usuariosCreados: User[]; // alumnos que aceptaron invitación + creadores registrados
  enrollmentsExtra: Enrollment[]; // generados por invitaciones aceptadas
  comunidadesCreadas: Community[]; // comunidades registradas por nuevos creadores
  // Contador determinístico para el id "post-nuevo-N" de `crearPost` — mismo
  // mismo patrón de contador: nunca derivar el N de
  // `postsCreados.length`, porque `eliminarPost` quita posts de sesión de ese
  // array y un largo que vuelve a bajar generaría IDs duplicados con posts
  // que siguen vivos (keys de React y likes/comentarios keyed por postId
  // contaminados entre posts distintos).
  // Overrides de nombre/bio editados desde /perfil, keyed por userId. Se
  // guardan aparte (en vez de mutar mockUsers/usuariosCreados) porque
  // mockUsers es un array estático importado en múltiples sitios: mutarlo
  // rompería la semántica de "mock" y complicaría el reset de estado. Cada
  // hook que resuelve un `User` (useSession, useMembers, useGamification)
  // aplica el override al final vía `aplicarPerfilOverride`.
  perfilOverrides: Record<string, PerfilOverride>;
  // Override persistido de `Enrollment.estado`, keyed por `${userId}:${comunidadId}`
  // (una sola membresía por par usuario+comunidad). Ver `cambiarEstadoAlumno`:
  // suspender/reactivar desde /admin/alumnos no muta `mockEnrollments` ni
  // `enrollmentsExtra` directamente, sino que agrega/actualiza esta entrada;
  // tanto `useMembers` (estado de cada fila) como `useCourses` (gate de
  // acceso a cursos/lecciones) la aplican vía el helper `resolverEstadoEnrollment`
  // para que suspender revoque acceso real, no solo el badge de admin.
  // --- T14: moderación de comunidad, eventos y configuración -------------
  // IDs de posts eliminados desde /admin/comunidad. Solo aplica a posts del
  // seed (`mockPosts`): un post creado en sesión se quita directamente de
  // `postsCreados` en `eliminarPost` (ver docstring de esa acción), así que
  // nunca termina acá.
  // Un solo post fijado por comunidad — fijar reemplaza al anterior (mock o
  // ya fijado en sesión). `useFeed` lo aplica sobre `Post.fijado`: si la
  // comunidad tiene entrada acá, ignora el `fijado` del seed por completo.
  // Override parcial de `Community`, keyed por comunidadId. Punto único de
  // verdad para nombre/logoUrl/colorAcento (`guardarComunidad`),
  // `secciones` (`guardarSecciones`) y `nombresNiveles`
  // (`guardarNombresNiveles`) — todo hook que resuelve una `Community`
  // (useCommunity, useMyCommunity, useInvitation) lo aplica vía
  // `resolverComunidad`, así ninguna pantalla necesita su propio parche.
  comunidadOverrides: Record<string, Partial<Community>>;
  // Eventos creados/editados desde /admin/eventos — mismo patrón que
  // lo que hacían los cursos editados: un `CommunityEvent` cuyo `id` coincide con uno de
  // `mockEvents` es una edición (lo reemplaza); uno sin match es un evento
  // nuevo. `useEvents` hace el merge (ver `mergeEventos`).
  // IDs de eventos eliminados — cubre tanto eventos del seed como eventos
  // creados en sesión (a diferencia de los posts, acá no hace falta separar
  // por origen: `useEvents` simplemente excluye cualquier id presente acá
  // del resultado final del merge).
  // --- T15: panel super-admin de plataforma -------------------------------
  // Override completo de un `Plan`, keyed por `Plan.id`. A diferencia de
  // `comunidadOverrides` (que mergea parcialmente o
  // distinguen "nuevo" de "editado"), acá solo hay 3 planes fijos que nunca
  // se crean ni se borran — así que `guardarPlan` siempre reemplaza el plan
  // completo, y `resolverPlan` lo aplica sobre `mockPlans` en `usePlatform`.
  planOverrides: Record<string, Plan>;

  /**
   * Suspende/reactiva una comunidad desde `/plataforma/comunidades`. Mismo
   * mecanismo que `guardarComunidad` (override parcial en
   * `comunidadOverrides`, aplicado por `resolverComunidad` en cada hook que
   * resuelve una `Community`) — separada de esa acción porque la usa el
   * superadmin, no el creador dueño, y su firma es más angosta (solo
   * `estado`). `MemberShell` bloquea `/c/[slug]/*` a cualquier miembro no
   * superadmin en cuanto `community.estado === "suspendida"`.
   */
  cambiarEstadoComunidad: (comunidadId: string, estado: Community["estado"]) => void;
  /** Guarda un `Plan` editado desde `/plataforma/planes` — reemplazo completo en `planOverrides` (ver docstring del campo). */
  guardarPlan: (plan: Plan) => void;
  // --- Cambio 2: espacios de comunidad (layout de 3 columnas) -------------
  /**
   * Última visita de cada espacio (espacioId -> ISO), keyed por espacioId
   * global (no por comunidad+espacio: dos comunidades nunca comparten un
   * alumno viendo el mismo id de espacio en la práctica, y mantenerlo simple
   * evita una clave compuesta). El contador de "no leídos" de
   * `useEspacios` cuenta los posts de ese espacio con `creadoEl` posterior a
   * esta fecha; sin entrada, cuenta todos.
   */
  espaciosVistos: Record<string, string>;
  marcarEspacioVisto: (espacioId: string) => void;
  /** Contador determinístico para el id "esp-nuevo-N" de un espacio creado desde `/admin/comunidad` — mismo patrón que `proximoEventoId`. */
  /**
   * Reemplaza por completo `Community.secciones` de `comunidadId` en el
   * override (mismo patrón que `guardarCategorias` antes de este cambio):
   * el editor de `/admin/comunidad` mantiene su propio estado local de
   * secciones/espacios y llama esta acción en cada cambio (agregar,
   * renombrar, eliminar), así que no hace falta un merge parcial acá.
   */
}

/**
 * Aplica el override de perfil (si existe) de `usuario.id` sobre el objeto
 * base. Usarla como último paso al resolver un `User` desde `mockUsers` /
 * `usuariosCreados`, para que /perfil se refleje en useSession, useMembers
 * y useGamification sin duplicar usuarios ni mutar los mocks.
 */
export function aplicarPerfilOverride<T extends User>(
  usuario: T,
  overrides: Record<string, PerfilOverride>
): T {
  const override = overrides[usuario.id];
  if (!override) return usuario;
  return { ...usuario, nombre: override.nombre, bio: override.bio };
}

/**
 * Resuelve el estado "efectivo" de un `Enrollment` aplicando `estadoOverrides`
 * (ver `cambiarEstadoAlumno`). Punto único de verdad para cualquier código que
 * decida acceso a partir de `Enrollment.estado` — usarla tanto en `useCourses`
 * (gate de acceso a cursos/lecciones) como en `useMembers` (tabla de admin),
 * para que suspender/reactivar desde /admin/alumnos revoque/restaure acceso
 * real en toda la app y no solo el badge del panel de administración.
 */
export function resolverEstadoEnrollment(
  enrollment: Enrollment,
): Enrollment["estado"] {
  return (
    estadoOverrides[`${enrollment.userId}:${enrollment.comunidadId}`] ??
    enrollment.estado
  );
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

/**
 * Aplica `comunidadOverrides[base.id]` (si existe) sobre una `Community`
 * base (mock o de `comunidadesCreadas`). Punto único de verdad para
 * nombre/logoUrl/colorAcento/secciones/nombresNiveles editados desde
 * `/admin/comunidad` y `/admin/configuracion` — usarla en cualquier hook que
 * resuelva una `Community` (`useCommunity`, `useMyCommunity`,
 * `useInvitation`) en vez de leer los campos del mock/creada directamente,
 * para que un solo cambio (p. ej. `colorAcento`) se refleje en toda la app
 * sin parches por pantalla.
 */
export function resolverComunidad(
  base: Community,
  overrides: Record<string, Partial<Community>>
): Community {
  const override = overrides[base.id];
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Aplica `overrides[base.id]` (si existe) sobre un `Plan` base de
 * `mockPlans`. Punto único de verdad para el precio/límites vigentes de un
 * plan — usarla en cualquier hook que resuelva un `Plan` (hoy solo
 * `usePlatform`) en vez de leer `mockPlans` directamente, para que editar un
 * plan desde `/plataforma/planes` se refleje en toda la app sin parches por
 * pantalla.
 */
export function resolverPlan(base: Plan, overrides: Record<string, Plan>): Plan {
  return overrides[base.id] ?? base;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUserId: null,
      usuariosCreados: [],
      enrollmentsExtra: [],
      comunidadesCreadas: [],
      perfilOverrides: {},
      comunidadOverrides: {},
      planOverrides: {},
      espaciosVistos: {},

      armazon: null,

      // Único punto que fija la sesión. Antes lo hacía `login(email)`, que
      // aceptaba cualquier contraseña porque solo comprobaba que el correo
      // existiera en un array. Ahora la sesión la da Supabase y esto solo
      // recoge lo que trajo.
      establecerArmazon: (armazon) =>
        set({ armazon, currentUserId: armazon?.perfil.id ?? null }),

      cambiarEstadoComunidad: (comunidadId, estado) => {
        set((state) => ({
          comunidadOverrides: {
            ...state.comunidadOverrides,
            [comunidadId]: { ...state.comunidadOverrides[comunidadId], estado },
          },
        }));
      },

      guardarPlan: (plan) => {
        set((state) => ({
          planOverrides: { ...state.planOverrides, [plan.id]: plan },
        }));
      },

      marcarEspacioVisto: (espacioId) => {
        set((state) => ({
          espaciosVistos: { ...state.espaciosVistos, [espacioId]: new Date().toISOString() },
        }));
      },
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
