"use client";

import { useKlazeStore } from "@/lib/store";
import { mockEvents } from "@/lib/mocks/events";
import type { CommunityEvent } from "@/lib/types";

/**
 * Aplica `eventosEditados` (creados/editados desde /admin/eventos) sobre los
 * eventos del seed de `comunidadId`: mismo patrón que `mergeCursos` en
 * `use-courses.ts` — un `id` que matchea un evento del mock es una edición
 * (lo reemplaza), uno sin match es un evento nuevo (se agrega). Exportada
 * por si en el futuro hace falta un merge crudo (p. ej. panel super-admin);
 * `useEvents` es hoy el único consumidor.
 */
export function mergeEventos(
  comunidadId: string,
  eventosEditados: CommunityEvent[]
): CommunityEvent[] {
  const base = mockEvents.filter((e) => e.comunidadId === comunidadId);
  const overridesMismaComunidad = eventosEditados.filter(
    (e) => e.comunidadId === comunidadId
  );

  const combinados = base.map(
    (evento) => overridesMismaComunidad.find((o) => o.id === evento.id) ?? evento
  );
  const nuevos = overridesMismaComunidad.filter(
    (o) => !base.some((b) => b.id === o.id)
  );

  return [...combinados, ...nuevos];
}

export function useEvents(comunidadId: string): { eventos: CommunityEvent[] } {
  const eventosEditados = useKlazeStore((s) => s.eventosEditados);
  const eventosEliminados = useKlazeStore((s) => s.eventosEliminados);

  const eventos = mergeEventos(comunidadId, eventosEditados)
    .filter((e) => !eventosEliminados.includes(e.id))
    .sort(
      (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
    );

  return { eventos };
}
