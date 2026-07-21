import { InvitationScreen } from "./_invitation-screen";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * toda la lógica/hidratación a `InvitationScreen` (client), igual que el
 * layout de `(miembro)/c/[comunidad]`.
 */
export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <InvitationScreen token={token} />;
}
