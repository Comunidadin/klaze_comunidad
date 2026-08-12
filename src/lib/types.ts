import type { GoteoModo } from "@/lib/goteo";

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
  /** Cómo se llama el asistente de esta academia. Sin él, "Asistente". */
  nombreIa?: string;
  /** Su cara en el chat. Sin ella, un icono. */
  avatarIa?: string;
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
   * Posición en la lista de módulos de su academia, 1..N.
   *
   * Existe porque con diez módulos el orden ES el temario: «Introducción» no
   * puede salir detrás de «Avanzada», y sin esta columna la lista salía como
   * la devolviera Postgres, que no promete nada.
   */
  orden: number;
  /**
   * Cuándo se abre este módulo para un alumno.
   *
   * `ninguno` (lo que ya había) lo entrega al comprar. `dias` lo abre a los
   * `goteoDias` de que esa persona entrara a la academia. `fecha` lo abre en
   * `goteoDesde`, igual para todos.
   *
   * Estos tres campos son SOLO para pintar la cuenta atrás. El candado de
   * verdad es `privado.curso_disponible` en Postgres.
   */
  goteoModo: GoteoModo;
  goteoDias: number | null;
  goteoDesde: string | null;
}

export interface CourseModule {
  id: string;
  titulo: string;
  orden: number;
  /**
   * En borrador no lo ve ningún miembro, aunque su módulo esté publicada.
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
  duracionMin: number;
  /**
   * Las piezas de la clase, en orden. Una clase ya no *es* de un tipo: puede
   * llevar un vídeo, debajo una explicación y al final un formulario.
   */
  bloques: BloqueClase[];
  recursos: { nombre: string; url: string }[];
  /** Si esta clase tiene asistente. Lo enciende el creador, clase a clase. */
  iaHabilitada: boolean;
  /**
   * El guion que el asistente usa para responder. No entrena nada: viaja con
   * cada pregunta.
   *
   * OJO: viaja dentro de la lección, así que llega al navegador de cualquiera
   * con acceso a la clase.
   */
  iaContexto?: string;
}

export type BloqueClase =
  | { id: string; tipo: "video"; vimeoId: string }
  /**
   * `doc` es el documento del editor, NO html. Guardar html significaría
   * volcarlo luego en la página, y ahí cualquier cosa que un creador pegue
   * —o que le inyecten si le roban la cuenta— se ejecutaría en el navegador de
   * sus alumnos con la sesión abierta.
   */
  | { id: string; tipo: "texto"; doc: unknown }
  | { id: string; tipo: "embed"; url: string; alto?: number }
  /**
   * Una imagen de referencia dentro de la clase: la captura del paso 3, el
   * diagrama, el ejemplo de formulario relleno.
   *
   * Guarda la URL, no el archivo. Es un enlace público a una imagen alojada
   * donde sea; Klaze no la copia. Eso tiene una consecuencia que el editor
   * dice con estas palabras: si ese sitio se cae o borras la imagen, aquí
   * desaparece.
   */
  | { id: string; tipo: "imagen"; url: string; pie?: string };

/** El tipo de una clase se deduce de su primera pieza — para el icono. */
export function tipoDeClase(
  bloques: BloqueClase[]
): "video" | "texto" | "embed" | "imagen" {
  return bloques[0]?.tipo ?? "texto";
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
  /**
   * La academia. Fue `cursoId` durante un tiempo —la comunidad vivía dentro de
   * cada módulo— y volvió aquí: con diez módulos, cada alumno acababa en una
   * isla distinta según lo que hubiera comprado.
   */
  comunidadId: string;
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
  /** La academia entera: un evento es del calendario común, no de un módulo. */
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
