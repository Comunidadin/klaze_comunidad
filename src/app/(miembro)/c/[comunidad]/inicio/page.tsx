import { redirect } from "next/navigation";

/**
 * `/c/[comunidad]/inicio` ya no existe como pantalla (Cambio 3: la comunidad
 * pasa a vivir dentro de cada curso, y el nivel superior del área de
 * miembros es la lista de cursos). Se conserva esta ruta solo como
 * redirect — hay enlaces viejos al "inicio" en el pie de página y el logo
 * que no vale la pena cazar uno por uno, y cualquier bookmark externo a esta
 * URL no debe romperse con un 404.
 */
export default async function InicioRedirectPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;
  redirect(`/c/${comunidad}/cursos`);
}
