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
