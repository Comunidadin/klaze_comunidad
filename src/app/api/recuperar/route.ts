import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { variableServidor } from "@/lib/entorno-servidor";
import { enviarCorreo } from "@/lib/correo";
import { TOPES, consumir, ipDe } from "@/lib/limites";
import { esEmailValido } from "@/lib/validation";
import {
  PLANTILLAS_POR_DEFECTO,
  bloqueRecuperacion,
  componerCorreo,
  leerPlantilla,
} from "@/lib/plantillas";

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
 *
 * **Y responde lo mismo cuando se pasa del tope**, que es lo mismo llevado un
 * paso más allá: un 429 aquí diría "has llegado al límite de ESE correo", o
 * sea, "ese correo existe". Quien se pasa del tope recibe `{ok:true}` y no
 * recibe correo, igual que quien escribe una dirección inventada. Desde fuera
 * las tres respuestas son idénticas y no hay nada que deducir.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = await variableServidor("SUPABASE_SECRET_KEY");
  const resendKey = await variableServidor("RESEND_API_KEY");
  const remitente = await variableServidor("RESEND_FROM");

  if (!url || !secreta || !resendKey || !remitente) {
    return NextResponse.json(
      { error: "Faltan variables de servidor" },
      { status: 500 }
    );
  }

  let cuerpo: { email?: string; slug?: string };
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

  // Los dos topes, y el orden entre ellos importa.
  //
  // Primero el de la IP: es el que corta el bucle, y hacerlo antes evita que
  // un atacante llene `limites_uso` con una fila por cada correo inventado que
  // se le ocurra. Después el formato, para no gastar cupo con basura. Y solo
  // al final el del correo, que es el que protege a una persona concreta de
  // que le llenen el buzón.
  //
  // `ok:true` en los tres casos: ver el docstring.
  const ok = { ok: true };

  if (!(await consumir(admin, "recuperar_ip", ipDe(request), TOPES.recuperarIp))) {
    return NextResponse.json(ok);
  }

  if (!esEmailValido(email)) return NextResponse.json(ok);

  if (!(await consumir(admin, "recuperar_email", email, TOPES.recuperarEmail))) {
    return NextResponse.json(ok);
  }

  // El identificador lo manda `/login/{academia}`, que ya sabe de cuál es;
  // `/login` a secas no lo manda y se queda con el texto por defecto.
  //
  // Es la única respuesta correcta: una persona puede estar en varias
  // academias, y un correo suelto no dice en cuál está pidiendo entrar.
  const { data: academia } = cuerpo.slug
    ? await admin
        .from("comunidades")
        .select("id, nombre")
        .eq("slug", cuerpo.slug)
        .maybeSingle()
    : { data: null };

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
    const plantilla = academia
      ? await leerPlantilla(admin, academia.id, "recuperacion")
      : PLANTILLAS_POR_DEFECTO.recuperacion;

    const { asunto, html } = componerCorreo(
      plantilla,
      { academia: academia?.nombre ?? "tu academia", correo: email },
      bloqueRecuperacion(enlace)
    );

    await enviarCorreo({ para: email, asunto, html }).catch(() => {
      /* Si el correo no sale, tampoco se lo decimos a quien pregunta. */
    });
  }

  return NextResponse.json({ ok: true });
}
