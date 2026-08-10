import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { variableServidor } from "@/lib/entorno-servidor";
import { esEmailValido } from "@/lib/validation";

/**
 * Lo que comparten las dos puertas de un enlace de compra: leer el cuerpo que
 * mande la otra aplicación, encontrar el canal por su token y dejar registro.
 *
 * La premisa de todo esto es que **no controlamos quién escribe**. El
 * formulario lo hace el creador en la herramienta que le dé la gana, y no
 * podemos pedirle que renombre sus campos ni que ponga cabeceras. Así que aquí
 * se acepta lo que llegue y se busca el correo dentro.
 */

/** Cuántas recepciones admite un canal al día. */
export const TOPE_DIARIO = 200;

export type TipoCanal = "academia" | "plataforma";

/**
 * Un canal es una oferta. De los dos tipos, porque los dos niveles de venta
 * necesitan exactamente lo mismo —token, tope, registro— con otro efecto:
 *
 * - `academia`: da acceso a un alumno. Lleva comunidad y módulos.
 * - `plataforma`: da de alta una academia entera. Lleva plan.
 */
export interface Canal {
  id: string;
  tipo: TipoCanal;
  /** Solo en los de academia. */
  comunidadId: string;
  comunidadNombre: string;
  todosLosCursos: boolean;
  cursoIds: string[];
  /** Solo en los de plataforma. */
  planId: string;
}

export type Resultado =
  | "creado"
  | "ya_tenia"
  | "suspendido"
  | "sin_email"
  | "sin_cuenta"
  | "rechazado"
  | "academia_creada"
  | "academia_reactivada"
  | "academia_suspendida";

/** El cliente con la clave secreta, o `null` si falta configurarla. */
export async function clienteAdmin(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = await variableServidor("SUPABASE_SECRET_KEY");
  if (!url || !secreta) return null;
  return createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * El canal de ese token, si existe, es del tipo esperado y está utilizable.
 *
 * Devuelve `null` sin distinguir entre los casos, y las rutas responden 404 en
 * todos. Un 403 confirmaría que el token existe, que es justo lo que protege a
 * una dirección que cualquiera puede probar.
 *
 * **El tipo se pide, no se deduce.** Sin ese filtro, el token de un enlace de
 * plataforma serviría también en `/api/compras` y al revés: cada ruta acepta
 * solo los suyos, y un token del otro tipo es tan desconocido como uno
 * inventado.
 */
export async function canalPorToken(
  admin: SupabaseClient,
  token: string,
  tipo: TipoCanal
): Promise<Canal | null> {
  const { data } = await admin
    .from("canales_venta")
    // En una sola cadena literal, aunque pase de los 100 caracteres: Supabase
    // lee este texto en tiempo de tipos para saber qué devuelve, y partirlo en
    // dos trozos concatenados le deja `GenericStringError` en vez de la fila.
    .select("id, tipo, plan_id, todos_los_cursos, activo, comunidad_id, comunidades(nombre, estado), canal_cursos(curso_id)")
    .eq("token", token)
    .eq("tipo", tipo)
    .maybeSingle();

  if (!data || !data.activo) return null;

  const comunidad = data.comunidades as unknown as {
    nombre: string;
    estado: string;
  } | null;

  // Un canal de academia muere con su academia: si está suspendida, sus
  // enlaces de compra dejan de admitir gente. Uno de plataforma no tiene
  // academia de la que depender.
  if (tipo === "academia" && (!comunidad || comunidad.estado !== "activa")) {
    return null;
  }

  return {
    id: data.id,
    tipo: data.tipo as TipoCanal,
    comunidadId: data.comunidad_id ?? "",
    comunidadNombre: comunidad?.nombre ?? "",
    todosLosCursos: data.todos_los_cursos,
    cursoIds: ((data.canal_cursos ?? []) as { curso_id: string }[]).map(
      (c) => c.curso_id
    ),
    planId: data.plan_id ?? "",
  };
}

/**
 * Aplana un objeto anidado a `clave.subclave` → texto.
 *
 * Hace falta porque los cuerpos reales vienen anidados —`data.buyer.email` es
 * la forma de media docena de herramientas— y buscar el correo solo en el
 * primer nivel no lo encontraría.
 */
function aplanar(valor: unknown, prefijo = "", salida: Record<string, string> = {}) {
  if (valor === null || valor === undefined) return salida;
  if (typeof valor !== "object") {
    salida[prefijo] = String(valor);
    return salida;
  }
  for (const [clave, hijo] of Object.entries(valor as Record<string, unknown>)) {
    aplanar(hijo, prefijo ? `${prefijo}.${clave}` : clave, salida);
  }
  return salida;
}

export interface CuerpoLeido {
  campos: Record<string, string>;
  /** Tal cual llegó, truncado. Es lo que se guarda para poder depurar. */
  crudo: string;
}

/**
 * Lee el cuerpo venga como venga: JSON, formulario clásico o multipart.
 *
 * Se lee el texto **una sola vez** y se intenta JSON primero, en vez de fiarse
 * del `Content-Type`. Bastantes herramientas mandan JSON declarando
 * `text/plain`, y rechazarlas por la cabecera sería rechazarlas por algo que el
 * creador no puede cambiar.
 */
export async function leerCuerpo(request: Request): Promise<CuerpoLeido> {
  const tipo = request.headers.get("content-type") ?? "";

  if (tipo.includes("multipart/form-data")) {
    const fd = await request.formData();
    const campos: Record<string, string> = {};
    for (const [clave, valor] of fd.entries()) {
      if (typeof valor === "string") campos[clave] = valor;
    }
    return { campos, crudo: new URLSearchParams(campos).toString().slice(0, 2000) };
  }

  const crudo = await request.text();

  try {
    return { campos: aplanar(JSON.parse(crudo)), crudo: crudo.slice(0, 2000) };
  } catch {
    return {
      campos: Object.fromEntries(new URLSearchParams(crudo)),
      crudo: crudo.slice(0, 2000),
    };
  }
}

/** Nombres de campo habituales, comparados por el último tramo de la clave. */
const CLAVES_EMAIL = ["email", "correo", "e-mail", "mail", "buyer_email", "email_address"];

function ultimoTramo(clave: string): string {
  return clave.split(".").pop()!.toLowerCase();
}

/**
 * El correo del comprador, o `null`.
 *
 * Dos pasadas: primero los nombres de campo conocidos, y si no, **cualquier
 * valor que tenga forma de correo**. La segunda es la que salva el día cuando
 * el campo se llama `q3_tuCorreo` porque lo generó un constructor de
 * formularios.
 */
export function emailDelCuerpo(campos: Record<string, string>): string | null {
  for (const [clave, valor] of Object.entries(campos)) {
    if (CLAVES_EMAIL.includes(ultimoTramo(clave)) && esEmailValido(valor)) {
      return valor.trim().toLowerCase();
    }
  }
  for (const valor of Object.values(campos)) {
    if (esEmailValido(valor)) return valor.trim().toLowerCase();
  }
  return null;
}

/**
 * El nombre del comprador si viene, o cadena vacía.
 *
 * Sin esto, la cuenta se crea sin nombre y el directorio de la academia enseña
 * la parte de delante de su correo. Es correcto pero feo, y el formulario casi
 * siempre pregunta el nombre.
 */
export function nombreDelCuerpo(campos: Record<string, string>): string {
  const primero = (nombres: string[]): string => {
    for (const [clave, valor] of Object.entries(campos)) {
      if (nombres.includes(ultimoTramo(clave)) && valor.trim()) return valor.trim();
    }
    return "";
  };

  const completo = primero(["nombre", "name", "full_name", "fullname"]);
  if (completo) return completo.slice(0, 80);

  // Partido en dos campos, que es como lo parte medio internet.
  const pila = primero(["first_name", "firstname"]);
  const apellido = primero(["last_name", "lastname", "apellido"]);
  return `${pila} ${apellido}`.trim().slice(0, 80);
}

/**
 * El nombre de la empresa, para bautizar la academia. Nunca vacío.
 *
 * Los respaldos importan más de lo que parece: de aquí sale el nombre **y** la
 * dirección de la academia, y quien ya pagó tiene que recibir algo aunque su
 * formulario no preguntara por la empresa. Para eso el identificador se puede
 * cambiar mientras no haya alumnos.
 *
 * A diferencia del correo, un nombre de empresa no se reconoce por su forma: si
 * el campo no se llama de algo previsible, no hay nada que rastrear.
 */
export function empresaDelCuerpo(campos: Record<string, string>): string {
  const claves = ["empresa", "company", "academia", "negocio", "marca", "nombre_empresa"];
  for (const [clave, valor] of Object.entries(campos)) {
    if (claves.includes(ultimoTramo(clave)) && valor.trim()) {
      return valor.trim().slice(0, 60);
    }
  }

  // Sin empresa, su propio nombre: "La academia de Ana" es peor nombre que
  // "Ana", pero infinitamente mejor que ninguno.
  const persona = nombreDelCuerpo(campos);
  if (persona) return persona;

  const correo = emailDelCuerpo(campos);
  return correo ? correo.split("@")[0] : "Academia";
}

export interface AcademiaPropia {
  id: string;
  slug: string;
  nombre: string;
}

/**
 * Las academias que posee quien usa ese correo.
 *
 * La usan las dos puntas del súper enlace, y por eso vive aquí: el alta la
 * consulta para no crear una segunda a quien ya tiene una, y la baja para saber
 * cuáles suspender. Que las dos pregunten lo mismo es lo que hace que una
 * renovación reactive exactamente lo que la baja suspendió.
 */
export async function academiasDe(
  admin: SupabaseClient,
  email: string
): Promise<AcademiaPropia[]> {
  const { data: usuarioId } = await admin.rpc("perfil_por_email", { p_email: email });
  if (!usuarioId) return [];

  const { data } = await admin
    .from("comunidades")
    .select("id, slug, nombre")
    .eq("propietario_id", usuarioId as string)
    .order("creado_el");

  return (data ?? []) as AcademiaPropia[];
}

/** Deja constancia de la recepción. Nunca lanza: un fallo aquí no debe tumbar el acceso. */
export async function registrar(
  admin: SupabaseClient,
  canalId: string,
  fila: { email: string | null; accion: "alta" | "baja"; resultado: Resultado; detalle?: string; cuerpo?: string }
): Promise<void> {
  const { error } = await admin.from("recepciones_canal").insert({
    canal_id: canalId,
    email: fila.email,
    accion: fila.accion,
    resultado: fila.resultado,
    detalle: fila.detalle ?? "",
    cuerpo: fila.cuerpo ?? "",
  });
  if (error) console.error("No se pudo registrar la recepción:", error.message);
}

/**
 * `true` si este canal ya pasó su tope de hoy.
 *
 * La dirección es pública: sin tope, quien la tenga da de alta miles de cuentas
 * y agota la cuota de correo del dueño de la plataforma.
 */
export async function topeAlcanzado(
  admin: SupabaseClient,
  canalId: string
): Promise<boolean> {
  const inicio = new Date();
  inicio.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from("recepciones_canal")
    .select("id", { count: "exact", head: true })
    .eq("canal_id", canalId)
    .gte("recibida_el", inicio.toISOString());

  return (count ?? 0) >= TOPE_DIARIO;
}
