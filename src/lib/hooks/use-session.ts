"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { useAppStore } from "@/lib/store";
import type { User } from "@/lib/types";

/**
 * `true` cuando ya sabemos quién eres —o que no eres nadie— y, si hay sesión,
 * tus datos han llegado del servidor.
 *
 * Antes significaba "el store terminó de leer localStorage". Cambia de
 * significado pero **no de firma**, y por eso los 24 archivos que ya lo
 * consultan (incluidos los 4 layouts de grupo, que gobiernan el acceso a
 * todas las áreas) siguen esperando correctamente sin tocar una línea. Es la
 * pieza que abarata toda esta migración.
 *
 * Sigue disparando la rehidratación del store, que conserva el estado de
 * interfaz (tema, espacios vistos) aunque ya no guarde la sesión.
 */
export function useHydrated(): boolean {
  const [listo, setListo] = useState(false);
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);

  useEffect(() => {
    let vivo = true;
    void useAppStore.persist.rehydrate();
    const supabase = crearClienteNavegador();

    async function sincronizar() {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;

      if (!data.session) {
        establecerArmazon(null);
        setListo(true);
        return;
      }

      try {
        const armazon = await cargarArmazon(supabase);
        if (vivo) establecerArmazon(armazon);
      } catch {
        // Sesión válida pero datos ilegibles (p. ej. la academia fue
        // suspendida). Se trata como "sin sesión" para que los layouts
        // redirijan al login en vez de dejar una pantalla a medias.
        if (vivo) establecerArmazon(null);
      } finally {
        if (vivo) setListo(true);
      }
    }

    void sincronizar();

    // Sin esto, tras abrir el enlace del correo la app se quedaría con los
    // datos (vacíos) de antes hasta que alguien recargue a mano.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void sincronizar();
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [establecerArmazon]);

  return listo;
}

export interface UseSessionResult {
  user: User | null;
  /**
   * Envía el enlace de acceso al correo. **No inicia sesión**: eso ocurre
   * cuando la persona abre el enlace. Por eso ya no se llama `login()` — ese
   * nombre prometía algo que este método no hace.
   */
  enviarEnlace: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

/**
 * `user === null` significa "no hay sesión" O "todavía no llegaron los datos".
 * Las pantallas no necesitan distinguir: para eso está `useHydrated`.
 */
export function useSession(): UseSessionResult {
  const armazon = useAppStore((s) => s.armazon);

  const enviarEnlace = useCallback(async (email: string) => {
    const supabase = crearClienteNavegador();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await crearClienteNavegador().auth.signOut();
  }, []);

  return { user: armazon?.perfil ?? null, enviarEnlace, logout };
}
