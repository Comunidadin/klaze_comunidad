import { RankingTablero } from "./_ranking-tablero";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `RankingTablero` (client), igual que el resto de
 * rutas dinámicas del proyecto.
 */
export default async function RankingPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <RankingTablero comunidadSlug={comunidad} />;
}
