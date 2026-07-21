import { CalendarioLista } from "./_calendario-lista";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `CalendarioLista` (client), igual que el resto de
 * rutas dinámicas del proyecto.
 */
export default async function CalendarioPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <CalendarioLista comunidadSlug={comunidad} />;
}
