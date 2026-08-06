import type { SupabaseClient } from "@supabase/supabase-js";

export type EstadoAlumno = "invitado" | "activo" | "suspendido";

export interface AlumnoEnComunidad {
  usuarioId: string;
  nombre: string;
  /** Vive en `perfiles`, no en `auth.users`: el dueño no puede leer esa. */
  email: string;
  avatarUrl: string;
  bio: string;
  rol: string;
  puntos: number;
  creadoEl: string;
  estado: EstadoAlumno;
  todosLosCursos: boolean;
  cursoIds: string[];
}

interface FilaPerfil {
  nombre: string;
  email: string;
  avatar_url: string;
  bio: string;
  rol: string;
  puntos: number;
  creado_el: string;
}

/**
 * Alumnos inscritos en una comunidad, con su estado y sus cursos.
 *
 * El `.eq()` es comodidad, no seguridad: la política de `inscripciones` solo
 * deja ver las propias y las de la comunidad que administras, así que pedir la
 * de otra empresa devuelve vacío igual.
 */
export async function listarAlumnos(
  supabase: SupabaseClient,
  comunidadId: string
): Promise<AlumnoEnComunidad[]> {
  const { data, error } = await supabase
    .from("inscripciones")
    .select(
      "usuario_id, estado, todos_los_cursos, perfiles(nombre, email, avatar_url, bio, rol, puntos, creado_el), inscripcion_cursos(curso_id)"
    )
    .eq("comunidad_id", comunidadId);

  if (error) throw new Error(`No se pudieron leer los alumnos: ${error.message}`);

  return (data ?? []).map((f) => {
    // PostgREST devuelve la relación como objeto o como array de uno según la
    // cardinalidad que infiera; normalizar aquí evita un `undefined` sutil.
    const perfil = (Array.isArray(f.perfiles) ? f.perfiles[0] : f.perfiles) as
      | FilaPerfil
      | undefined;

    return {
      usuarioId: f.usuario_id,
      nombre: perfil?.nombre ?? "",
      email: perfil?.email ?? "",
      avatarUrl: perfil?.avatar_url ?? "",
      bio: perfil?.bio ?? "",
      rol: perfil?.rol ?? "alumno",
      puntos: perfil?.puntos ?? 0,
      creadoEl: perfil?.creado_el ?? "",
      estado: f.estado as EstadoAlumno,
      todosLosCursos: f.todos_los_cursos,
      cursoIds: ((f.inscripcion_cursos ?? []) as { curso_id: string }[]).map(
        (c) => c.curso_id
      ),
    };
  });
}

/**
 * Cambia el estado de un alumno en una comunidad.
 *
 * Suspender aquí no es cosmético: `privado.pertenece_a` exige inscripción
 * ACTIVA, así que esta única escritura corta el acceso a los cursos y a sus
 * lecciones en la propia base. Ninguna pantalla tiene que acordarse de
 * comprobarlo, que es exactamente el olvido que este diseño quería eliminar.
 *
 * NO borra el progreso: al reactivar, el alumno vuelve donde lo dejó. Borrarlo
 * sería castigar dos veces por una sola decisión administrativa, y no tiene
 * vuelta atrás.
 */
export async function cambiarEstadoAlumno(
  supabase: SupabaseClient,
  usuarioId: string,
  comunidadId: string,
  estado: EstadoAlumno
): Promise<void> {
  const { error } = await supabase
    .from("inscripciones")
    .update({ estado })
    .eq("usuario_id", usuarioId)
    .eq("comunidad_id", comunidadId);

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
}
