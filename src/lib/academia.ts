import type { SupabaseClient } from "@supabase/supabase-js";

export interface OpcionesAcademia {
  email: string;
  empresa: string;
  slug: string;
  /** Por defecto `"pro"`. */
  planId?: string;
}

export interface ResultadoAcademia {
  comunidadId: string;
  usuarioId: string;
  yaExistia: boolean;
  /**
   * `true` si ese correo ya era de un **alumno** y el alta lo convirtió en
   * creador. La pantalla lo avisa: esa persona deja de aterrizar en sus cursos
   * y pasa a aterrizar en un panel de administración.
   */
  eraAlumno: boolean;
  /**
   * Contraseña de un solo uso, o `null` si la cuenta ya existía —entonces esa
   * persona entra con la suya. No se guarda en ningún sitio: si se pierde, se
   * pide una nueva desde `/login`.
   */
  passwordTemporal: string | null;
}

/** Los 9 nombres de nivel por defecto, en orden (nivel 1..9). */
const NIVELES_POR_DEFECTO = [
  "Novato",
  "Aprendiz",
  "Practicante",
  "Competente",
  "Avanzado",
  "Experto",
  "Maestro",
  "Mentor",
  "Leyenda",
];

/**
 * Contraseña legible pero no adivinable.
 *
 * `randomUUID` es criptográfico. Se le quitan los guiones y se corta porque una
 * de 32 caracteres nadie la teclea bien, y esta se dicta por teléfono más veces
 * de las que uno cree.
 */
function generarPassword(): string {
  return "Klaze-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

/**
 * Da de alta una academia: la cuenta del creador, su perfil y la comunidad.
 *
 * Recibe el cliente ya construido en vez de construirlo, porque el guion de
 * terminal y el Route Handler obtienen la clave secreta de sitios distintos
 * pero la lógica de alta tiene que ser una sola. Cuando esto vivía solo dentro
 * del guion, copiarlo al handler habría garantizado que dentro de tres meses
 * hicieran cosas distintas.
 *
 * **Idempotente por slug**: repetir no duplica. Importa porque es lo primero
 * que uno reejecuta cuando algo sale a medias.
 */
export async function crearAcademia(
  admin: SupabaseClient,
  op: OpcionesAcademia
): Promise<ResultadoAcademia> {
  const { data: existente } = await admin
    .from("comunidades")
    .select("id, propietario_id")
    .eq("slug", op.slug)
    .maybeSingle();

  if (existente) {
    return {
      comunidadId: existente.id,
      usuarioId: existente.propietario_id,
      yaExistia: true,
      eraAlumno: false,
      passwordTemporal: null,
    };
  }

  // Reutiliza la cuenta si ya existe: puede haberla dejado un intento anterior
  // que creó el usuario y falló al crear la comunidad.
  //
  // Antes esto listaba las primeras mil cuentas y buscaba a mano. Pasadas mil
  // dejaba de encontrar a quien ya existe, intentaba crearlo otra vez y fallaba
  // — y ahora que el súper enlace llama aquí en cada venta, ese día llega solo.
  const { data: encontrado, error: errBusqueda } = await admin.rpc(
    "perfil_por_email",
    { p_email: op.email }
  );
  if (errBusqueda) {
    throw new Error(`No se pudo buscar la cuenta: ${errBusqueda.message}`);
  }
  let usuarioId = (encontrado as string | null) ?? undefined;

  let password: string | null = null;

  if (!usuarioId) {
    password = generarPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: op.email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    if (!data.user) throw new Error("Supabase no devolvió usuario al crearlo");
    usuarioId = data.user.id;
  }

  // El trigger `on_auth_user_created` ya creó el perfil; aquí solo el rol.
  //
  // Se mira el rol previo antes de pisarlo: si ese correo era de un alumno,
  // convertirlo en creador le cambia la vida —deja de entrar a sus cursos y
  // entra a un panel de administración— y quien da de alta merece enterarse.
  // Pasó de verdad en la primera prueba de esta pantalla.
  const { data: previo } = await admin
    .from("perfiles")
    .select("rol")
    .eq("id", usuarioId)
    .maybeSingle();
  const eraAlumno = previo?.rol === "alumno";

  const { error: errRol } = await admin
    .from("perfiles")
    .update({ rol: "creador" })
    .eq("id", usuarioId);
  if (errRol) throw new Error(`No se pudo marcar el rol: ${errRol.message}`);

  const { data: com, error: errCom } = await admin
    .from("comunidades")
    .insert({
      slug: op.slug,
      nombre: op.empresa,
      propietario_id: usuarioId,
      plan_id: op.planId ?? "pro",
      nombres_niveles: NIVELES_POR_DEFECTO,
    })
    .select("id")
    .single();
  if (errCom) throw new Error(`No se pudo crear la comunidad: ${errCom.message}`);

  // Se inscribe al creador en su propia academia. Sin esto, "Ver como alumno"
  // le enseña una academia vacía: el contenido solo llega a quien tiene
  // inscripción (`privado.cubre_curso`), y ser el dueño no es una.
  const { error: errInscripcion } = await admin.from("inscripciones").insert({
    usuario_id: usuarioId,
    comunidad_id: com.id,
    estado: "activo",
    todos_los_cursos: true,
  });
  if (errInscripcion) {
    throw new Error(`No se pudo inscribir al creador: ${errInscripcion.message}`);
  }

  return {
    comunidadId: com.id,
    usuarioId,
    yaExistia: false,
    eraAlumno,
    passwordTemporal: password,
  };
}
