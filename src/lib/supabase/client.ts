"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
 * La sesión se guarda en **localStorage, no en cookies** — a propósito y con
 * dos motivos:
 *
 * 1. Nada del servidor la lee: los Route Handlers reciben el token por la
 *    cabecera `Authorization`, y los Server Components solo usan la clave
 *    publicable. La cookie era equipaje sin dueño.
 * 2. Safari limita las cookies escritas por JavaScript a 7 días, y en la
 *    app instalada (PWA de iPhone) las trata aún peor: los alumnos tenían
 *    que INICIAR SESIÓN CADA VEZ. localStorage persiste en la app instalada.
 *
 * `flowType: "pkce"` se conserva del cliente anterior: los enlaces de correo
 * llegan con `?code=` y sin esto el canje automático de `/callback` se rompe.
 */
let instancia: SupabaseClient | null = null;

export function crearClienteNavegador(): SupabaseClient {
  exigirConfiguracion();
  if (!instancia) {
    instancia = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return instancia;
}
