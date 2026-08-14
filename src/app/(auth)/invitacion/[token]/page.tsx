import type { Metadata } from "next";
import { InvitationScreen } from "./_invitation-screen";
import { estiloDeAcademia } from "@/lib/color-academia";
import { leerMarcaInvitacion } from "@/lib/marca-servidor";

/**
 * Server Component: desenvuelve `params` (async en Next 16) y delega la
 * lógica/hidratación a `InvitationScreen` (client) — añadiendo desde el
 * servidor la pestaña y la paleta de la academia que invita, con
 * `invitacion_publica`, la misma RPC que el cliente ya consulta (devuelve
 * vacío para token inexistente, ya aceptado o academia suspendida, sin
 * distinguir los casos — y aquí ese vacío degrada a la marca de Klaze).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const marca = await leerMarcaInvitacion(token);
  if (!marca?.nombre) return {};
  return {
    title: `Invitación a ${marca.nombre}`,
    ...(marca.logoUrl ? { icons: { icon: marca.logoUrl } } : {}),
  };
}

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const marca = await leerMarcaInvitacion(token);
  const css = marca?.colorAcento ? estiloDeAcademia(marca.colorAcento) : "";

  return (
    <>
      {css ? <style>{css}</style> : null}
      <InvitationScreen token={token} />
    </>
  );
}
