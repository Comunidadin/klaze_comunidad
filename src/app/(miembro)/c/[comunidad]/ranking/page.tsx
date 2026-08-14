import { RankingTablero } from "./_ranking-tablero";

/**
 * Pestaña «Ranking» de la academia — Server Component: solo desenvuelve
 * `params` (async en Next 16) y delega en `RankingTablero` (client).
 */
export default async function RankingPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <RankingTablero comunidadSlug={comunidad} />;
}
