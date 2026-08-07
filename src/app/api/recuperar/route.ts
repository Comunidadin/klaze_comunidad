import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { variableServidor } from "@/lib/entorno-servidor";

/**
 * "¿Olvidaste tu contraseña?" — manda un enlace para poner una nueva.
 *
 * **Manda un enlace y no una contraseña nueva.** Es la diferencia entre
 * recuperar y secuestrar: si esto generase una contraseña nueva, cualquiera
 * podría escribir el correo de otro y dejarlo fuera de su propia academia sin
 * saber siquiera si acertó. Con un enlace, quien no tiene acceso al buzón no
 * consigue nada.
 *
 * El correo sale por Resend, con nuestra plantilla. Supabase también sabe
 * mandarlo, pero entonces el creador recibe un correo con la marca de nuestro
 * proveedor de base de datos, que no le dice nada.
 *
 * **Responde lo mismo exista o no la cuenta.** Si dijera "ese correo no está
 * registrado", cualquiera podría averiguar quién tiene cuenta preguntando uno
 * a uno.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = variableServidor("SUPABASE_SECRET_KEY");
  const resendKey = variableServidor("RESEND_API_KEY");
  const remitente = variableServidor("RESEND_FROM");

  if (!url || !secreta || !resendKey || !remitente) {
    return NextResponse.json(
      { error: "Faltan variables de servidor" },
      { status: 500 }
    );
  }

  let cuerpo: { email?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const email = cuerpo.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Falta el correo" }, { status: 400 });
  }

  const admin = createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const origen = new URL(request.url).origin;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    // A `/callback` y no a `/nueva-clave`: solo `/callback` está en las
    // direcciones permitidas de Supabase. Con una que no lo está, Supabase la
    // ignora y usa el Site URL — así es como el enlace acababa en `localhost`
    // abierto desde producción. `/callback` reconoce que el enlace era de
    // recuperación y lleva a `/nueva-clave`.
    options: { redirectTo: `${origen}/callback` },
  });

  // Si la cuenta no existe, `generateLink` falla. Se responde igual que si
  // hubiera ido bien: ver el docstring.
  const enlace = !error ? data?.properties?.action_link : null;

  if (enlace) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [email],
        subject: "Recupera tu acceso",
        html: `
          <p>Pulsa aquí para poner una contraseña nueva:</p>
          <p><a href="${enlace}">Elegir contraseña nueva</a></p>
          <p style="color:#666;font-size:13px">
            El enlace caduca en una hora. Si no has sido tú, ignora este correo:
            tu contraseña actual sigue funcionando.
          </p>`,
      }),
    }).catch(() => {
      /* Si el correo no sale, tampoco se lo decimos a quien pregunta. */
    });
  }

  return NextResponse.json({ ok: true });
}
