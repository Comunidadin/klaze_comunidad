import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Community,
  CommunityEvent,
  CommunitySection,
  Enrollment,
  Invitation,
  LessonProgress,
  Plan,
  Post,
  PostComment,
  User,
} from "@/lib/types";
import type { Armazon } from "@/lib/supabase/consultas";
import { mockPosts } from "@/lib/mocks/posts";

/**
 * Claves que NO se guardan en localStorage.
 *
 * Son datos del servidor atados a una sesión: persistirlos significaría que
 * quien abra este navegador después vea el contenido —y la identidad— de quien
 * lo usó antes, sin haber iniciado sesión. La sesión real la guarda Supabase
 * en su propia cookie, y `establecerArmazon` los repone en cada arranque.
 */
const CLAVES_SIN_PERSISTIR: string[] = ["armazon", "currentUserId"];

const CURSO_1_ID = "curso-1";

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

// Invitación pre-sembrada para poder probar /invitacion/inv-demo (Task 6)
// sin depender de haber generado una invitación primero.
const INVITACION_DEMO: Invitation = {
  token: "inv-demo",
  email: "invitado.demo@mail.com",
  comunidadId: "com-principal",
  cursoIds: [CURSO_1_ID],
  estado: "pendiente",
  creadaEl: "2026-07-13T12:00:00.000Z",
};

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
  invitaciones: Invitation[];
  enrollmentsExtra: Enrollment[]; // generados por invitaciones aceptadas
  progreso: LessonProgress[];
  postsCreados: Post[];
  likesDados: { postId: string; userId: string }[];
  comentariosCreados: { postId: string; comentario: PostComment; parentId: string | null }[];
  comunidadesCreadas: Community[]; // comunidades registradas por nuevos creadores
  proximoInviteId: number; // contador determinístico para tokens "inv-N"
  // Contador determinístico para el id "post-nuevo-N" de `crearPost` — mismo
  // patrón que `proximoInviteId`/`proximoLeccionId`: nunca derivar el N de
  // `postsCreados.length`, porque `eliminarPost` quita posts de sesión de ese
  // array y un largo que vuelve a bajar generaría IDs duplicados con posts
  // que siguen vivos (keys de React y likes/comentarios keyed por postId
  // contaminados entre posts distintos).
  proximoPostId: number;
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
  estadoOverrides: Record<string, Enrollment["estado"]>;
  // --- T14: moderación de comunidad, eventos y configuración -------------
  // IDs de posts eliminados desde /admin/comunidad. Solo aplica a posts del
  // seed (`mockPosts`): un post creado en sesión se quita directamente de
  // `postsCreados` en `eliminarPost` (ver docstring de esa acción), así que
  // nunca termina acá.
  postsEliminados: string[];
  // Un solo post fijado por comunidad — fijar reemplaza al anterior (mock o
  // ya fijado en sesión). `useFeed` lo aplica sobre `Post.fijado`: si la
  // comunidad tiene entrada acá, ignora el `fijado` del seed por completo.
  postFijadoPorComunidad: Record<string, string>;
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
  eventosEditados: CommunityEvent[];
  // IDs de eventos eliminados — cubre tanto eventos del seed como eventos
  // creados en sesión (a diferencia de los posts, acá no hace falta separar
  // por origen: `useEvents` simplemente excluye cualquier id presente acá
  // del resultado final del merge).
  eventosEliminados: string[];
  proximoEventoId: number;
  // --- T15: panel super-admin de plataforma -------------------------------
  // Override completo de un `Plan`, keyed por `Plan.id`. A diferencia de
  // `comunidadOverrides` (que mergea parcialmente o
  // distinguen "nuevo" de "editado"), acá solo hay 3 planes fijos que nunca
  // se crean ni se borran — así que `guardarPlan` siempre reemplaza el plan
  // completo, y `resolverPlan` lo aplica sobre `mockPlans` en `usePlatform`.
  planOverrides: Record<string, Plan>;

  crearInvitaciones: (
    emails: string[],
    comunidadId: string,
    cursoIds: string[] | "todos"
  ) => Invitation[];
  aceptarInvitacion: (token: string, nombre: string) => User | null;
  toggleLeccionCompleta: (leccionId: string) => void;
  crearPost: (post: Omit<Post, "id" | "creadoEl" | "likes" | "comentarios">) => void;
  toggleLike: (postId: string) => void;
  comentar: (postId: string, cuerpo: string, parentId: string | null) => void;
  actualizarPerfil: (nombre: string, bio: string) => void;
  cambiarEstadoAlumno: (
    userId: string,
    comunidadId: string,
    estado: Enrollment["estado"]
  ) => void;
  /** Elimina un post (mock -> `postsEliminados`; creado en sesión -> se quita de `postsCreados`). */
  eliminarPost: (postId: string) => void;
  /** Fija `postId` en su comunidad, reemplazando cualquier fijado anterior (solo 1 por comunidad). */
  fijarPost: (postId: string) => void;
  /** `nombres` debe traer los 9 nombres de nivel, en orden (nivel 1..9). */
  guardarNombresNiveles: (comunidadId: string, nombres: string[]) => void;
  guardarComunidad: (
    comunidadId: string,
    cambios: Partial<Pick<Community, "nombre" | "logoUrl" | "colorAcento">>
  ) => void;
  /** ID determinístico "evt-nuevo-N" para un evento nuevo creado desde /admin/eventos. */
  siguienteEventoId: () => string;
  guardarEvento: (evento: CommunityEvent) => void;
  eliminarEvento: (eventoId: string) => void;
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
  proximoEspacioId: number;
  siguienteEspacioId: () => string;
  /**
   * Reemplaza por completo `Community.secciones` de `comunidadId` en el
   * override (mismo patrón que `guardarCategorias` antes de este cambio):
   * el editor de `/admin/comunidad` mantiene su propio estado local de
   * secciones/espacios y llama esta acción en cada cambio (agregar,
   * renombrar, eliminar), así que no hace falta un merge parcial acá.
   */
  guardarSecciones: (comunidadId: string, secciones: CommunitySection[]) => void;
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
  estadoOverrides: Record<string, Enrollment["estado"]>
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
    (set, get) => ({
      currentUserId: null,
      usuariosCreados: [],
      invitaciones: [INVITACION_DEMO],
      enrollmentsExtra: [],
      progreso: [],
      postsCreados: [],
      likesDados: [],
      comentariosCreados: [],
      comunidadesCreadas: [],
      proximoInviteId: 1,
      proximoPostId: 1,
      perfilOverrides: {},
      estadoOverrides: {},
      postsEliminados: [],
      postFijadoPorComunidad: {},
      comunidadOverrides: {},
      eventosEditados: [],
      eventosEliminados: [],
      proximoEventoId: 1,
      planOverrides: {},
      espaciosVistos: {},
      proximoEspacioId: 1,

      armazon: null,

      // Único punto que fija la sesión. Antes lo hacía `login(email)`, que
      // aceptaba cualquier contraseña porque solo comprobaba que el correo
      // existiera en un array. Ahora la sesión la da Supabase y esto solo
      // recoge lo que trajo.
      establecerArmazon: (armazon) =>
        set({ armazon, currentUserId: armazon?.perfil.id ?? null }),

      crearInvitaciones: (emails, comunidadId, cursoIds) => {
        const inicio = get().proximoInviteId;
        const nuevas: Invitation[] = emails.map((email, i) => ({
          token: `inv-${inicio + i}`,
          email: email.trim().toLowerCase(),
          comunidadId,
          cursoIds,
          estado: "pendiente",
          creadaEl: new Date().toISOString(),
        }));
        set((state) => ({
          invitaciones: [...state.invitaciones, ...nuevas],
          proximoInviteId: inicio + emails.length,
        }));
        return nuevas;
      },

      aceptarInvitacion: (token, nombre) => {
        const invitacion = get().invitaciones.find(
          (inv) => inv.token === token && inv.estado === "pendiente"
        );
        if (!invitacion) return null;

        const nuevoUsuario: User = {
          id: `u-inv-${token}`,
          email: invitacion.email,
          nombre,
          avatarUrl: `https://i.pravatar.cc/150?u=${token}`,
          bio: "",
          rol: "alumno",
          comunidadIds: [invitacion.comunidadId],
          puntos: 0,
          nivel: 1,
          creadoEl: new Date().toISOString(),
        };

        const nuevoEnrollment: Enrollment = {
          id: `enr-inv-${token}`,
          userId: nuevoUsuario.id,
          comunidadId: invitacion.comunidadId,
          cursoIds: invitacion.cursoIds,
          estado: "activo",
        };

        set((state) => ({
          usuariosCreados: [...state.usuariosCreados, nuevoUsuario],
          invitaciones: state.invitaciones.map((inv) =>
            inv.token === token ? { ...inv, estado: "aceptada" as const } : inv
          ),
          enrollmentsExtra: [...state.enrollmentsExtra, nuevoEnrollment],
          currentUserId: nuevoUsuario.id,
        }));

        return nuevoUsuario;
      },

      toggleLeccionCompleta: (leccionId) => {
        const userId = get().currentUserId;
        if (!userId) return;
        set((state) => {
          const yaExiste = state.progreso.some(
            (p) => p.userId === userId && p.leccionId === leccionId
          );
          if (yaExiste) {
            return {
              progreso: state.progreso.filter(
                (p) => !(p.userId === userId && p.leccionId === leccionId)
              ),
            };
          }
          const nuevo: LessonProgress = {
            userId,
            leccionId,
            completadaEl: new Date().toISOString(),
          };
          return { progreso: [...state.progreso, nuevo] };
        });
      },

      crearPost: (post) => {
        set((state) => {
          const nuevo: Post = {
            ...post,
            id: `post-nuevo-${state.proximoPostId}`,
            creadoEl: new Date().toISOString(),
            likes: [],
            comentarios: [],
          };
          return {
            postsCreados: [...state.postsCreados, nuevo],
            proximoPostId: state.proximoPostId + 1,
          };
        });
      },

      toggleLike: (postId) => {
        const userId = get().currentUserId;
        if (!userId) return;
        set((state) => {
          const yaExiste = state.likesDados.some(
            (l) => l.postId === postId && l.userId === userId
          );
          if (yaExiste) {
            return {
              likesDados: state.likesDados.filter(
                (l) => !(l.postId === postId && l.userId === userId)
              ),
            };
          }
          return { likesDados: [...state.likesDados, { postId, userId }] };
        });
      },

      comentar: (postId, cuerpo, parentId) => {
        const userId = get().currentUserId;
        if (!userId) return;
        set((state) => {
          const nuevoComentario: PostComment = {
            id: `comentario-nuevo-${state.comentariosCreados.length + 1}`,
            autorId: userId,
            cuerpo,
            likes: [],
            respuestas: [],
            creadoEl: new Date().toISOString(),
          };
          return {
            comentariosCreados: [
              ...state.comentariosCreados,
              { postId, comentario: nuevoComentario, parentId },
            ],
          };
        });
      },

      actualizarPerfil: (nombre, bio) => {
        const userId = get().currentUserId;
        if (!userId) return;
        set((state) => ({
          perfilOverrides: {
            ...state.perfilOverrides,
            [userId]: { nombre, bio },
          },
        }));
      },

      cambiarEstadoAlumno: (userId, comunidadId, estado) => {
        set((state) => ({
          estadoOverrides: {
            ...state.estadoOverrides,
            [`${userId}:${comunidadId}`]: estado,
          },
        }));
      },

      eliminarPost: (postId) => {
        set((state) => {
          const esCreadoEnSesion = state.postsCreados.some((p) => p.id === postId);
          if (esCreadoEnSesion) {
            return { postsCreados: state.postsCreados.filter((p) => p.id !== postId) };
          }
          if (state.postsEliminados.includes(postId)) return state;
          return { postsEliminados: [...state.postsEliminados, postId] };
        });
      },

      fijarPost: (postId) => {
        // Se resuelve la comunidad del post ANTES de `set` (no dentro del
        // callback) porque necesita `mockPosts` + el `postsCreados` vigente:
        // un post recién creado en esta misma sesión debe poder fijarse
        // igual que uno del seed.
        const post = [...mockPosts, ...get().postsCreados].find((p) => p.id === postId);
        if (!post) return;
        set((state) => ({
          postFijadoPorComunidad: {
            ...state.postFijadoPorComunidad,
            [post.comunidadId]: postId,
          },
        }));
      },

      guardarSecciones: (comunidadId, secciones) => {
        set((state) => ({
          comunidadOverrides: {
            ...state.comunidadOverrides,
            [comunidadId]: { ...state.comunidadOverrides[comunidadId], secciones },
          },
        }));
      },

      guardarNombresNiveles: (comunidadId, nombres) => {
        set((state) => ({
          comunidadOverrides: {
            ...state.comunidadOverrides,
            [comunidadId]: { ...state.comunidadOverrides[comunidadId], nombresNiveles: nombres },
          },
        }));
      },

      guardarComunidad: (comunidadId, cambios) => {
        set((state) => ({
          comunidadOverrides: {
            ...state.comunidadOverrides,
            [comunidadId]: { ...state.comunidadOverrides[comunidadId], ...cambios },
          },
        }));
      },

      siguienteEventoId: () => {
        const id = `evt-nuevo-${get().proximoEventoId}`;
        set((s) => ({ proximoEventoId: s.proximoEventoId + 1 }));
        return id;
      },

      guardarEvento: (evento) => {
        set((state) => {
          const existe = state.eventosEditados.some((e) => e.id === evento.id);
          const eventosEditados = existe
            ? state.eventosEditados.map((e) => (e.id === evento.id ? evento : e))
            : [...state.eventosEditados, evento];
          return { eventosEditados };
        });
      },

      eliminarEvento: (eventoId) => {
        set((state) => {
          if (state.eventosEliminados.includes(eventoId)) return state;
          return { eventosEliminados: [...state.eventosEliminados, eventoId] };
        });
      },

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

      siguienteEspacioId: () => {
        const id = `esp-nuevo-${get().proximoEspacioId}`;
        set((s) => ({ proximoEspacioId: s.proximoEspacioId + 1 }));
        return id;
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
