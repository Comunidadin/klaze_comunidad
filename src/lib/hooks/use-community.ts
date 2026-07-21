"use client";

import { useKlazeStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { useSession } from "@/lib/hooks/use-session";
import type { Community } from "@/lib/types";

export interface UseCommunityResult {
  community: Community;
  isOwner: boolean;
}

export function useCommunity(slug: string): UseCommunityResult | null {
  const comunidadesCreadas = useKlazeStore((s) => s.comunidadesCreadas);
  const { user } = useSession();

  const community =
    comunidadesCreadas.find((c) => c.slug === slug) ??
    mockCommunities.find((c) => c.slug === slug) ??
    null;

  if (!community) return null;

  const isOwner = user !== null && user.id === community.ownerId;

  return { community, isOwner };
}
