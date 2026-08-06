import type { User } from "@/lib/types";
import { useAppStore } from "@/lib/store";

/**
 * Ruta "home" según el rol, usada por los guards para redirigir a quien entra
 * donde no le toca.
 *
 * - **superadmin** → `/admin` si es dueño de una academia (su uso diario es
 *   administrar la suya), si no `/plataforma`. Hay enlace cruzado entre ambas.
 * - **creador** → `/admin`
 * - **alumno** → `/c/[slug]/cursos`
 *
 * La comunidad sale del **armazón**, no de los datos semilla. Antes se buscaba
 * entre los mocks, y con una academia real eso mandaba a cualquier alumno a
 * `/c/comunidad-del-intercambio/cursos` — una comunidad que no existe. El
 * alumno entraba bien y aterrizaba en "Comunidad no encontrada".
 *
 * Si todavía no hay armazón —el guard corrió antes de que cargaran los datos—
 * devuelve `/login`: es la única respuesta honesta, y el propio guard volverá a
 * decidir en cuanto lleguen.
 */
export function homePorRol(user: User): string {
  const { armazon } = useAppStore.getState();

  if (user.rol === "superadmin") {
    return armazon?.comunidad?.ownerId === user.id ? "/admin" : "/plataforma";
  }
  if (user.rol === "creador") return "/admin";

  const slug = armazon?.comunidad?.slug;
  return slug ? `/c/${slug}/cursos` : "/login";
}
