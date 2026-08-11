"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { leerSecciones } from "@/lib/supabase/espacios";
import type { CommunitySection, CommunitySpace } from "@/lib/types";

export type EspacioConNoLeidos = CommunitySpace & { noLeidos: number };

export type SeccionConEspacios = Omit<CommunitySection, "espacios"> & {
  espacios: EspacioConNoLeidos[];
};

/**
 * Cuántas publicaciones recientes se miran para contar no leídos.
 *
 * Se acota a propósito: la insignia solo necesita decir "hay cosas nuevas", y
 * traer el histórico entero de un curso activo para pintar un número sería caro
 * para lo que aporta. A quien tenga más de 200 sin leer, el número exacto ya no
 * le dice nada.
 */
const MAX_RECIENTES = 200;

interface Reciente {
  espacioId: string;
  creadoEl: string;
}

const SIN_DATOS: { secciones: CommunitySection[]; recientes: Reciente[] } = {
  secciones: [],
  recientes: [],
};

/**
 * Es `async` aunque la rama sin academia no espere nada, para que el `.then()`
 * que fija el estado no corra de forma síncrona dentro del efecto.
 */
async function leerDatos(
  comunidadId: string | undefined
): Promise<{ secciones: CommunitySection[]; recientes: Reciente[] }> {
  if (!comunidadId) return SIN_DATOS;

  const supabase = crearClienteNavegador();
  const [secciones, { data }] = await Promise.all([
    leerSecciones(supabase, comunidadId),
    supabase
      .from("publicaciones")
      .select("espacio_id, creado_el")
      .eq("comunidad_id", comunidadId)
      .order("creado_el", { ascending: false })
      .limit(MAX_RECIENTES),
  ]);

  const recientes = ((data ?? []) as { espacio_id: string; creado_el: string }[]).map(
    (p) => ({ espacioId: p.espacio_id, creadoEl: p.creado_el })
  );

  return { secciones, recientes };
}

/**
 * Espacios de la academia, con cuántas publicaciones sin leer tiene cada uno.
 *
 * "Visto" sigue viviendo en el navegador (`espaciosVistos` del store), y es
 * deliberado: es una preferencia de lectura de ESTE dispositivo, no un dato de
 * la academia. Guardarlo en la base obligaría a decidir qué pasa cuando alguien
 * lee en el móvil y luego abre el portátil, y esa complejidad no compra nada.
 */
export function useEspacios(comunidadId: string): { secciones: SeccionConEspacios[] } {
  const espaciosVistos = useAppStore((s) => s.espaciosVistos);
  const [datos, setDatos] = useState(SIN_DATOS);

  useEffect(() => {
    let vivo = true;
    void leerDatos(comunidadId).then((d) => {
      if (vivo) setDatos(d);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId]);

  return useMemo(() => {
    const secciones: SeccionConEspacios[] = datos.secciones
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((seccion) => ({
        ...seccion,
        espacios: seccion.espacios
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((espacio) => {
            const vistoEl = espaciosVistos[espacio.id];
            const noLeidos = datos.recientes.filter((p) => {
              if (p.espacioId !== espacio.id) return false;
              if (!vistoEl) return true;
              return new Date(p.creadoEl).getTime() > new Date(vistoEl).getTime();
            }).length;
            return { ...espacio, noLeidos };
          }),
      }));

    return { secciones };
  }, [datos, espaciosVistos]);
}
