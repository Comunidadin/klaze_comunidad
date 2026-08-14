import type { Metadata } from "next";
import { MemberShell } from "@/components/shells/member-shell";
import { estiloDeAcademia } from "@/lib/color-academia";
import { leerMarcaServidor } from "@/lib/marca-servidor";

/**
 * Server Component: desenvuelve `params` (async en Next 16), delega la
 * data/hidratación a `MemberShell` (client) — y pone la marca de la academia
 * donde el cliente no llega:
 *
 * - **La pestaña** (`generateMetadata`): el nombre de la academia y su logo de
 *   favicon, en vez de «Klaze». `src/app/layout.tsx` lo tenía apuntado como
 *   pendiente desde el principio.
 * - **El color** (`<style>` con la paleta de `estiloDeAcademia`): llega ya en
 *   el HTML — cero parpadeo, los botones nunca existen en cian — y como pisa
 *   `:root` alcanza también a los diálogos y toasts que se montan por portal
 *   en el `body`, fuera del árbol del shell (el `--community-accent` del
 *   `MemberShell`, puesto en un div, no los alcanzaba). Al navegar al panel,
 *   React desmonta este layout y el `<style>` se va con él.
 *
 * Sin fila (slug inventado, academia suspendida, base caída) todo degrada a la
 * marca de Klaze: `leerMarcaServidor` devuelve `null` y no se inyecta nada.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}): Promise<Metadata> {
  const { comunidad } = await params;
  const marca = await leerMarcaServidor(comunidad);
  if (!marca?.nombre) return {};
  return {
    title: marca.nombre,
    ...(marca.logoUrl ? { icons: { icon: marca.logoUrl } } : {}),
  };
}

export default async function ComunidadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;
  // El mismo GET que generateMetadata: el fetch de Next lo memoiza por
  // petición, así que a la base solo viaja una vez.
  const marca = await leerMarcaServidor(comunidad);
  const css = marca?.colorAcento ? estiloDeAcademia(marca.colorAcento) : "";

  return (
    <>
      {css ? <style>{css}</style> : null}
      <MemberShell communitySlug={comunidad}>{children}</MemberShell>
    </>
  );
}
