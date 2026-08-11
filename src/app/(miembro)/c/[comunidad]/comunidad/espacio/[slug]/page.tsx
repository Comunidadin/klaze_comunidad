import { Feed } from "@/components/community/feed";

/**
 * El feed de un espacio puntual, enlazado desde `EspaciosSidebar`.
 *
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega los
 * datos y la hidratación a `Feed`, igual que la vista agregada.
 */
export default async function EspacioPage({
  params,
}: {
  params: Promise<{ comunidad: string; slug: string }>;
}) {
  const { comunidad, slug } = await params;

  return <Feed comunidadSlug={comunidad} espacioSlug={slug} />;
}
