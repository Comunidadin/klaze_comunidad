import { variableServidor } from "@/lib/entorno-servidor";

/**
 * Mandar un correo por Resend.
 *
 * Existe porque ya hay tres sitios que mandan correo —la invitación, el alta de
 * academia y la recuperación de contraseña— y la llamada era la misma copiada
 * tres veces. La tercera copia es siempre la que se queda sin el arreglo.
 *
 * **No lanza.** Un correo que no sale casi nunca debe tumbar lo que lo pedía:
 * el acceso ya se dio, la academia ya existe. Quien llama decide qué hacer con
 * `enviado: false` — el panel enseña un aviso, un webhook lo apunta y sigue.
 */
export interface ResultadoCorreo {
  enviado: boolean;
  /** Presente solo si no salió. Truncado, para que quepa en un registro. */
  error?: string;
}

export async function enviarCorreo(mensaje: {
  para: string;
  asunto: string;
  html: string;
}): Promise<ResultadoCorreo> {
  // `variableServidor` y no `process.env`: en Cloudflare los secretos subidos
  // con `wrangler secret put` viven en el entorno del worker, no en el build.
  const clave = await variableServidor("RESEND_API_KEY");
  const remitente = await variableServidor("RESEND_FROM");

  if (!clave || !remitente) {
    return { enviado: false, error: "Faltan RESEND_API_KEY o RESEND_FROM" };
  }

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [mensaje.para],
        subject: mensaje.asunto,
        html: mensaje.html,
      }),
    });

    if (!respuesta.ok) {
      return { enviado: false, error: (await respuesta.text()).slice(0, 200) };
    }
    return { enviado: true };
  } catch (e) {
    // Resend caído o sin red. Igual que un rechazo: se informa, no se lanza.
    return {
      enviado: false,
      error: (e instanceof Error ? e.message : "Error de red").slice(0, 200),
    };
  }
}
