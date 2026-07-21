import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Community,
  Course,
  Enrollment,
  Invitation,
  LessonProgress,
  Post,
  PostComment,
  User,
} from "@/lib/types";
import { mockUsers } from "@/lib/mocks/users";

const CURSO_1_ID = "curso-1";

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const NOMBRES_NIVELES_DEFAULT = [
  "Novato",
  "Explorador",
  "Aprendiz",
  "Constructor",
  "Práctico",
  "Avanzado",
  "Experto",
  "Mentor",
  "Leyenda",
];

const CATEGORIAS_DEFAULT = ["Anuncios", "General", "Wins", "Preguntas"];

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

export interface KlazeState {
  currentUserId: string | null;
  usuariosCreados: User[]; // alumnos que aceptaron invitación + creadores registrados
  invitaciones: Invitation[];
  enrollmentsExtra: Enrollment[]; // generados por invitaciones aceptadas
  progreso: LessonProgress[];
  postsCreados: Post[];
  likesDados: { postId: string; userId: string }[];
  comentariosCreados: { postId: string; comentario: PostComment; parentId: string | null }[];
  cursosEditados: Course[]; // overrides de cursos creados/editados en admin
  comunidadesCreadas: Community[]; // comunidades registradas por nuevos creadores
  proximoInviteId: number; // contador determinístico para tokens "inv-N"
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

  login: (email: string) => boolean;
  logout: () => void;
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
  guardarCurso: (curso: Course) => void;
  registrarCreador: (
    nombre: string,
    email: string,
    nombreComunidad: string
  ) => { user: User; community: Community };
  actualizarPerfil: (nombre: string, bio: string) => void;
  cambiarEstadoAlumno: (
    userId: string,
    comunidadId: string,
    estado: Enrollment["estado"]
  ) => void;
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

export const useKlazeStore = create<KlazeState>()(
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
      cursosEditados: [],
      comunidadesCreadas: [],
      proximoInviteId: 1,
      perfilOverrides: {},
      estadoOverrides: {},

      login: (email) => {
        const objetivo = email.trim().toLowerCase();
        const todos = [...mockUsers, ...get().usuariosCreados];
        const encontrado = todos.find((u) => u.email.toLowerCase() === objetivo);
        if (!encontrado) return false;
        set({ currentUserId: encontrado.id });
        return true;
      },

      logout: () => set({ currentUserId: null }),

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
            id: `post-nuevo-${state.postsCreados.length + 1}`,
            creadoEl: new Date().toISOString(),
            likes: [],
            comentarios: [],
          };
          return { postsCreados: [...state.postsCreados, nuevo] };
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

      guardarCurso: (curso) => {
        set((state) => {
          const existe = state.cursosEditados.some((c) => c.id === curso.id);
          const cursosEditados = existe
            ? state.cursosEditados.map((c) => (c.id === curso.id ? curso : c))
            : [...state.cursosEditados, curso];
          return { cursosEditados };
        });
      },

      registrarCreador: (nombre, email, nombreComunidad) => {
        const state = get();
        const idComunidad = `com-${slugify(nombreComunidad)}-${state.comunidadesCreadas.length + 1}`;
        const idUsuario = `u-creador-nueva-${state.comunidadesCreadas.length + 1}`;

        const nuevoUsuario: User = {
          id: idUsuario,
          email: email.trim().toLowerCase(),
          nombre,
          avatarUrl: `https://i.pravatar.cc/150?u=${idUsuario}`,
          bio: "",
          rol: "creador",
          comunidadIds: [idComunidad],
          puntos: 0,
          nivel: 1,
          creadoEl: new Date().toISOString(),
        };

        const nuevaComunidad: Community = {
          id: idComunidad,
          slug: slugify(nombreComunidad),
          nombre: nombreComunidad,
          descripcion: "",
          logoUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${idComunidad}`,
          colorAcento: "#6366F1",
          ownerId: idUsuario,
          plan: "starter",
          estado: "activa",
          nombresNiveles: NOMBRES_NIVELES_DEFAULT,
          categorias: CATEGORIAS_DEFAULT,
          creadoEl: new Date().toISOString(),
        };

        set((s) => ({
          usuariosCreados: [...s.usuariosCreados, nuevoUsuario],
          comunidadesCreadas: [...s.comunidadesCreadas, nuevaComunidad],
          currentUserId: nuevoUsuario.id,
        }));

        return { user: nuevoUsuario, community: nuevaComunidad };
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
    }),
    {
      name: "klaze-v2",
      skipHydration: true,
    }
  )
);
