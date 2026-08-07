"use client";

import { createContext, useContext } from "react";
import type { MarcaAuth } from "@/lib/hooks/use-marca-auth";

const SIN_MARCA: MarcaAuth = { portada: {} };

/**
 * La marca de la academia por cuya puerta se está entrando.
 *
 * Existe para no consultarla dos veces: el panel del vídeo la necesita en el
 * layout y el logo la necesita en la tarjeta del formulario, y son ramas
 * distintas del árbol.
 *
 * Sin academia en la URL, queda vacía y todo cae a la marca de Klaze.
 */
export const MarcaAuthContext = createContext<MarcaAuth>(SIN_MARCA);

export function useMarcaDeLaEntrada(): MarcaAuth {
  return useContext(MarcaAuthContext);
}
