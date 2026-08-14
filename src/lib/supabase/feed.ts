import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post, PostComment, User, UserRole } from "@/lib/types";
import { nombreVisible } from "@/lib/nombre-visible";
import { nivelPorPuntos } from "@/lib/levels";

export const POR_PAGINA = 20;

/**
 * `autor` va como `User` completo y no como campos sueltos porque es la forma
 * que ya consumen las cinco pantallas del feed. Cambiarla obligaría a tocarlas
 * todas para no ganar nada.
 */
export interface OpcionEncuesta {
  id: string;
  texto: string;
  votos: number;
  miVoto: boolean;
}

export type PostConAutor = Post & {
  autor: User;
  numComentarios: number;
  /** Presente solo si la publicación es una encuesta. */
  encuesta?: { opciones: OpcionEncuesta[]; totalVotos: number };
  /** Si el usuario de la sesión le ha dado me gusta. */
  meGusta: boolean;
};

/**
 * El feed es uno por academia.
 *
 * Antes esto era una LISTA de cursos, porque cada módulo tenía su feed y
 * `/admin/comunidad` necesitaba pedir los de todos a la vez. Al subir la
 * comunidad al nivel de la academia, la pantalla del alumno y la del panel
 * piden exactamente lo mismo — y esa lista deja de tener sentido.
 */
export interface FiltroFeed {
  comunidadId: string;
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
  id, comunidad_id, espacio_id, autor_id, titulo, cuerpo, imagen_url, fijado, creado_el,
  perfiles!publicaciones_autor_id_fkey ( id, nombre, email, avatar_url, bio, rol, creado_el ),
  comentarios ( id, autor_id, cuerpo, padre_id, creado_el, perfiles!comentarios_autor_id_fkey ( nombre, email, avatar_url ) ),
  me_gusta ( usuario_id ),
  encuesta_opciones ( id, texto, orden, encuesta_votos ( usuario_id ) )
`;

interface FilaPerfilAutor {
  id: string;
  nombre: string;
  email: string;
  avatar_url: string;
  bio: string;
  rol: string;
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
  perfiles?: FilaPerfilComentario | FilaPerfilComentario[];
}

interface FilaPerfilComentario {
  nombre: string;
  email: string;
  avatar_url: string;
}

function autorDe(c: FilaComentario, puntosPor: Map<string, number>) {
  const p = Array.isArray(c.perfiles) ? c.perfiles[0] : c.perfiles;
  return {
    autorNombre: nombreVisible(p?.nombre ?? "", p?.email ?? ""),
    autorAvatar: p?.avatar_url ?? "",
    // Nivel POR ACADEMIA: sale del mapa de `ranking_de_comunidad`, no de un
    // contador global en el perfil (que se retiro con multi-academia).
    autorNivel: nivelPorPuntos(puntosPor.get(c.autor_id) ?? 0),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- la fila anidada de
   PostgREST no tiene tipo generado. Se normaliza aquí y no sale de este
   archivo, así que el `any` no se propaga. */
function aPost(f: any, yo: string, puntosPor: Map<string, number>): PostConAutor {
  const perfil = (Array.isArray(f.perfiles) ? f.perfiles[0] : f.perfiles) as
    | FilaPerfilAutor
    | undefined;
  const comentarios = (f.comentarios ?? []) as FilaComentario[];
  const meGusta = (f.me_gusta ?? []) as { usuario_id: string }[];

  const filasOpciones = (f.encuesta_opciones ?? []) as {
    id: string; texto: string; orden: number;
    encuesta_votos?: { usuario_id: string }[];
  }[];
  const opciones: OpcionEncuesta[] = filasOpciones
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((o) => ({
      id: o.id,
      texto: o.texto,
      votos: (o.encuesta_votos ?? []).length,
      miVoto: (o.encuesta_votos ?? []).some((v) => v.usuario_id === yo),
    }));
  const encuesta =
    opciones.length > 0
      ? { opciones, totalVotos: opciones.reduce((t, o) => t + o.votos, 0) }
      : undefined;

  // Dos niveles: raíces y sus respuestas. Es lo que soporta el modelo.
  const raices: PostComment[] = comentarios
    .filter((c) => !c.padre_id)
    .sort((a, b) => a.creado_el.localeCompare(b.creado_el))
    .map((c) => ({
      id: c.id,
      autorId: c.autor_id,
      ...autorDe(c, puntosPor),
      cuerpo: c.cuerpo,
      likes: [],
      creadoEl: c.creado_el,
      respuestas: comentarios
        .filter((r) => r.padre_id === c.id)
        .sort((a, b) => a.creado_el.localeCompare(b.creado_el))
        .map((r) => ({
          id: r.id,
          autorId: r.autor_id,
          ...autorDe(r, puntosPor),
          cuerpo: r.cuerpo,
          likes: [],
          respuestas: [],
          creadoEl: r.creado_el,
        })),
    }));

  return {
    id: f.id,
    comunidadId: f.comunidad_id,
    autorId: f.autor_id,
    espacioId: f.espacio_id,
    titulo: f.titulo,
    cuerpo: f.cuerpo,
    imagenUrl: f.imagen_url ?? undefined,
    encuesta,
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
          puntos: puntosPor.get(perfil.id) ?? 0,
          nivel: nivelPorPuntos(puntosPor.get(perfil.id) ?? 0),
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
  antesDe: string | null,
  puntosPor: Map<string, number>
): Promise<PostConAutor[]> {
  if (!filtro.comunidadId) return [];

  let consulta = supabase
    .from("publicaciones")
    .select(CAMPOS)
    .eq("comunidad_id", filtro.comunidadId)
    .eq("fijado", false)
    .order("creado_el", { ascending: false })
    .limit(POR_PAGINA);

  if (filtro.espacioId) consulta = consulta.eq("espacio_id", filtro.espacioId);
  if (antesDe) consulta = consulta.lt("creado_el", antesDe);

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudo leer el feed: ${error.message}`);

  const yo = await idDeSesion(supabase);
  return (data ?? []).map((f) => aPost(f, yo, puntosPor));
}

/** La publicación fijada de la academia, si la hay. Fuera de la paginación. */
export async function leerFijado(
  supabase: SupabaseClient,
  comunidadId: string,
  puntosPor: Map<string, number>
): Promise<PostConAutor | null> {
  const { data, error } = await supabase
    .from("publicaciones")
    .select(CAMPOS)
    .eq("comunidad_id", comunidadId)
    .eq("fijado", true)
    .limit(1);

  if (error) throw new Error(`No se pudo leer la publicación fijada: ${error.message}`);

  const yo = await idDeSesion(supabase);
  return data?.[0] ? aPost(data[0], yo, puntosPor) : null;
}

/** El autor sale de la sesión: no existe forma de publicar a nombre de otro. */
export async function crearPost(
  supabase: SupabaseClient,
  datos: {
    comunidadId: string;
    espacioId: string;
    titulo: string;
    cuerpo: string;
    imagenUrl?: string;
    /** 2 a 6 textos: convierte la publicación en encuesta. */
    opciones?: string[];
  }
): Promise<void> {
  const autorId = await idDeSesion(supabase);
  if (!autorId) throw new Error("Publicar requiere una sesión activa");

  const { data, error } = await supabase
    .from("publicaciones")
    .insert({
      comunidad_id: datos.comunidadId,
      espacio_id: datos.espacioId,
      autor_id: autorId,
      titulo: datos.titulo,
      cuerpo: datos.cuerpo,
      imagen_url: datos.imagenUrl ?? null,
    })
    .select("id");
  if (error) throw new Error(`No se pudo publicar: ${error.message}`);

  const opciones = (datos.opciones ?? []).map((t) => t.trim()).filter(Boolean);
  if (opciones.length >= 2 && data?.[0]) {
    const { error: errOpciones } = await supabase.from("encuesta_opciones").insert(
      opciones.slice(0, 6).map((texto, i) => ({
        publicacion_id: data[0].id,
        texto,
        orden: i + 1,
      }))
    );
    if (errOpciones) {
      throw new Error(`Se publicó, pero la encuesta no: ${errOpciones.message}`);
    }
  }
}

/**
 * Vota (o cambia el voto) en la encuesta de una publicación. El upsert sobre
 * la clave (publicación, usuario) es lo que hace imposible votar dos veces.
 */
export async function votarEncuesta(
  supabase: SupabaseClient,
  publicacionId: string,
  opcionId: string
): Promise<void> {
  const yo = await idDeSesion(supabase);
  if (!yo) throw new Error("Votar requiere una sesión activa");

  const { data, error } = await supabase
    .from("encuesta_votos")
    .upsert(
      { publicacion_id: publicacionId, usuario_id: yo, opcion_id: opcionId },
      { onConflict: "publicacion_id,usuario_id" }
    )
    .select("opcion_id");
  if (error) throw new Error(`No se pudo votar: ${error.message}`);
  if (!data || data.length === 0) throw new Error("No se pudo votar");
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
