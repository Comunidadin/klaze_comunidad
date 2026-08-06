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

  // `invite` crea la cuenta si no existe. Si ya existe falla, y entonces sirve
  // `magiclink`, que no la crea. Las dos aterrizan en la misma pantalla con la
  // sesión ya iniciada.
  let enlace: string | null = null;
  let ultimoError = "";
  for (const tipo of ["invite", "magiclink"] as const) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: tipo,
      email,
      options: { redirectTo: destino },
    });
    if (!error && data?.properties?.action_link) {
      enlace = data.properties.action_link;
      break;
    }
    ultimoError = error?.message ?? "sin enlace";
  }

  if (!enlace) {
    return NextResponse.json(
      { error: `No se pudo generar el enlace de acceso: ${ultimoError}` },
      { status: 500 }
    );
  }

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
      html: `
        <p>Te han dado acceso a <strong>${comunidad.nombre}</strong>.</p>
        <p><a href="${enlace}">Entrar a la academia</a></p>
        <p style="color:#666;font-size:13px">
          El enlace caduca en 24 horas. Si ya caducó, pide uno nuevo a quien te invitó.
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
