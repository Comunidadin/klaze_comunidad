"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  leerPlataforma,
  type AcademiaPlataforma,
  type CreadorPlataforma,
  type DatosPlataforma,
} from "@/lib/supabase/plataforma";
import type { Plan } from "@/lib/types";

export type { AcademiaPlataforma, CreadorPlataforma };

export interface PlatformMetricas {
  academiasActivas: number;
  creadores: number;
  alumnos: number;
}

export interface UsePlatformResult {
  academias: AcademiaPlataforma[];
  creadores: CreadorPlataforma[];
  planes: Plan[];
  metricas: PlatformMetricas;
  cargando: boolean;
  recargar: () => Promise<void>;
}

/** Referencia estable: un objeto nuevo por render relanzaría el efecto en bucle. */
const VACIO: DatosPlataforma = { academias: [], creadores: [], planes: [] };

/**
 * Puerta única de datos de `/plataforma`.
 *
 * Ya no hay MRR ni gráfico de crecimiento: los dos eran inventados, y un número
 * falso en un panel de control acaba creyéndose. Quedan tres cuentas reales.
 */
export function usePlatform(): UsePlatformResult {
  const [datos, setDatos] = useState<DatosPlataforma>(VACIO);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setDatos(await leerPlataforma(crearClienteNavegador()));
  }, []);

  useEffect(() => {
    let vivo = true;
    void leerPlataforma(crearClienteNavegador())
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const metricas: PlatformMetricas = {
    academiasActivas: datos.academias.filter((a) => a.comunidad.estado === "activa")
      .length,
    creadores: datos.creadores.length,
    // Suma de inscripciones de todas las academias. Una misma persona en dos
    // academias cuenta dos veces, y es lo que se quiere saber: son dos plazas.
    alumnos: datos.academias.reduce((acc, a) => acc + a.miembros, 0),
  };

  return { ...datos, metricas, cargando, recargar };
}
