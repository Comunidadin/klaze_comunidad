"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  guardarPlantilla,
  listarPlantillas,
  restaurarPlantilla,
  type PlantillasGuardadas,
} from "@/lib/supabase/plantillas-correo";
import type { Plantilla, TipoPlantilla } from "@/lib/plantillas";

/**
 * Las plantillas de correo de una academia, para el editor del panel.
 *
 * Devuelve solo las **guardadas**: el editor decide qué enseñar en los huecos
 * (el texto por defecto) y así puede distinguir "no la ha tocado" de "la ha
 * dejado igual que la original", que es lo que dice si el botón de restaurar
 * tiene algo que hacer.
 */
export function usePlantillas(comunidadId: string) {
  const [guardadas, setGuardadas] = useState<PlantillasGuardadas>({});
  const [cargando, setCargando] = useState(true);

  // Devuelve en vez de fijar, y la rama sin comunidad tampoco fija: el estado
  // se pone siempre en el `.then()`. Es el patrón del proyecto —ver `useFeed`—
  // y lo exige la regla de React 19 contra el `setState` síncrono en un efecto.
  const leer = useCallback(async (): Promise<PlantillasGuardadas> => {
    if (!comunidadId) return {};
    return listarPlantillas(crearClienteNavegador(), comunidadId);
  }, [comunidadId]);

  const recargar = useCallback(
    () =>
      leer()
        .then(setGuardadas)
        .catch(() => setGuardadas({}))
        .finally(() => setCargando(false)),
    [leer]
  );

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const guardar = useCallback(
    async (tipo: TipoPlantilla, plantilla: Plantilla) => {
      await guardarPlantilla(crearClienteNavegador(), comunidadId, tipo, plantilla);
      await recargar();
    },
    [comunidadId, recargar]
  );

  const restaurar = useCallback(
    async (tipo: TipoPlantilla) => {
      await restaurarPlantilla(crearClienteNavegador(), comunidadId, tipo);
      await recargar();
    },
    [comunidadId, recargar]
  );

  return { guardadas, cargando, guardar, restaurar };
}
