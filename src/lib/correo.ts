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

/**
 * `RESEND_FROM` con el nombre visible cambiado.
 *
 * La dirección tiene que seguir siendo la verificada en Resend —con otra, el
 * envío se rechaza—, pero el nombre que se ve grande en la bandeja de entrada
 * es libre. Así cada academia firma sus correos sin verificar su propio
 * dominio, que es una función aparte.
 *
 * El nombre viene de Configuración o, por el súper enlace, del cuerpo de un
 * webhook — así que se le quitan comillas, ángulos y saltos de línea: dentro de
 * una cabecera `From` esos caracteres son otra dirección u otra cabecera, no
 * un nombre.
 */
export function conRemitente(base: string, nombre?: string): string {
  const limpio = nombre?.replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return base;

  const direccion = base.match(/<([^>]+)>\s*$/)?.[1] ?? base.trim();
  return `${limpio} <${direccion}>`;
}

export async function enviarCorreo(mensaje: {
  para: string;
  asunto: string;
  html: string;
  /**
   * Quién firma: el nombre de la academia, o «Klaze» en los correos de la
   * plataforma. Sin él se usa `RESEND_FROM` tal cual — que hoy dice el nombre
   * de UNA academia, así que todo llamador debería pasarlo.
   */
  remitenteNombre?: string;
}): Promise<ResultadoCorreo> {
  // `variableServidor` y no `process.env`: en Cloudflare los secretos subidos
  // con `wrangler secret put` viven en el entorno del worker, no en el build.
  const clave = await variableServidor("RESEND_API_KEY");
  const base = await variableServidor("RESEND_FROM");

  if (!clave || !base) {
    return { enviado: false, error: "Faltan RESEND_API_KEY o RESEND_FROM" };
  }

  const remitente = conRemitente(base, mensaje.remitenteNombre);

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
