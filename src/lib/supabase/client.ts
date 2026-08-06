"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  exigirConfiguracion,
} from "@/lib/supabase/env";

/**
 * Cliente de Supabase para componentes de navegador.
 *
 * En este proyecto es el cliente principal: 93 de los 111 componentes son
 * `"use client"`, así que la app consulta la base directamente y el
 * aislamiento entre empresas lo garantizan las políticas RLS del esquema,
 * no una capa de API intermedia.
 *
 * `createBrowserClient` devuelve la misma instancia en llamadas sucesivas
 * dentro de la misma pestaña, así que se puede invocar desde cualquier
 * componente sin memorizar el resultado ni pasarlo por contexto.
 */
export function crearClienteNavegador() {
  exigirConfiguracion();
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
