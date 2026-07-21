export type UserRole = "alumno" | "creador" | "superadmin";

export interface User {
  id: string;
  email: string;
  nombre: string;
  avatarUrl: string; // pravatar/dicebear determinístico
  bio: string;
  rol: UserRole;
  comunidadIds: string[];
  puntos: number;
  nivel: number; // 1-9, derivado de puntos al sembrar
  creadoEl: string; // ISO date
}

export interface Community {
  id: string;
  slug: string; // "academia-klaze"
  nombre: string;
  descripcion: string;
  logoUrl: string;
  colorAcento: string; // hex, personalización por comunidad
  ownerId: string;
  plan: "starter" | "pro" | "scale";
  estado: "activa" | "suspendida";
  nombresNiveles: string[]; // 9 nombres personalizables
  categorias: string[]; // ["Anuncios","General","Wins","Preguntas"]
  creadoEl: string;
}

export interface Course {
  id: string;
  comunidadId: string;
  slug: string;
  titulo: string;
  descripcion: string;
  portadaUrl: string; // Unsplash
  precioReferencial: number; // USD, solo informativo
  nivelRequerido: number | null; // null = sin candado por nivel
  modulos: CourseModule[];
  publicado: boolean;
}

export interface CourseModule {
  id: string;
  titulo: string;
  orden: number;
  lecciones: Lesson[];
}

export interface Lesson {
  id: string;
  titulo: string;
  orden: number;
  tipo: "video" | "texto";
  vimeoId: string | null; // solo tipo video
  duracionMin: number;
  contenido: string; // descripción o cuerpo de texto
  recursos: { nombre: string; url: string }[];
}

export interface Enrollment {
  id: string;
  userId: string;
  comunidadId: string;
  cursoIds: string[] | "todos";
  estado: "invitado" | "activo" | "suspendido";
}

export interface Invitation {
  token: string;
  email: string;
  comunidadId: string;
  cursoIds: string[] | "todos";
  estado: "pendiente" | "aceptada";
  creadaEl: string;
}

export interface Post {
  id: string;
  comunidadId: string;
  autorId: string;
  categoria: string;
  titulo: string;
  cuerpo: string;
  fijado: boolean;
  likes: string[]; // userIds
  comentarios: PostComment[];
  creadoEl: string;
}

export interface PostComment {
  id: string;
  autorId: string;
  cuerpo: string;
  likes: string[];
  respuestas: PostComment[]; // solo 1 nivel de anidación extra (2 niveles total)
  creadoEl: string;
}

export interface CommunityEvent {
  id: string;
  comunidadId: string;
  titulo: string;
  descripcion: string;
  fechaInicio: string; // ISO datetime
  duracionMin: number;
  urlSala: string; // link mock de Zoom/Meet
}

export interface Plan {
  id: "starter" | "pro" | "scale";
  nombre: string;
  precioMes: number;
  limites: { comunidades: number; alumnos: number; cursos: number };
  destacado: boolean;
}

// Progreso vive solo en el store de sesión (localStorage), no en mocks:
export interface LessonProgress {
  userId: string;
  leccionId: string;
  completadaEl: string;
}
