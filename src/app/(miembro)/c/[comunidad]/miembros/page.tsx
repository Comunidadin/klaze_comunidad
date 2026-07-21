import { MiembrosDirectorio } from "./_miembros-directorio";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `MiembrosDirectorio` (client), igual que el resto
 * de rutas dinámicas del proyecto.
 */
export default async function MiembrosPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <MiembrosDirectorio comunidadSlug={comunidad} />;
}
