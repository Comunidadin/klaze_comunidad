"use client";

import { mockEvents } from "@/lib/mocks/events";
import type { CommunityEvent } from "@/lib/types";

export function useEvents(comunidadId: string): { eventos: CommunityEvent[] } {
  const eventos = mockEvents
    .filter((e) => e.comunidadId === comunidadId)
    .sort(
      (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
    );

  return { eventos };
}
