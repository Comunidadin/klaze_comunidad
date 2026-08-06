"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { leerEventos } from "@/lib/supabase/eventos";
import { cursosDeComunidad } from "@/lib/hooks/use-courses";
import type { CommunityEvent } from "@/lib/types";

/** Referencia estable: un `[]` nuevo por render relanzaría el efecto en bucle. */
const SIN_EVENTOS: CommunityEvent[] = [];

/**
 * Es `async` aunque la rama sin cursos no espere nada, para que el `.then()`
 * que fija el estado no corra de forma síncrona dentro del efecto.
 */
async function leerTodos(claveCursos: string): Promise<CommunityEvent[]> {
  const ids = claveCursos ? claveCursos.split(",") : [];
  if (ids.length === 0) return SIN_EVENTOS;

  const supabase = crearClienteNavegador();
  const porCurso = await Promise.all(ids.map((id) => leerEventos(supabase, id)));

  return porCurso
    .flat()
    .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
}

/**
 * Eventos de un curso o, sin `cursoId`, de toda la academia — que es lo que
 * muestra `/admin/eventos`.
 *
 * Los eventos son pocos por naturaleza (unos cuantos al mes), así que se traen
 * enteros: paginar aquí sería complejidad sin beneficio, al revés que en el
 * feed.
 */
export function useEvents(
  comunidadId: string,
  cursoId?: string
): { eventos: CommunityEvent[]; recargar: () => Promise<void> } {
  const armazon = useAppStore((s) => s.armazon);
  const [eventos, setEventos] = useState<CommunityEvent[]>(SIN_EVENTOS);

  const cursos = cursosDeComunidad(comunidadId, armazon?.cursos ?? []);
  const cursoIds = !comunidadId ? [] : cursoId ? [cursoId] : cursos.map((c) => c.id);
  // Clave estable: el array se recrea en cada render y depender de él
  // relanzaría la carga sin parar.
  const claveCursos = cursoIds.join(",");

  useEffect(() => {
    let vivo = true;
    void leerTodos(claveCursos).then((lista) => {
      if (vivo) setEventos(lista);
    });
    return () => {
      vivo = false;
    };
  }, [claveCursos]);

  const recargar = useCallback(async () => {
    setEventos(await leerTodos(claveCursos));
  }, [claveCursos]);

  return { eventos, recargar };
}
