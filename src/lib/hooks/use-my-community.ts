"use client";

import { useAppStore } from "@/lib/store";
import type { Community } from "@/lib/types";

/**
 * La comunidad que administra el usuario logueado.
 *
 * Sale del armazón: la base ya decidió qué comunidad puede ver esta persona,
 * así que aquí solo queda comprobar que además sea SUYA. A diferencia de
 * `useCommunity` (que resuelve por slug para las rutas de miembro), el admin
 * no tiene el slug en la URL: siempre opera sobre "mi" comunidad.
 *
 * Devuelve `null` mientras no hay sesión o si el usuario no es dueño de
 * ninguna — las pantallas de `/admin` deben tratar ese caso con un
 * `EmptyState`, no asumir que siempre hay una.
 *
 * Ya no aplica overrides: `/admin/configuracion` escribe directamente en la
 * base, así que la comunidad del armazón es la verdad.
 */
export function useMyCommunity(): Community | null {
  const armazon = useAppStore((s) => s.armazon);

  const base = armazon?.comunidad ?? null;
  if (!base || !armazon) return null;
  if (base.ownerId !== armazon.perfil.id) return null;

  return base;
}
