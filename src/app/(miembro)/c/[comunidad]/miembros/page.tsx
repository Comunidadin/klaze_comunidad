import { MiembrosDirectorio } from "./_miembros-directorio";

/**
 * Pestaña «Miembros» de la academia — Server Component: solo desenvuelve
 * `params` (async en Next 16) y delega en `MiembrosDirectorio` (client).
 */
export default async function MiembrosPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <MiembrosDirectorio comunidadSlug={comunidad} />;
}
