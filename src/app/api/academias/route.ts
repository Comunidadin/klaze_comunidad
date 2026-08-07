import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { variableServidor } from "@/lib/entorno-servidor";
import { crearAcademia } from "@/lib/academia";

/**
 * Da de alta una academia. Segundo y último trozo de servidor del proyecto:
 * crear una cuenta exige la API de administración, que no existe en el
 * navegador.
 *
 * OJO — aquí RLS NO protege nada. La clave secreta se salta todas las
 * políticas, así que el permiso hay que comprobarlo a mano. Es exactamente el
 * tipo de sitio donde se olvida: por eso la primera prueba que se escribió fue
 * la que verifica que rechaza a quien no es superadmin.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = await variableServidor("SUPABASE_SECRET_KEY");

  if (!url || !secreta) {
    return NextResponse.json(
      {
        error:
          "Faltan variables de servidor: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY",
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

  // La comprobación que RLS no hace por nosotros. `app_metadata` y nunca
  // `user_metadata`: el segundo lo edita el propio usuario desde el navegador,
  // así que cualquiera podría ascenderse solo a superadmin.
  const rol = (quien.user.app_metadata as { rol?: string } | null)?.rol;
  if (rol !== "superadmin") {
    return NextResponse.json(
      { error: "Solo el superadmin da de alta academias" },
      { status: 403 }
    );
  }

  let cuerpo: { email?: string; empresa?: string; slug?: string; planId?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { email, empresa, slug, planId } = cuerpo;
  if (!email || !empresa || !slug) {
    return NextResponse.json(
      { error: "Faltan datos: email, empresa y slug" },
      { status: 400 }
    );
  }

  // El slug va en la URL de todos sus alumnos: si entra con mayúsculas o
  // espacios, el enlace se rompe para siempre y renombrarlo después deja
  // fuera a quien lo tuviera guardado.
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "El identificador solo admite minúsculas, números y guiones" },
      { status: 400 }
    );
  }

  try {
    const r = await crearAcademia(admin, { email, empresa, slug, planId });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear la academia" },
      { status: 500 }
    );
  }
}
