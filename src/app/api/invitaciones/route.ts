import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { variableServidor } from "@/lib/entorno-servidor";
import { darAcceso } from "@/lib/dar-acceso";

/**
 * Genera el enlace de acceso de una invitación y lo manda por correo.
 *
 * Existe porque hacen falta dos cosas que el navegador no puede hacer: la clave
 * secreta de Supabase para crear la cuenta del invitado, y la de Resend para
 * enviar en nombre del dominio.
 *
 * Esta es la puerta **del panel**: quien invita tiene sesión, y la fila de la
 * invitación ya está creada. La otra puerta —los enlaces de compra, en
 * `/api/compras/[token]`— no tiene sesión y crea la fila ella. Lo que hacen las
 * dos una vez decidido que sí, vive en `src/lib/dar-acceso.ts`.
 *
 * OJO — aquí RLS NO protege nada. La clave secreta se salta todas las
 * políticas, así que el permiso hay que comprobarlo a mano. Es exactamente el
 * tipo de sitio donde se olvida: por eso lo primero que se hizo fue la prueba
 * de que rechaza a quien no es dueño de esa academia.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = await variableServidor("SUPABASE_SECRET_KEY");
  const resendKey = await variableServidor("RESEND_API_KEY");
  const remitente = await variableServidor("RESEND_FROM");

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

  let r;
  try {
    // La fila de invitación ya existe: la creó el navegador con su sesión, y
    // por tanto con RLS comprobando que es su academia. Aquí solo llega el
    // token.
    r = await darAcceso(admin, {
      comunidadId,
      comunidadNombre: comunidad.nombre,
      email,
      origen,
      token,
      enviarCorreo: !soloEnlace,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo dar el acceso" },
      { status: 500 }
    );
  }

  if (r.errorCorreo) {
    // La invitación NO se borra: sin ella, quien invita se queda sin forma de
    // recuperar a ese alumno. Se devuelve el enlace para poder copiarlo a mano.
    return NextResponse.json(
      {
        ok: false,
        enlace: r.enlace,
        error: `La invitación se creó, pero el correo no salió: ${r.errorCorreo}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, enlace: r.enlace, enviado: r.enviado });
}
