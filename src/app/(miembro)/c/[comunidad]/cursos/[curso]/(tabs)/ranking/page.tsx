import { redirect } from "next/navigation";

/** El ranking ya es de la academia. Ver `../comunidad/page.tsx`. */
export default async function RankingDelModuloRedirige({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;
  redirect(`/c/${comunidad}/ranking`);
}
