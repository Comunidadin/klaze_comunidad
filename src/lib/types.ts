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

export interface CommunitySpace {
  id: string; // "esp-anuncios"
  slug: string; // "anuncios"
  nombre: string; // "Anuncios"
  icono: string; // emoji, p.ej. "📣"
  orden: number;
  /** Solo el dueño puede publicar aquí (p.ej. Anuncios). */
  soloLectura?: boolean;
}

export interface CommunitySection {
  id: string; // "sec-empieza"
  titulo: string; // "Comienza aquí"
  orden: number;
  espacios: CommunitySpace[];
}

export interface Community {
  id: string;
  slug: string; // "comunidad-del-intercambio"
  nombre: string;
  descripcion: string;
  logoUrl: string;
  colorAcento: string; // hex, personalización por comunidad
  ownerId: string;
  plan: "starter" | "pro" | "scale";
  estado: "activa" | "suspendida";
  nombresNiveles: string[]; // 9 nombres personalizables
  secciones: CommunitySection[]; // navegación de espacios del feed, agrupada
  creadoEl: string;
  /**
   * Portada de la pantalla de entrada (mitad izquierda del login). Cada
   * creador pone la suya desde `/admin/configuracion`. Sin `videoUrl` se
   * usa `posterUrl`; sin ninguna de las dos, el degradado de la marca.
   */
  marcaAuth?: {
    /** mp4/webm servido en bucle, sin sonido y sin controles. */
    videoUrl?: string;
    /** Imagen que cubre mientras el video carga, si falla, o si el visitante pidió reducir movimiento. */
    posterUrl?: string;
  };
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
  /**
   * Espacios/secciones del feed de comunidad de ESTE curso (Cambio 3: la
   * comunidad social vive dentro de cada curso, no a nivel de comunidad).
   * `Community.secciones` se mantiene intacto para no romper `/admin/comunidad`
   * — el área de miembros ya no lo usa, solo este campo. Sembrado con
   * `crearSeccionesDefault()` (ver `src/lib/espacios-default.ts`).
   */
  secciones: CommunitySection[];
}

export interface CourseModule {
  id: string;
  titulo: string;
  orden: number;
  /**
   * En borrador no lo ve ningún miembro, aunque su vitrina esté publicada.
   * Lo filtra `cursosVisiblesParaMiembro`, punto único de verdad.
   */
  publicado: boolean;
  lecciones: Lesson[];
  /** Portada vertical (~2:3) del módulo — Unsplash en mocks, URL libre desde el editor. Sin ella, fallback de gradiente con inicial (ver CoursePortada). */
  portadaUrl?: string;
}

export interface Lesson {
  id: string;
  titulo: string;
  orden: number;
  /**
   * Miniatura de la clase (16:9). Sin ella se usa la del módulo, y sin esa el
   * degradado con inicial — así ninguna pantalla queda con un hueco y subirla
   * nunca es obligatorio.
   */
  portadaUrl?: string;
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
  /**
   * Curso dentro del cual vive esta publicación (Cambio 3). No reemplaza a
   * `comunidadId` — se mantiene para que `/admin/comunidad` siga moderando
   * el feed completo de la comunidad sin tener que tocarlo curso por curso.
   */
  cursoId: string;
  autorId: string;
  espacioId: string;
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
  /**
   * Nombre y avatar del autor, resueltos al leer.
   *
   * Van aquí y no se buscan luego en una lista de usuarios porque el autor de
   * un comentario puede no estar entre los miembros cargados —se dio de baja,
   * o pertenece a otro curso— y entonces su comentario aparecería sin firmar.
   */
  autorNombre?: string;
  autorAvatar?: string;
  /** Nivel del autor, derivado de sus puntos al leer (ver `nivelPorPuntos`). */
  autorNivel?: number;
  cuerpo: string;
  likes: string[];
  respuestas: PostComment[]; // solo 1 nivel de anidación extra (2 niveles total)
  creadoEl: string;
}

export interface CommunityEvent {
  id: string;
  comunidadId: string;
  /** Curso al que pertenece este evento (Cambio 3) — ver docstring homónimo en `Post.cursoId`. */
  cursoId: string;
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
