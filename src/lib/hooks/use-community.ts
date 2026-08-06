"use client";

import { useAppStore } from "@/lib/store";
import type { Community } from "@/lib/types";

export interface UseCommunityResult {
  community: Community;
  isOwner: boolean;
}

/**
 * Resuelve la comunidad de la ruta `/c/[comunidad]` por su slug.
 *
 * Solo puede devolver la comunidad del armazón: la base entrega únicamente
 * aquella a la que perteneces. Si el slug de la URL no es la tuya, devuelve
 * `null` y la pantalla muestra "no encontrada" — que es la respuesta correcta,
 * porque confirmar que existe la comunidad de otra empresa ya sería contar de
 * más.
 */
export function useCommunity(slug: string): UseCommunityResult | null {
  const armazon = useAppStore((s) => s.armazon);

  const base = armazon?.comunidad ?? null;
  if (!base || base.slug !== slug) return null;

  const community = base;
  const isOwner = armazon !== null && armazon.perfil.id === community.ownerId;

  return { community, isOwner };
}
