import { LeccionDetalle } from "./_leccion-detalle";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `LeccionDetalle` (client).
 */
export default async function LeccionDetallePage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string; id: string }>;
}) {
  const { comunidad, curso, id } = await params;

  return <LeccionDetalle comunidadSlug={comunidad} cursoSlug={curso} leccionId={id} />;
}
