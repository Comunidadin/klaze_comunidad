"use client";

import { resolverComunidad, useAppStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { useSession } from "@/lib/hooks/use-session";
import type { Community } from "@/lib/types";

export interface UseCommunityResult {
  community: Community;
  isOwner: boolean;
}

export function useCommunity(slug: string): UseCommunityResult | null {
  const comunidadesCreadas = useAppStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useAppStore((s) => s.comunidadOverrides);
  const { user } = useSession();

  const base =
    comunidadesCreadas.find((c) => c.slug === slug) ??
    mockCommunities.find((c) => c.slug === slug) ??
    null;

  if (!base) return null;

  const community = resolverComunidad(base, comunidadOverrides);

  const isOwner = user !== null && user.id === community.ownerId;

  return { community, isOwner };
}
