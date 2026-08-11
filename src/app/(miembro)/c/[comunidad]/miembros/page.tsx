import { MiembrosDirectorio } from "./_miembros-directorio";

/**
 * Pestaña "Miembros" de un curso (Cambio 3) — Server Component: solo
 * desenvuelve `params` (async en Next 16) y delega la data/hidratación a
 * `MiembrosDirectorio` (client).
 */
export default async function MiembrosCursoPage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string }>;
}) {
  const { comunidad, curso } = await params;

  return <MiembrosDirectorio comunidadSlug={comunidad} cursoSlug={curso} />;
}
