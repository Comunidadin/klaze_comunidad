import { Feed } from "@/components/community/feed";

/**
 * La comunidad de la academia: feed de tres columnas con sus espacios.
 *
 * Estuvo dentro de cada módulo (`/cursos/[curso]/comunidad`) y subió aquí: con
 * un temario partido en diez, cada alumno acababa en un feed distinto según lo
 * que hubiera comprado, y casi siempre vacío.
 *
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega los
 * datos y la hidratación a `Feed`, que es cliente.
 */
export default async function ComunidadPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <Feed comunidadSlug={comunidad} />;
}
