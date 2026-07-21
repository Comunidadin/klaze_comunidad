import { CursoEditor } from "./_curso-editor";

/**
 * Server Component: solo desenvuelve `params` (async en Next 16) y delega
 * la data/hidratación a `CursoEditor` (client), igual que el resto de rutas
 * dinámicas del proyecto. `curso` es el `id` del curso (no el `slug` — el
 * admin no necesita URLs bonitas y usar el id evita colisiones).
 */
export default async function AdminCursoEditorPage({
  params,
}: {
  params: Promise<{ curso: string }>;
}) {
  const { curso } = await params;

  return <CursoEditor cursoId={curso} />;
}
