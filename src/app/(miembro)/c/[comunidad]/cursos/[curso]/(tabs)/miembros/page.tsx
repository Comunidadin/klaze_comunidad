import { redirect } from "next/navigation";

/** El directorio ya es de la academia. Ver `../comunidad/page.tsx`. */
export default async function MiembrosDelModuloRedirige({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;
  redirect(`/c/${comunidad}/miembros`);
}
