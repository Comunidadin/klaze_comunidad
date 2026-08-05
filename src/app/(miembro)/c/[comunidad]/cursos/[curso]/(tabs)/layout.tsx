import { CursoTabsShell } from "./_curso-tabs-shell";

/**
 * Layout compartido de las 5 pestañas de un curso (Cambio 3):
 * Lecciones/Comunidad/Calendario/Miembros/Ranking. Vive en el route group
 * `(tabs)` (no agrega segmento a la URL) para que `/leccion/[id]` —hermano
 * de este grupo dentro de `[curso]`— NO herede esta cabecera/pestañas: el
 * reproductor se queda como está. Server Component: solo desenvuelve
 * `params` (async en Next 16) y delega la data/hidratación a
 * `CursoTabsShell` (client).
 */
export default async function CursoTabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ comunidad: string; curso: string }>;
}) {
  const { comunidad, curso } = await params;

  return (
    <CursoTabsShell comunidadSlug={comunidad} cursoSlug={curso}>
      {children}
    </CursoTabsShell>
  );
}
