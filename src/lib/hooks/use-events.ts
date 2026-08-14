"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { leerEventos } from "@/lib/supabase/eventos";
import type { CommunityEvent } from "@/lib/types";

/** Referencia estable: un `[]` nuevo por render relanzaría el efecto en bucle. */
const SIN_EVENTOS: CommunityEvent[] = [];

/**
 * Es `async` aunque la rama sin comunidad no espere nada, para que el
 * `.then()` que fija el estado no corra de forma síncrona dentro del efecto.
 */
async function leerTodos(comunidadId: string): Promise<CommunityEvent[]> {
  if (!comunidadId) return SIN_EVENTOS;
  return leerEventos(crearClienteNavegador(), comunidadId);
}

/**
 * Eventos DE LA ACADEMIA, del más próximo al más lejano.
 *
 * Hubo aquí una capa por curso — fósil de cuando los eventos colgaban de cada
 * módulo. Al subirlos a la comunidad, esta capa siguió pasando ids de CURSO a
 * `leerEventos`, que filtra por `comunidad_id`: ninguna pantalla volvió a ver
 * un evento, sin un solo error. La capa sobra: los eventos son pocos por
 * naturaleza y se traen enteros de una vez.
 */
export function useEvents(
  comunidadId: string
): { eventos: CommunityEvent[]; recargar: () => Promise<void> } {
  const [eventos, setEventos] = useState<CommunityEvent[]>(SIN_EVENTOS);

  useEffect(() => {
    let vivo = true;
    void leerTodos(comunidadId).then((lista) => {
      if (vivo) setEventos(lista);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId]);

  const recargar = useCallback(async () => {
    setEventos(await leerTodos(comunidadId));
  }, [comunidadId]);

  return { eventos, recargar };
}
