import { Feed } from "@/components/community/feed";

/**
 * Pestaña "Comunidad" de un curso (Cambio 3): feed de 3 columnas con
 * espacios, acotado a ESE curso. Server Component: solo desenvuelve
 * `params` (async en Next 16) y delega la data/hidratación a `Feed` (client).
 */
export default async function ComunidadCursoPage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string }>;
}) {
  const { comunidad, curso } = await params;

  return <Feed comunidadSlug={comunidad} cursoSlug={curso} />;
}
