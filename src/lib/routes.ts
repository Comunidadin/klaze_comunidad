import type { User } from "@/lib/types";
import { mockCommunities } from "@/lib/mocks/communities";
import { useAppStore } from "@/lib/store";

/**
 * Ruta "home" según el rol del usuario, usada por los guards de rol para
 * redirigir cuando alguien entra a una sección que no le corresponde.
 * - superadmin -> /admin si es dueño de alguna comunidad (uso diario: entra
 *   directo a administrar su academia), si no -> /plataforma. Desde ambas
 *   zonas hay un enlace cruzado en el sidebar hacia la otra (ver
 *   `(creador)/layout.tsx` y `(superadmin)/layout.tsx`).
 * - creador -> /admin
 * - alumno -> /c/[slug]/cursos (Cambio 3: el nivel superior del área de
 *   miembros es la lista de cursos), resolviendo la primera comunidad del
 *   usuario (mock o creada en runtime vía `registrarCreador`/invitación).
 */
export function homePorRol(user: User): string {
  const { comunidadesCreadas } = useAppStore.getState();
  const todas = [...mockCommunities, ...comunidadesCreadas];

  if (user.rol === "superadmin") {
    const esDueño = todas.some((c) => c.ownerId === user.id);
    return esDueño ? "/admin" : "/plataforma";
  }
  if (user.rol === "creador") return "/admin";

  const comunidad = todas.find((c) => user.comunidadIds.includes(c.id)) ?? todas[0];

  return `/c/${comunidad.slug}/cursos`;
}
