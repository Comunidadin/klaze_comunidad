import { Feed } from "./_feed";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `Feed` (client), igual que el resto de rutas
 * dinámicas del proyecto.
 */
export default async function InicioPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <Feed comunidadSlug={comunidad} />;
}
