import { CalendarioLista } from "./_calendario-lista";

/**
 * Pestaña "Calendario" de un curso (Cambio 3) — Server Component: solo
 * desenvuelve `params` (async en Next 16) y delega la data/hidratación a
 * `CalendarioLista` (client).
 */
export default async function CalendarioCursoPage({
  params,
}: {
  params: Promise<{ comunidad: string; curso: string }>;
}) {
  const { comunidad, curso } = await params;

  return <CalendarioLista comunidadSlug={comunidad} cursoSlug={curso} />;
}
