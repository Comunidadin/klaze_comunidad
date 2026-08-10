import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Los enlaces de compra de una academia.
 *
 * Un canal es una oferta: un nombre, los módulos que incluye y un token. La
 * dirección que se construye con ese token es la que recibe al comprador —
 * **la URL es el producto**, y por eso el formulario externo no tiene que
 * mandar ningún identificador.
 *
 * Quién puede leer y escribir esto lo decide RLS: la política de
 * `canales_venta` solo deja al propietario de esa academia. Aquí no se
 * comprueba nada a mano.
 */

export interface CanalVenta {
  id: string;
  nombre: string;
  /** El secreto. Quien lo tiene puede dar acceso. */
  token: string;
  cursoIds: string[] | "todos";
  activo: boolean;
  creadoEl: string;
}

export interface RecepcionCanal {
  id: string;
  email: string | null;
  accion: "alta" | "baja";
  resultado: string;
  detalle: string;
  recibidaEl: string;
}

interface FilaCanal {
  id: string;
  nombre: string;
  token: string;
  todos_los_cursos: boolean;
  activo: boolean;
  creado_el: string;
  canal_cursos: { curso_id: string }[] | null;
}

const CAMPOS = "id, nombre, token, todos_los_cursos, activo, creado_el, canal_cursos(curso_id)";

function aCanal(f: FilaCanal): CanalVenta {
  return {
    id: f.id,
    nombre: f.nombre,
    token: f.token,
    cursoIds: f.todos_los_cursos
      ? "todos"
      : (f.canal_cursos ?? []).map((c) => c.curso_id),
    activo: f.activo,
    creadoEl: f.creado_el,
  };
}

export async function listarCanales(
  supabase: SupabaseClient,
  comunidadId: string
): Promise<CanalVenta[]> {
  const { data, error } = await supabase
    .from("canales_venta")
    .select(CAMPOS)
    .eq("comunidad_id", comunidadId)
    .order("creado_el", { ascending: false });

  if (error) throw new Error(`No se pudieron leer los enlaces: ${error.message}`);
  return ((data ?? []) as FilaCanal[]).map(aCanal);
}

export async function crearCanal(
  supabase: SupabaseClient,
  comunidadId: string,
  nombre: string,
  cursoIds: string[] | "todos"
): Promise<CanalVenta> {
  const todos = cursoIds === "todos";

  const { data, error } = await supabase
    .from("canales_venta")
    .insert({ comunidad_id: comunidadId, nombre: nombre.trim(), todos_los_cursos: todos })
    .select(CAMPOS);

  if (error) throw new Error(`No se pudo crear el enlace: ${error.message}`);
  // RLS no lanza: filtra. Un insert rechazado por política vuelve vacío y sin
  // error, y devolverlo en silencio haría creer que el enlace existe.
  if (!data || data.length === 0) {
    throw new Error("No se pudo crear el enlace: sin permiso sobre esa academia");
  }

  const canal = aCanal(data[0] as FilaCanal);

  if (!todos && cursoIds.length > 0) {
    const { error: errCursos } = await supabase
      .from("canal_cursos")
      .insert(cursoIds.map((curso_id) => ({ canal_id: canal.id, curso_id })));
    if (errCursos) {
      throw new Error(`No se pudieron asignar los módulos: ${errCursos.message}`);
    }
    canal.cursoIds = cursoIds;
  }

  return canal;
}

export async function cambiarEstadoCanal(
  supabase: SupabaseClient,
  canalId: string,
  activo: boolean
): Promise<void> {
  const { data, error } = await supabase
    .from("canales_venta")
    .update({ activo })
    .eq("id", canalId)
    .select("id");

  if (error) throw new Error(`No se pudo cambiar el enlace: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo cambiar el enlace: sin permiso");
  }
}

/**
 * Cambia el token por uno nuevo, invalidando el anterior.
 *
 * Se genera aquí y no en la base porque hay que devolverlo para enseñarlo, y
 * `gen_random_bytes` solo actuaría como valor por defecto de una fila nueva.
 * `crypto.getRandomValues` es criptográficamente seguro; `Math.random` no lo
 * es, y esto es el equivalente a una contraseña.
 */
export async function regenerarToken(
  supabase: SupabaseClient,
  canalId: string
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  const { data, error } = await supabase
    .from("canales_venta")
    .update({ token })
    .eq("id", canalId)
    .select("id");

  if (error) throw new Error(`No se pudo regenerar el token: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo regenerar el token: sin permiso");
  }

  return token;
}

export async function borrarCanal(
  supabase: SupabaseClient,
  canalId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("canales_venta")
    .delete()
    .eq("id", canalId)
    .select("id");

  if (error) throw new Error(`No se pudo borrar el enlace: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo borrar el enlace: sin permiso");
  }
}

export async function listarRecepciones(
  supabase: SupabaseClient,
  canalId: string,
  limite = 20
): Promise<RecepcionCanal[]> {
  const { data, error } = await supabase
    .from("recepciones_canal")
    .select("id, email, accion, resultado, detalle, recibida_el")
    .eq("canal_id", canalId)
    .order("recibida_el", { ascending: false })
    .limit(limite);

  if (error) throw new Error(`No se pudieron leer las recepciones: ${error.message}`);

  return (data ?? []).map((f) => ({
    id: f.id,
    email: f.email,
    accion: f.accion,
    resultado: f.resultado,
    detalle: f.detalle,
    recibidaEl: f.recibida_el,
  }));
}
