"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/env";
import type { Community } from "@/lib/types";

export type PortadaAuth = NonNullable<Community["marcaAuth"]>;

export interface MarcaAuth {
  /** Nombre de la academia, si la URL dice de cuál se trata. */
  nombre?: string;
  logoUrl?: string;
  colorAcento?: string;
  portada: PortadaAuth;
}

/** Referencia estable: un objeto nuevo por render relanzaría el efecto en bucle. */
const SIN_MARCA: MarcaAuth = { portada: {} };

/**
 * La marca de la pantalla de entrada.
 *
 * Es el único hook que corre **sin sesión**, así que no puede leer el armazón:
 * consulta `marca_publica(slug)`, la función del esquema que devuelve solo
 * nombre, logo, color y portada, y **solo de academias activas**. Devuelve un
 * conjunto fijo de columnas a propósito — no hay forma de pedirle el
 * propietario, el plan ni nada más.
 *
 * Sin `slug` no consulta nada y la pantalla queda con la marca de Klaze: el
 * `/login` pelado no pertenece a ninguna academia. Para que un alumno vea la
 * suya, el enlace tiene que ser `/login/{slug}`.
 */
async function leerMarca(slug?: string): Promise<MarcaAuth> {
  if (!slug || !supabaseConfigurado) return SIN_MARCA;

  const { data } = await crearClienteNavegador().rpc("marca_publica", {
    p_slug: slug,
  });

  const fila = data?.[0];
  // Slug inventado, o academia suspendida: se cae a la marca de Klaze en vez
  // de dejar la pantalla a medias.
  if (!fila) return SIN_MARCA;

  return {
    nombre: fila.nombre ?? undefined,
    logoUrl: fila.logo_url ?? undefined,
    colorAcento: fila.color_acento ?? undefined,
    portada: (fila.marca_auth as PortadaAuth) ?? {},
  };
}

export function useMarcaAuth(slug?: string): MarcaAuth {
  const [marca, setMarca] = useState<MarcaAuth>(SIN_MARCA);

  useEffect(() => {
    let vivo = true;

    // `async` aunque la rama sin slug no espere nada: el `.then()` que fija el
    // estado no debe correr de forma síncrona dentro del efecto (ver CLAUDE.md).
    void leerMarca(slug).then((m) => {
      if (vivo) setMarca(m);
    });

    return () => {
      vivo = false;
    };
  }, [slug]);

  return marca;
}
