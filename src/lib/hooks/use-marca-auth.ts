"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/env";
import type { Community } from "@/lib/types";

export type MarcaAuth = NonNullable<Community["marcaAuth"]>;

/**
 * Portada de la pantalla de entrada (mitad izquierda del login).
 *
 * Es el único hook que corre **sin sesión**, así que no puede leer el armazón:
 * consulta `marca_publica(slug)`, la función del esquema que devuelve solo
 * nombre, logo, color y portada de una comunidad activa. Devuelve un conjunto
 * fijo de columnas a propósito — no hay forma de pedirle el propietario, el
 * plan ni nada más.
 *
 * Sin `slug` no consulta nada y la pantalla cae en el degradado de la marca:
 * el `/login` global no pertenece a ninguna academia concreta.
 */
export function useMarcaAuth(slug?: string): MarcaAuth {
  const [marca, setMarca] = useState<MarcaAuth>({});

  useEffect(() => {
    if (!slug || !supabaseConfigurado) return;

    let vivo = true;
    void crearClienteNavegador()
      .rpc("marca_publica", { p_slug: slug })
      .then(({ data }) => {
        if (!vivo) return;
        const fila = data?.[0];
        if (fila) setMarca((fila.marca_auth as MarcaAuth) ?? {});
      });

    return () => {
      vivo = false;
    };
  }, [slug]);

  return marca;
}
