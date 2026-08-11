import { redirect } from "next/navigation";

/**
 * Un espacio concreto, en su dirección vieja. Ver el docstring de la pestaña
 * de comunidad: el espacio conserva su `slug`, así que quien tuviera guardado
 * «Preguntas» sigue aterrizando en «Preguntas».
 */
export default async function EspacioDelModuloRedirige({
  params,
}: {
  params: Promise<{ comunidad: string; slug: string }>;
}) {
  const { comunidad, slug } = await params;
  redirect(`/c/${comunidad}/comunidad/espacio/${slug}`);
}
