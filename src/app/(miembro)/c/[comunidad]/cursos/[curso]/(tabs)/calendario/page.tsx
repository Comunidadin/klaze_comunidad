import { redirect } from "next/navigation";

/** El calendario ya es de la academia. Ver `../comunidad/page.tsx`. */
export default async function CalendarioDelModuloRedirige({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;
  redirect(`/c/${comunidad}/calendario`);
}
