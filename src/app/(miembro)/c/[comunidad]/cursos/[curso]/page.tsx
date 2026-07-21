import { CursoDetalle } from "./_curso-detalle";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `CursoDetalle` (client).
 */
export default async function CursoDetallePage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string }>;
}) {
  const { comunidad, curso } = await params;

  return <CursoDetalle comunidadSlug={comunidad} cursoSlug={curso} />;
}
