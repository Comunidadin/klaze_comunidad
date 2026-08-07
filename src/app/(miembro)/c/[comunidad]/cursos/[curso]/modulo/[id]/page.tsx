import { ModuloDetalle } from "./_modulo-detalle";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `ModuloDetalle` (client).
 */
export default async function ModuloDetallePage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string; id: string }>;
}) {
  const { comunidad, curso, id } = await params;

  return <ModuloDetalle comunidadSlug={comunidad} cursoSlug={curso} moduloId={id} />;
}
