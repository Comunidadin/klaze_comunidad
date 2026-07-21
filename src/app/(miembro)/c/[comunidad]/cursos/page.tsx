import { CursosGrid } from "./_cursos-grid";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `CursosGrid` (client), igual que el resto de rutas
 * dinámicas del proyecto.
 */
export default async function CursosPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <CursosGrid comunidadSlug={comunidad} />;
}
