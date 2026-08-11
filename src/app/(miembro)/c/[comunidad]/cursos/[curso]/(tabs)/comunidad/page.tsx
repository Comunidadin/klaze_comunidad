import { redirect } from "next/navigation";

/**
 * La comunidad ya no vive dentro de cada módulo: subió a la academia.
 *
 * Esto no es basura por limpiar. Es la dirección que tus alumnos tienen
 * guardada en el navegador, pegada en un WhatsApp o enlazada desde un correo
 * viejo, y sin esta redirección todas ellas darían 404 el día del despliegue.
 *
 * `redirect` con código 308: permanente, así que el navegador y los buscadores
 * se quedan con la nueva y dejan de pedir esta.
 */
export default async function ComunidadDelModuloRedirige({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;
  redirect(`/c/${comunidad}/comunidad`);
}
