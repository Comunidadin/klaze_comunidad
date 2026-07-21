import { MemberShell } from "@/components/shells/member-shell";

/**
 * Aplica `MemberShell` con el slug de la comunidad del segmento de ruta.
 * Server Component: no necesita hooks, solo desenvuelve `params` (async
 * en Next 16) y delega la data/hidratación a `MemberShell` (client).
 */
export default async function ComunidadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <MemberShell communitySlug={comunidad}>{children}</MemberShell>;
}
