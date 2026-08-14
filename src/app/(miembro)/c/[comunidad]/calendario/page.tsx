import { CalendarioLista } from "./_calendario-lista";

/**
 * Pestaña «Calendario» de la academia — Server Component: solo desenvuelve
 * `params` (async en Next 16) y delega la data/hidratación a
 * `CalendarioLista` (client). Esperaba también un `curso` que esta ruta no
 * tiene — fósil de cuando el calendario vivía dentro de cada módulo — y ese
 * `undefined` dejaba la pestaña en blanco.
 */
export default async function CalendarioPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;

  return <CalendarioLista comunidadSlug={comunidad} />;
}
