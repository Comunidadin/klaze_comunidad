import { Feed } from "@/components/community/feed";

/**
 * Feed de un espacio puntual dentro de un curso
 * (`/c/[comunidad]/cursos/[curso]/comunidad/espacio/[slug]`), enlazado desde
 * `EspaciosSidebar`. Server Component: solo desenvuelve `params` (async en
 * Next 16) y delega la data/hidratación a `Feed` (client), igual que la
 * pestaña "Comunidad" agregada.
 */
export default async function EspacioCursoPage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string; slug: string }>;
}) {
  const { comunidad, curso, slug } = await params;

  return <Feed comunidadSlug={comunidad} cursoSlug={curso} espacioSlug={slug} />;
}
