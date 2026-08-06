import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post, PostComment, User, UserRole } from "@/lib/types";
import { nombreVisible } from "@/lib/nombre-visible";

export const POR_PAGINA = 20;

/**
 * `autor` va como `User` completo y no como campos sueltos porque es la forma
 * que ya consumen las cinco pantallas del feed. Cambiarla obligaría a tocarlas
 * todas para no ganar nada.
 */
export type PostConAutor = Post & {
  autor: User;
  numComentarios: number;
  /** Si el usuario de la sesión le ha dado me gusta. */
  meGusta: boolean;
};

/**
 * `cursoIds` es una lista y no un id suelto porque el feed se lee desde dos
 * sitios: la pestaña de comunidad de UN curso, y `/admin/comunidad`, que modera
 * el de TODA la academia. Con un id suelto, la segunda pantalla no tenía forma
 * de pedir lo suyo.
 */
export interface FiltroFeed {
  cursoIds: string[];
  espacioId?: string;
}

/**
 * OJO con `perfiles!publicaciones_autor_id_fkey`: el nombre de la clave foránea
 * es obligatorio aquí. `comentarios` y `me_gusta` también apuntan a `perfiles`,
 * así que al pedir los tres a la vez PostgREST ve varios caminos posibles y
 * falla con "more than one relationship was found". Sin el nombre explícito, la
 * consulta entera se cae.
 */
const CAMPOS = `
  id, curso_id, espacio_id, autor_id, titulo, cuerpo, fijado, creado_el,
  perfiles!publicaciones_autor_id_fkey ( id, nombre, email, avatar_url, bio, rol, puntos, creado_el ),
  comentarios ( id, autor_id, cuerpo, padre_id, creado_el ),
  me_gusta ( usuario_id )
`;

interface FilaPerfilAutor {
  id: string;
  nombre: string;
  email: string;
  avatar_url: string;
  bio: string;
  rol: string;
  puntos: number;
  creado_el: string;
}

/** Autor desconocido: el perfil pudo borrarse y la publicación seguir viva. */
const AUTOR_DESCONOCIDO: User = {
  id: "", email: "", nombre: "Usuario", avatarUrl: "", bio: "",
  rol: "alumno", comunidadIds: [], puntos: 0, nivel: 1, creadoEl: "",
};

interface FilaComentario {
  id: string;
  autor_id: string;
  cuerpo: string;
  padre_id: string | null;
  creado_el: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- la fila anidada de
   PostgREST no tiene tipo generado. Se normaliza aquí y no sale de este
   archivo, así que el `any` no se propaga. */
function aPost(f: any, yo: string): PostConAutor {
  const perfil = (Array.isArray(f.perfiles) ? f.perfiles[0] : f.perfiles) as
    | FilaPerfilAutor
    | undefined;
  const comentarios = (f.comentarios ?? []) as FilaComentario[];
  const meGusta = (f.me_gusta ?? []) as { usuario_id: string }[];

  // Dos niveles: raíces y sus respuestas. Es lo que soporta el modelo.
  const raices: PostComment[] = comentarios
    .filter((c) => !c.padre_id)
    .sort((a, b) => a.creado_el.localeCompare(b.creado_el))
    .map((c) => ({
      id: c.id,
      autorId: c.autor_id,
      cuerpo: c.cuerpo,
      likes: [],
      creadoEl: c.creado_el,
      respuestas: comentarios
        .filter((r) => r.padre_id === c.id)
        .sort((a, b) => a.creado_el.localeCompare(b.creado_el))
        .map((r) => ({
          id: r.id,
          autorId: r.autor_id,
          cuerpo: r.cuerpo,
          likes: [],
          respuestas: [],
          creadoEl: r.creado_el,
        })),
    }));

  return {
    id: f.id,
    // `comunidadId` ya no viaja en la fila: la publicación cuelga del curso, y
    // el curso de la comunidad. Se deja vacío porque el tipo lo exige y ningún
    // consumidor lo usa desde que el feed vive dentro del curso.
    comunidadId: "",
    cursoId: f.curso_id,
    autorId: f.autor_id,
    espacioId: f.espacio_id,
    titulo: f.titulo,
    cuerpo: f.cuerpo,
    fijado: f.fijado,
    likes: meGusta.map((m) => m.usuario_id),
    comentarios: raices,
    creadoEl: f.creado_el,
    autor: perfil
      ? {
          id: perfil.id,
          email: perfil.email,
          nombre: nombreVisible(perfil.nombre, perfil.email),
          avatarUrl: perfil.avatar_url,
          bio: perfil.bio,
          rol: perfil.rol as UserRole,
          comunidadIds: [],
          puntos: perfil.puntos,
          nivel: 1,
          creadoEl: perfil.creado_el,
        }
      : AUTOR_DESCONOCIDO,
    numComentarios: comentarios.length,
    meGusta: meGusta.some((m) => m.usuario_id === yo),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function idDeSesion(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "";
}

/**
 * Una página del feed, de más nueva a más vieja.
 *
 * Se pagina por FECHA (`antesDe`), no por número de página. Con páginas
 * numeradas, si alguien publica mientras otro lee, la publicación que estaba en
 * la posición 20 pasa a la 21 y reaparece al pedir la siguiente. Con un corte
 * por fecha eso no puede ocurrir, y hay una prueba dedicada a ello.
 *
 * La fijada NO sale aquí: la trae `leerFijado`. Va fuera de la paginación
 * porque, si entrara en el orden por fecha, desaparecería en cuanto hubiera 20
 * publicaciones más nuevas — justo lo contrario de fijar algo.
 */
export async function leerPagina(
  supabase: SupabaseClient,
  filtro: FiltroFeed,
  antesDe: string | null
): Promise<PostConAutor[]> {
  if (filtro.cursoIds.length === 0) return [];

  let consulta = supabase
    .from("publicaciones")
    .select(CAMPOS)
    .in("curso_id", filtro.cursoIds)
    .eq("fijado", false)
    .order("creado_el", { ascending: false })
    .limit(POR_PAGINA);

  if (filtro.espacioId) consulta = consulta.eq("espacio_id", filtro.espacioId);
  if (antesDe) consulta = consulta.lt("creado_el", antesDe);

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudo leer el feed: ${error.message}`);

  const yo = await idDeSesion(supabase);
  return (data ?? []).map((f) => aPost(f, yo));
}

/** La publicación fijada del curso, si la hay. Va aparte de la paginación. */
export async function leerFijado(
  supabase: SupabaseClient,
  cursoId: string
): Promise<PostConAutor | null> {
  const { data, error } = await supabase
    .from("publicaciones")
    .select(CAMPOS)
    .eq("curso_id", cursoId)
    .eq("fijado", true)
    .limit(1);

  if (error) throw new Error(`No se pudo leer la publicación fijada: ${error.message}`);

  const yo = await idDeSesion(supabase);
  return data?.[0] ? aPost(data[0], yo) : null;
}

/** El autor sale de la sesión: no existe forma de publicar a nombre de otro. */
export async function crearPost(
  supabase: SupabaseClient,
  datos: { cursoId: string; espacioId: string; titulo: string; cuerpo: string }
): Promise<void> {
  const autorId = await idDeSesion(supabase);
  if (!autorId) throw new Error("Publicar requiere una sesión activa");

  const { error } = await supabase.from("publicaciones").insert({
    curso_id: datos.cursoId,
    espacio_id: datos.espacioId,
    autor_id: autorId,
    titulo: datos.titulo,
    cuerpo: datos.cuerpo,
  });
  if (error) throw new Error(`No se pudo publicar: ${error.message}`);
}

/** Alterna el me gusta del usuario de la sesión. Nunca a nombre de otro. */
export async function alternarMeGusta(
  supabase: SupabaseClient,
  publicacionId: string,
  yaPuesto: boolean
): Promise<void> {
  const usuarioId = await idDeSesion(supabase);
  if (!usuarioId) throw new Error("Requiere una sesión activa");

  const { error } = yaPuesto
    ? await supabase
        .from("me_gusta")
        .delete()
        .eq("publicacion_id", publicacionId)
        .eq("usuario_id", usuarioId)
    : await supabase
        .from("me_gusta")
        .insert({ publicacion_id: publicacionId, usuario_id: usuarioId });

  if (error) throw new Error(`No se pudo guardar el me gusta: ${error.message}`);
}

export async function comentar(
  supabase: SupabaseClient,
  publicacionId: string,
  cuerpo: string,
  padreId: string | null
): Promise<void> {
  const autorId = await idDeSesion(supabase);
  if (!autorId) throw new Error("Comentar requiere una sesión activa");

  const { error } = await supabase.from("comentarios").insert({
    publicacion_id: publicacionId,
    autor_id: autorId,
    cuerpo,
    padre_id: padreId,
  });
  if (error) throw new Error(`No se pudo comentar: ${error.message}`);
}

/**
 * Borra una publicación. La política permite al autor y al dueño de la
 * academia; para cualquier otro, la escritura no afecta a ninguna fila y no
 * lanza — RLS filtra, no rechaza. Quien necesite saber si funcionó, que relea.
 */
export async function eliminarPost(
  supabase: SupabaseClient,
  publicacionId: string
): Promise<void> {
  const { error } = await supabase
    .from("publicaciones")
    .delete()
    .eq("id", publicacionId);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
}

/**
 * Fija una publicación, desfijando la anterior del mismo curso.
 *
 * Pasa por una función de la base y no por un `update` directo por dos motivos.
 * Uno: la política de edición solo permite al autor, así que el dueño podía
 * borrar el mensaje de un alumno pero no destacarlo. Dos: ampliar esa política
 * le dejaría además cambiar las palabras de otro, que es peor que borrarlas —
 * la función solo toca `fijado`.
 *
 * Y hace las dos escrituras en una sola operación: partidas en dos llamadas
 * desde aquí, queda una ventana en la que no hay ninguna fijada, o hay dos.
 */
export async function fijarPost(
  supabase: SupabaseClient,
  publicacionId: string
): Promise<void> {
  const { error } = await supabase.rpc("fijar_publicacion", {
    p_publicacion: publicacionId,
  });
  if (error) throw new Error(`No se pudo fijar: ${error.message}`);
}
