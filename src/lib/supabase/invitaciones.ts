import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invitation } from "@/lib/types";

export interface InvitacionCreada {
  id: string;
  token: string;
  email: string;
}

/**
 * Crea invitaciones por correo para una comunidad.
 *
 * El token lo genera la base (`encode(gen_random_bytes(32), 'hex')`), no el
 * cliente: es el secreto que protege la pantalla de invitación —donde se ve el
 * correo del invitado— y no debe depender de quién lo pida ni de qué navegador.
 *
 * `cursoIds` acepta la lista concreta o `"todos"`, la misma forma que usa el
 * modelo y la pantalla de admin, para no traducir en dos sitios.
 *
 * Quién puede llamarla lo decide RLS: la política de `invitaciones` solo deja
 * escribir al propietario de esa comunidad. Aquí no se comprueba nada a mano.
 */
export async function crearInvitaciones(
  supabase: SupabaseClient,
  comunidadId: string,
  emails: string[],
  cursoIds: string[] | "todos"
): Promise<InvitacionCreada[]> {
  const todos = cursoIds === "todos";

  const { data, error } = await supabase
    .from("invitaciones")
    .insert(
      emails.map((email) => ({
        email: email.trim().toLowerCase(),
        comunidad_id: comunidadId,
        todos_los_cursos: todos,
      }))
    )
    .select("id, token, email");

  if (error) throw new Error(`No se pudo crear la invitación: ${error.message}`);
  if (!data || data.length === 0) {
    // RLS no lanza: filtra. Un insert rechazado por política puede volver
    // vacío en vez de con error, y devolver `[]` en silencio haría creer que
    // la invitación existe.
    throw new Error("No se pudo crear la invitación: sin permiso sobre esa academia");
  }

  if (!todos && cursoIds.length > 0) {
    const filas = data.flatMap((inv) =>
      cursoIds.map((curso_id) => ({ invitacion_id: inv.id, curso_id }))
    );
    const { error: errCursos } = await supabase
      .from("invitacion_cursos")
      .insert(filas);
    if (errCursos) {
      throw new Error(`No se pudieron asignar los cursos: ${errCursos.message}`);
    }
  }

  return data as InvitacionCreada[];
}

/**
 * Invitaciones de una comunidad, la más reciente primero.
 *
 * El `.eq()` es comodidad, no seguridad: si se pide la comunidad de otra
 * empresa, RLS devuelve vacío igual.
 */
export async function listarInvitaciones(
  supabase: SupabaseClient,
  comunidadId: string
): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitaciones")
    .select(
      "token, email, comunidad_id, todos_los_cursos, estado, creada_el, invitacion_cursos(curso_id)"
    )
    .eq("comunidad_id", comunidadId)
    .order("creada_el", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron leer las invitaciones: ${error.message}`);
  }

  return (data ?? []).map((f) => ({
    token: f.token,
    email: f.email,
    comunidadId: f.comunidad_id,
    cursoIds: f.todos_los_cursos
      ? ("todos" as const)
      : ((f.invitacion_cursos ?? []) as { curso_id: string }[]).map((c) => c.curso_id),
    estado: f.estado as Invitation["estado"],
    creadaEl: f.creada_el,
  }));
}
