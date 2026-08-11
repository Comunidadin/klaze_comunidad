import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course } from "@/lib/types";

/**
 * Guarda un curso completo: él, sus módulos y sus lecciones.
 *
 * Los identificadores los pone el navegador con `crypto.randomUUID()`, no la
 * base. Eso permite que el editor monte el curso entero en memoria y lo guarde
 * de una vez, sin el baile de identificadores provisionales que haría falta si
 * los asignara Postgres al insertar.
 *
 * Borra lo que ya no está: si el editor quitó un módulo, aquí desaparece de la
 * base (y sus lecciones caen por cascada). Sin esa limpieza, borrar en el
 * editor no borraría nada y el contenido reaparecería al recargar.
 *
 * LIMITACIÓN CONOCIDA: guarda el curso entero de golpe. Con dos personas
 * editando a la vez, la última escritura gana y la otra pierde su trabajo sin
 * aviso. Es aceptable mientras haya un solo dueño por academia; el día que
 * haya dos administradores hará falta control de versión por fila.
 */
export async function guardarCurso(
  supabase: SupabaseClient,
  curso: Course
): Promise<void> {
  const { error: errCurso } = await supabase.from("cursos").upsert({
    id: curso.id,
    comunidad_id: curso.comunidadId,
    slug: curso.slug,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    portada_url: curso.portadaUrl,
    precio_referencial: curso.precioReferencial,
    nivel_requerido: curso.nivelRequerido,
    publicado: curso.publicado,
    orden: curso.orden,
  });
  if (errCurso) throw new Error(`No se pudo guardar el curso: ${errCurso.message}`);

  await borrarSobrantes(supabase, "modulos", "curso_id", curso.id, curso.modulos.map((m) => m.id));

  if (curso.modulos.length > 0) {
    const { error } = await supabase.from("modulos").upsert(
      curso.modulos.map((m) => ({
        id: m.id,
        curso_id: curso.id,
        titulo: m.titulo,
        orden: m.orden,
        portada_url: m.portadaUrl ?? null,
        publicado: m.publicado ?? true,
      }))
    );
    if (error) throw new Error(`No se pudieron guardar los módulos: ${error.message}`);
  }

  for (const modulo of curso.modulos) {
    await borrarSobrantes(
      supabase,
      "lecciones",
      "modulo_id",
      modulo.id,
      modulo.lecciones.map((l) => l.id)
    );

    if (modulo.lecciones.length === 0) continue;

    const { error } = await supabase.from("lecciones").upsert(
      modulo.lecciones.map((l) => ({
        id: l.id,
        modulo_id: modulo.id,
        titulo: l.titulo,
        orden: l.orden,
        portada_url: l.portadaUrl?.trim() || null,
        duracion_min: l.duracionMin,
        bloques: l.bloques ?? [],
        ia_habilitada: l.iaHabilitada ?? false,
        ia_contexto: l.iaContexto?.trim() || null,
        recursos: l.recursos,
      }))
    );
    if (error) throw new Error(`No se pudieron guardar las lecciones: ${error.message}`);
  }
}

/**
 * Cambia solo el `orden` de varios cursos, y solo eso.
 *
 * No pasa por `guardarCurso` a propósito: ese sube el curso entero con sus
 * módulos y sus lecciones, y borra por el camino lo que ya no está. Mover una
 * fila de sitio no puede arrastrar todo eso — sería reescribir el temario
 * completo para cambiar un número, y con dos personas en el panel la segunda
 * pisaría el trabajo de la primera.
 */
export async function reordenarCursos(
  supabase: SupabaseClient,
  ordenes: { id: string; orden: number }[]
): Promise<void> {
  // Uno a uno y no un `upsert` de todos: un upsert con filas parciales dejaría
  // el resto de columnas en su valor por defecto, o sea el título en blanco.
  for (const { id, orden } of ordenes) {
    const { data, error } = await supabase
      .from("cursos")
      .update({ orden })
      .eq("id", id)
      .select("id");

    if (error) throw new Error(`No se pudo reordenar: ${error.message}`);
    // RLS filtra, no lanza. Sin mirar las filas, un alumno «reordenaría» la
    // lista: la pantalla se recolocaría, el armazón volvería con el orden de
    // siempre, y la fila daría un salto que nadie sabría explicar. Lo cazó la
    // prueba de aislamiento.
    if (!data || data.length === 0) {
      throw new Error("No se pudo reordenar: sin permiso sobre esa academia");
    }
  }
}

/** Publica o pasa a borrador un curso, sin tocar su contenido. */
export async function cambiarPublicadoCurso(
  supabase: SupabaseClient,
  cursoId: string,
  publicado: boolean
): Promise<void> {
  const { data, error } = await supabase
    .from("cursos")
    .update({ publicado })
    .eq("id", cursoId)
    .select("id");

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  // RLS filtra en vez de lanzar: sin mirar las filas, «publicado» se quedaría
  // encendido en la pantalla y apagado en la base.
  if (!data || data.length === 0) {
    throw new Error("No se pudo cambiar el estado: sin permiso");
  }
}

/**
 * Borra un curso entero: él, sus módulos, sus lecciones y todo lo que colgaba.
 *
 * No hace falta ir borrando hacia dentro: cada tabla que apunta a `cursos` lo
 * hace con `on delete cascade`, así que una sola sentencia se lleva los
 * módulos, las lecciones, sus comentarios, el progreso de los alumnos, las
 * publicaciones del curso y su fila en los enlaces de compra. Recorrerlo a
 * mano solo añadiría un orden que la base ya sabe.
 *
 * Y por eso **no se puede deshacer**: quien llame a esto tiene que haber
 * preguntado antes. Lo que se pierde no es solo del creador — el progreso es
 * de sus alumnos.
 */
export async function borrarCurso(
  supabase: SupabaseClient,
  cursoId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("cursos")
    .delete()
    .eq("id", cursoId)
    .select("id");

  if (error) throw new Error(`No se pudo eliminar el módulo: ${error.message}`);
  // RLS no lanza: filtra. Un delete rechazado por política vuelve vacío y sin
  // error, y devolverlo en silencio diría "eliminado" sin haber eliminado nada.
  if (!data || data.length === 0) {
    throw new Error("No se pudo eliminar el módulo: sin permiso sobre esa academia");
  }
}

/**
 * Borra las filas hijas de `padreId` que ya no están en `idsQueSeQuedan`.
 *
 * El caso de lista vacía va aparte: `.not("id", "in", "()")` genera SQL
 * inválido, así que cuando no queda ninguno se borran todos.
 */
async function borrarSobrantes(
  supabase: SupabaseClient,
  tabla: "modulos" | "lecciones",
  columnaPadre: string,
  padreId: string,
  idsQueSeQuedan: string[]
): Promise<void> {
  const consulta = supabase.from(tabla).delete().eq(columnaPadre, padreId);
  const { error } = idsQueSeQuedan.length
    ? await consulta.not("id", "in", `(${idsQueSeQuedan.join(",")})`)
    : await consulta;
  if (error) {
    throw new Error(`No se pudieron limpiar los ${tabla}: ${error.message}`);
  }
}
