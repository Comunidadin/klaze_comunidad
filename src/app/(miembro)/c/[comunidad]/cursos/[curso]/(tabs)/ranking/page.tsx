import { RankingTablero } from "./_ranking-tablero";

/**
 * Pestaña "Ranking" de un curso (Cambio 3) — Server Component: solo
 * desenvuelve `params` (async en Next 16) y delega la data/hidratación a
 * `RankingTablero` (client).
 */
export default async function RankingCursoPage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string }>;
}) {
  const { comunidad, curso } = await params;

  return <RankingTablero comunidadSlug={comunidad} cursoSlug={curso} />;
}
