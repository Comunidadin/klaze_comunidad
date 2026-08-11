import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { variableServidor } from "@/lib/entorno-servidor";
import { avisarBaja } from "@/lib/quitar-acceso";

/**
 * Avisa a un alumno de que su acceso quedó pausado, desde el panel.
 *
 * La suspensión en sí ya la hizo el navegador (`cambiarEstadoAlumno`, con la
 * sesión del dueño y por tanto con RLS comprobando que es su academia). Aquí
 * solo se manda el correo, que necesita la clave de Resend — y esa no puede
 * estar en el navegador.
 *
 * Es la misma forma que `/api/compras/[token]/baja`, pero por la otra puerta:
 * allí la baja llega de una pasarela sin sesión, aquí de una persona con
 * sesión. El correo, y el texto que lo compone, son el mismo.
 *
 * OJO — aquí RLS NO protege nada: la clave secreta se salta las políticas. El
 * permiso se comprueba a mano, igual que en `/api/invitaciones`, y por eso lo
 * primero que se probó fue que rechaza a quien no es dueño de esa academia.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = await variableServidor("SUPABASE_SECRET_KEY");

  if (!url || !secreta) {
    return NextResponse.json(
      { error: "Falta configurar SUPABASE_SECRET_KEY" },
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

  let cuerpo: { comunidadId?: string; usuarioId?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { comunidadId, usuarioId } = cuerpo;
  if (!comunidadId || !usuarioId) {
    return NextResponse.json(
      { error: "Faltan datos: comunidadId y usuarioId" },
      { status: 400 }
    );
  }

  // La comprobación que RLS no hace por nosotros.
  const { data: comunidad } = await admin
    .from("comunidades")
    .select("nombre, propietario_id")
    .eq("id", comunidadId)
    .maybeSingle();

  if (!comunidad || comunidad.propietario_id !== quien.user.id) {
    return NextResponse.json({ error: "No es tu academia" }, { status: 403 });
  }

  // Y que ese alumno esté de verdad suspendido en ESTA academia. Sin esto, el
  // dueño de una academia podría mandarle un correo con su marca a cualquier
  // cuenta de Klaze pasando un id ajeno.
  const { data: inscripcion } = await admin
    .from("inscripciones")
    .select("estado")
    .eq("usuario_id", usuarioId)
    .eq("comunidad_id", comunidadId)
    .maybeSingle();

  if (!inscripcion || inscripcion.estado !== "suspendido") {
    return NextResponse.json(
      { error: "Ese alumno no está suspendido en tu academia" },
      { status: 403 }
    );
  }

  const { data: perfil } = await admin
    .from("perfiles")
    .select("nombre, email")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!perfil?.email) {
    return NextResponse.json({ ok: false, motivo: "sin_correo" });
  }

  const r = await avisarBaja(admin, {
    comunidadId,
    comunidadNombre: comunidad.nombre,
    email: perfil.email,
    nombre: perfil.nombre ?? undefined,
  });

  // 200 aunque el correo no salga: la suspensión ya está hecha y es lo que
  // importaba. El panel lo dice como aviso, no como fallo.
  return NextResponse.json({ ok: r.enviado, error: r.error });
}
