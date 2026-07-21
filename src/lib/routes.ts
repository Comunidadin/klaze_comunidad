import type { User } from "@/lib/types";
import { mockCommunities } from "@/lib/mocks/communities";
import { useKlazeStore } from "@/lib/store";

/**
 * Ruta "home" según el rol del usuario, usada por los guards de rol para
 * redirigir cuando alguien entra a una sección que no le corresponde.
 * - superadmin -> /plataforma
 * - creador -> /admin
 * - alumno -> /c/[slug]/inicio, resolviendo la primera comunidad del
 *   usuario (mock o creada en runtime vía `registrarCreador`/invitación).
 */
export function homePorRol(user: User): string {
  if (user.rol === "superadmin") return "/plataforma";
  if (user.rol === "creador") return "/admin";

  const { comunidadesCreadas } = useKlazeStore.getState();
  const todas = [...mockCommunities, ...comunidadesCreadas];
  const comunidad = todas.find((c) => user.comunidadIds.includes(c.id)) ?? todas[0];

  return `/c/${comunidad.slug}/inicio`;
}
