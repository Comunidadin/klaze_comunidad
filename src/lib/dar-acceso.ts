import type { SupabaseClient } from "@supabase/supabase-js";
import { crearInvitaciones } from "@/lib/supabase/invitaciones";
import { enviarCorreo } from "@/lib/correo";
import { bloqueAcceso, componerCorreo, leerPlantilla } from "@/lib/plantillas";

/**
 * Dar acceso a alguien a una academia: cuenta, invitación y correo.
 *
 * Vive aquí y no dentro de un Route Handler porque hay **dos** puertas que lo
 * hacen —el panel (`/api/invitaciones`) y los enlaces de compra
 * (`/api/compras/[token]`)— y copiar este cuerpo para la segunda es
 * exactamente el error que dejó cuatro caminos abiertos cuando se arregló la
 * suspensión. Un solo cuerpo: lo que se arregle aquí queda arreglado en los
 * dos sitios.
 *
 * **Recibe el cliente admin**, con la clave secreta. Aquí RLS no protege nada:
 * quién puede llamar a esto lo decide cada Route Handler antes de llamar.
 */

export interface OpcionesAcceso {
  comunidadId: string;
  /** Solo para el asunto y el cuerpo del correo. */
  comunidadNombre: string;
  email: string;
  origen: string;
  enviarCorreo: boolean;
  /**
   * El nombre, si se sabe. Solo lo trae el webhook —el panel invita por correo
   * y nada más—, y solo sirve al crear la cuenta: a quien ya la tiene no se le
   * pisa el nombre que él mismo puso.
   */
  nombre?: string;
  /**
   * Cuando la fila de invitación **ya existe**. Es el caso del panel: el
   * navegador la crea con su sesión (y por tanto con RLS comprobando que es su
   * academia) y aquí solo se arma el enlace.
   */
  token?: string;
  /**
   * Cuando hay que crear la fila **aquí**. Es el caso del webhook, que no
   * tiene sesión con la que crearla antes.
   */
  cursoIds?: string[] | "todos";
}

export interface ResultadoAcceso {
  enlace: string;
  enviado: boolean;
  /** `true` si la persona ya tenía cuenta en Klaze, de esta academia o de otra. */
  yaTenia: boolean;
  /** Su id, para quien necesite seguir trabajando con ella. */
  usuarioId: string | null;
  /** Presente solo si el acceso se dio pero el correo no salió. */
  errorCorreo?: string;
}

/**
 * El id de quien usa ese correo, o `null`.
 *
 * Antes esto era `listUsers({ page: 1, perPage: 1000 })` y una búsqueda a mano.
 * Pasadas mil cuentas dejaba de encontrar a quien ya existía, intentaba crearla
 * otra vez y devolvía error — se rompía justo cuando el negocio funcionara.
 */
async function idPorEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data, error } = await admin.rpc("perfil_por_email", { p_email: email });
  if (error) throw new Error(`No se pudo buscar la cuenta: ${error.message}`);
  return (data as string | null) ?? null;
}

export async function darAcceso(
  admin: SupabaseClient,
  o: OpcionesAcceso
): Promise<ResultadoAcceso> {
  const email = o.email.trim().toLowerCase();

  // Se crea la cuenta CON contraseña temporal en vez de generar un enlace
  // mágico.
  //
  // `generateLink({ type: "invite" })` no solo genera: **crea la cuenta y manda
  // el correo de Supabase**, con su plantilla y su remitente. El nuestro salía
  // después, así que el invitado recibía dos correos y abría el que no era. Y
  // los enlaces mágicos ya habían fallado tres veces en este proyecto: caducan,
  // se invalidan al generar el siguiente, y no sobreviven a un cliente de
  // correo que los pre-visita.
  //
  // Una contraseña temporal no caduca, no se invalida sola, y se puede dictar
  // por teléfono si el correo no llega.
  const existente = await idPorEmail(admin, email);

  // La invitación va ANTES de crear la cuenta, y el orden importa: el trigger
  // `z_aceptar_invitaciones` corre al crearse la cuenta y convierte en
  // inscripción lo que encuentre pendiente. Al revés, no encontraría nada y el
  // recién llegado tendría que iniciar sesión para que su acceso existiera.
  let token = o.token;
  if (!token) {
    if (o.cursoIds === undefined) {
      throw new Error("darAcceso necesita `token` o `cursoIds`");
    }
    // Se reutiliza `crearInvitaciones`, que recibe el cliente: con el admin
    // funciona igual. Reescribir el insert aquí duplicaría la forma de
    // `todos_los_cursos` y de `invitacion_cursos`.
    const [creada] = await crearInvitaciones(
      admin,
      o.comunidadId,
      [email],
      o.cursoIds
    );
    token = creada.token;
  }

  let passwordTemporal: string | null = null;
  let usuarioId = existente;

  if (!existente) {
    passwordTemporal = "Klaze-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: passwordTemporal,
      email_confirm: true,
      // El trigger `crear_perfil_al_registrarse` lee `nombre` de aquí.
      user_metadata: o.nombre ? { nombre: o.nombre } : {},
    });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    usuarioId = data.user?.id ?? null;
  }
  // Si ya tenía cuenta NO se le cambia la contraseña: podría estar en otra
  // academia y le dejaríamos fuera de ella sin avisar. Entra con la suya.

  const enlace = `${o.origen}/invitacion/${token}`;
  const base = { enlace, yaTenia: Boolean(existente), usuarioId };

  if (!o.enviarCorreo) return { ...base, enviado: false };

  // El texto lo pone el dueño de la academia; el bloque de acceso, Klaze.
  const plantilla = await leerPlantilla(admin, o.comunidadId, "bienvenida");

  // A la entrada de SU academia y no a `/login` a secas: es la pantalla con su
  // logo y su portada. Si por lo que sea no se puede leer el identificador,
  // `/login` sirve igual — pide el correo y resuelve la academia sola.
  const { data: comunidad } = await admin
    .from("comunidades")
    .select("slug")
    .eq("id", o.comunidadId)
    .maybeSingle();
  const loginUrl = comunidad?.slug
    ? `${o.origen}/login/${comunidad.slug}`
    : `${o.origen}/login`;

  const { asunto, html } = componerCorreo(
    plantilla,
    { academia: o.comunidadNombre, correo: email, nombre: o.nombre },
    bloqueAcceso({ loginUrl, correo: email, password: passwordTemporal })
  );

  // La bienvenida la firma la academia, no la plataforma: para el alumno,
  // quien le da acceso es «Academia Trading», y un remitente desconocido es
  // camino directo a la carpeta de spam.
  const r = await enviarCorreo({
    para: email,
    asunto,
    html,
    remitenteNombre: o.comunidadNombre,
  });

  return { ...base, enviado: r.enviado, errorCorreo: r.error };
}
