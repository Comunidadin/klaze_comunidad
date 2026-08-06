"use client";

import { crearClienteNavegador } from "@/lib/supabase/client";

export interface ResultadoEnvio {
  enlace: string;
  enviado: boolean;
}

/**
 * Pide al servidor el enlace de acceso de una invitación, y opcionalmente que
 * lo mande por correo.
 *
 * Va contra `/api/invitaciones` y no directo a Supabase porque generar el
 * enlace exige la clave secreta, que jamás puede estar en el navegador. El
 * token de sesión viaja en la cabecera para que el servidor pueda comprobar
 * que quien pide es el dueño de esa academia — ahí RLS no protege nada.
 *
 * Con `soloEnlace`, no se envía correo: es lo que usa el botón de copiar.
 * Cada llamada genera un enlace nuevo, porque son de un solo uso y caducan;
 * guardarlos sería guardar sesiones a medio usar.
 */
export async function pedirEnlaceInvitacion(
  comunidadId: string,
  email: string,
  token: string,
  soloEnlace = false
): Promise<ResultadoEnvio> {
  const { data } = await crearClienteNavegador().auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");

  const respuesta = await fetch("/api/invitaciones", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ comunidadId, email, token, soloEnlace }),
  });

  const cuerpo = (await respuesta.json()) as {
    enlace?: string;
    enviado?: boolean;
    error?: string;
  };

  // El 502 significa "la invitación existe pero el correo no salió", y trae el
  // enlace igualmente. Se trata como error para que el aviso se vea, pero el
  // enlace no se pierde: quien invita puede copiarlo de la lista.
  if (!respuesta.ok || !cuerpo.enlace) {
    throw new Error(cuerpo.error ?? "No se pudo preparar la invitación");
  }

  return { enlace: cuerpo.enlace, enviado: cuerpo.enviado ?? false };
}
