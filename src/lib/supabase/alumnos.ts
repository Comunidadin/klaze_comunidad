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
/**
 * Cambia a qué módulos tiene acceso un alumno que YA está dentro.
 *
 * No se hace mandándole otra invitación, aunque lo parezca: una invitación
 * aceptada es historia, y `aceptar_invitaciones_de` solo suma —a propósito,
 * para que comprar dos productos no quite el primero—. Así que quitar un
 * módulo por esa vía es imposible. Esto escribe directamente sobre su
 * inscripción, que es donde vive su acceso de verdad.
 *
 * A diferencia de comprar, aquí SÍ se puede quitar: es una decisión
 * administrativa explícita, tomada por el dueño mirando a esa persona.
 */
export async function cambiarAccesoAlumno(
  supabase: SupabaseClient,
  usuarioId: string,
  comunidadId: string,
  cursoIds: string[] | "todos"
): Promise<void> {
  const todos = cursoIds === "todos";

  const { data: filas, error } = await supabase
    .from("inscripciones")
    .update({ todos_los_cursos: todos })
    .eq("usuario_id", usuarioId)
    .eq("comunidad_id", comunidadId)
    .select("id");

  if (error) throw new Error(`No se pudo cambiar el acceso: ${error.message}`);
  // RLS filtra, no lanza: sin mirar las filas, el panel diría "guardado" y el
  // alumno seguiría viendo lo de antes.
  if (!filas || filas.length === 0) {
    throw new Error("No se pudo cambiar el acceso: sin permiso sobre esa academia");
  }

  const inscripcionId = filas[0].id;

  // La lista de módulos se deja tal cual está aunque `todos` sea verdadero:
  // si mañana se le quita "toda la comunidad", vuelve a lo que tenía elegido
  // en vez de quedarse sin nada. `todos_los_cursos` manda mientras esté
  // encendido — lo decide `cubre_curso` en la base, no esta función.
  if (todos) return;

  // Se borra todo y se vuelve a insertar, en vez de calcular qué sobra y qué
  // falta. Son un puñado de filas por alumno, y la diferencia calculada a mano
  // es justo donde se cuelan los módulos fantasma.
  const { error: errBorrar } = await supabase
    .from("inscripcion_cursos")
    .delete()
    .eq("inscripcion_id", inscripcionId);

  if (errBorrar) {
    throw new Error(`No se pudo limpiar el acceso: ${errBorrar.message}`);
  }

  if (cursoIds.length > 0) {
    const { error: errInsertar } = await supabase
      .from("inscripcion_cursos")
      .insert(cursoIds.map((curso_id) => ({ inscripcion_id: inscripcionId, curso_id })));
    if (errInsertar) {
      throw new Error(`No se pudieron asignar los módulos: ${errInsertar.message}`);
    }
  }
}

export async function cambiarEstadoAlumno(
  supabase: SupabaseClient,
  usuarioId: string,
  comunidadId: string,
  estado: EstadoAlumno
): Promise<void> {
  const { data, error } = await supabase
    .from("inscripciones")
    .update({ estado })
    .eq("usuario_id", usuarioId)
    .eq("comunidad_id", comunidadId)
    .select("id");

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  // RLS filtra, no lanza. Era el único escritor de este archivo sin esta
  // comprobación, doce líneas por debajo de `cambiarAccesoAlumno`, que sí la
  // tiene. Sin ella, suspender a alguien que no es de tu academia volvía sin
  // error y el panel decía que sí: el peor resultado posible para un botón que
  // existe precisamente para cortar el acceso.
  if (!data || data.length === 0) {
    throw new Error("No se pudo cambiar el estado: sin permiso sobre esa academia");
  }
}
