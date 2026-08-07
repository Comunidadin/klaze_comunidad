import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Genera el enlace de acceso de una invitación y lo manda por correo.
 *
 * Es el ÚNICO código de servidor del proyecto, y existe porque hacen falta dos
 * cosas que el navegador no puede hacer: la clave secreta de Supabase para
 * crear la cuenta del invitado, y la de Resend para enviar en nombre del
 * dominio.
 *
 * OJO — aquí RLS NO protege nada. La clave secreta se salta todas las
 * políticas, así que el permiso hay que comprobarlo a mano. Es exactamente el
 * tipo de sitio donde se olvida: por eso lo primero que se hizo fue la prueba
 * de que rechaza a quien no es dueño de esa academia.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM;

  if (!url || !secreta || !resendKey || !remitente) {
    return NextResponse.json(
      {
        error:
          "Faltan variables de servidor: SUPABASE_SECRET_KEY, RESEND_API_KEY o RESEND_FROM",
      },
      { status: 500 }
    );
  }

  const cabecera = request.headers.get("authorization");
  const jwt = cabecera?.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!jwt) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const admin = createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: quien, error: errorQuien } = await admin.auth.getUser(jwt);
  if (errorQuien || !quien.user) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  let cuerpo: {
    comunidadId?: string;
    email?: string;
    token?: string;
    /**
     * `true` devuelve el enlace sin enviar correo. Lo usa el botón de copiar:
     * quien quiere el enlace para mandarlo por su cuenta no espera que además
     * salga un correo, y regenerar el enlace en cada copia evita tener que
     * guardarlos (son de un solo uso y caducan).
     */
    soloEnlace?: boolean;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { comunidadId, email, token, soloEnlace } = cuerpo;
  if (!comunidadId || !email || !token) {
    return NextResponse.json(
      { error: "Faltan datos: comunidadId, email y token" },
      { status: 400 }
    );
  }

  // La comprobación que RLS no hace por nosotros.
  const { data: comunidad } = await admin
    .from("comunidades")
    .select("nombre, propietario_id")
    .eq("id", comunidadId)
    .single();

  if (!comunidad || comunidad.propietario_id !== quien.user.id) {
    return NextResponse.json({ error: "No es tu academia" }, { status: 403 });
  }

  const origen = new URL(request.url).origin;
  const destino = `${origen}/invitacion/${token}`;

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
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existente = lista?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  let passwordTemporal: string | null = null;

  if (!existente) {
    passwordTemporal = "Klaze-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const { error } = await admin.auth.admin.createUser({
      email,
      password: passwordTemporal,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json(
        { error: `No se pudo crear la cuenta: ${error.message}` },
        { status: 500 }
      );
    }
  }
  // Si ya tenía cuenta NO se le cambia la contraseña: podría estar en otra
  // academia y le dejaríamos fuera de ella sin avisar. Entra con la suya.

  const enlace = destino;

  if (soloEnlace) {
    return NextResponse.json({ ok: true, enlace, enviado: false });
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remitente,
      to: [email],
      subject: `Tu acceso a ${comunidad.nombre}`,
      html: passwordTemporal
        ? `
        <p>Te han dado acceso a <strong>${comunidad.nombre}</strong>.</p>
        <p>Entra en <a href="${origen}/login">${origen}/login</a> con:</p>
        <p>
          Correo: <strong>${email}</strong><br>
          Contraseña: <strong style="font-family:monospace">${passwordTemporal}</strong>
        </p>
        <p style="color:#666;font-size:13px">
          Puedes cambiarla cuando quieras desde tu perfil.
        </p>`
        : `
        <p>Te han dado acceso a <strong>${comunidad.nombre}</strong>.</p>
        <p>Ya tenías cuenta, así que entra en
           <a href="${origen}/login">${origen}/login</a> con tu contraseña de siempre.</p>
        <p style="color:#666;font-size:13px">
          Si no la recuerdas, usa "¿Olvidaste tu contraseña?" en esa misma pantalla.
        </p>`,
    }),
  });

  if (!respuesta.ok) {
    // La invitación NO se borra: sin ella, quien invita se queda sin forma de
    // recuperar a ese alumno. Se devuelve el enlace para poder copiarlo a mano.
    const detalle = await respuesta.text();
    return NextResponse.json(
      {
        ok: false,
        enlace,
        error: `La invitación se creó, pero el correo no salió: ${detalle.slice(0, 200)}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, enlace, enviado: true });
}
