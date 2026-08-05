"use client";

import { resolverComunidad, useAppStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { useSession } from "@/lib/hooks/use-session";
import type { Community } from "@/lib/types";

/**
 * Comunidad del creador logueado (`ownerId === user.id`), buscada entre los
 * mocks y las comunidades registradas en runtime vía `registrarCreador`.
 * A diferencia de `useCommunity` (que resuelve por slug para las rutas de
 * miembro `/c/[comunidad]`), el admin (`/admin/*`) no tiene el slug en la
 * URL: siempre opera sobre "mi" comunidad.
 *
 * Devuelve `null` mientras no hay sesión, o si el usuario logueado no es
 * dueño de ninguna comunidad (p. ej. un superadmin sin comunidad propia) —
 * las pantallas de `/admin` deben tratar ese caso con un `EmptyState`, no
 * asumir que siempre hay una.
 */
export function useMyCommunity(): Community | null {
  const comunidadesCreadas = useAppStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useAppStore((s) => s.comunidadOverrides);
  const { user } = useSession();

  if (!user) return null;

  const todas = [...mockCommunities, ...comunidadesCreadas];
  const base = todas.find((c) => c.ownerId === user.id) ?? null;
  if (!base) return null;

  return resolverComunidad(base, comunidadOverrides);
}
