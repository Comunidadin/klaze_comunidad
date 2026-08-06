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
      passwordTemporal: null,
    };
  }

  // Reutiliza la cuenta si ya existe: puede haberla dejado un intento anterior
  // que creó el usuario y falló al crear la comunidad.
  const { data: lista } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  let usuarioId = lista?.users?.find(
    (u) => u.email?.toLowerCase() === op.email.toLowerCase()
  )?.id;

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

  return {
    comunidadId: com.id,
    usuarioId,
    yaExistia: false,
    passwordTemporal: password,
  };
}
