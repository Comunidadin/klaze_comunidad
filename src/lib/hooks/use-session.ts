"use client";

import { useEffect, useSyncExternalStore } from "react";
import { aplicarPerfilOverride, useAppStore } from "@/lib/store";
import { mockUsers } from "@/lib/mocks/users";
import type { User } from "@/lib/types";

function subscribeHydration(onChange: () => void): () => void {
  return useAppStore.persist.onFinishHydration(onChange);
}

function getHydratedSnapshot(): boolean {
  return useAppStore.persist.hasHydrated();
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

/**
 * El store usa `skipHydration` para evitar mismatches SSR/localStorage.
 * Este hook dispara la rehidratación en el cliente (efecto, sin setState
 * directo) y expone el estado de hidratación vía useSyncExternalStore.
 * Mientras `hydrated` es false, cualquier hook que lea estado persistido
 * debe comportarse como si no hubiera sesión (currentUserId === null).
 */
export function useHydrated(): boolean {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  );

  useEffect(() => {
    useAppStore.persist.rehydrate();
  }, []);

  return hydrated;
}

export interface UseSessionResult {
  user: User | null;
  login: (email: string) => boolean;
  logout: () => void;
}

/**
 * Sesión simulada. `user === null` significa "no hay sesión" O "todavía no
 * se hidrató en el cliente" — las pantallas no necesitan distinguir ambos
 * casos, solo esperar a que `user` deje de ser null para renderizar UI
 * dependiente de sesión.
 */
export function useSession(): UseSessionResult {
  const hydrated = useHydrated();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const usuariosCreados = useAppStore((s) => s.usuariosCreados);
  const perfilOverrides = useAppStore((s) => s.perfilOverrides);
  const login = useAppStore((s) => s.login);
  const logout = useAppStore((s) => s.logout);

  if (!hydrated || !currentUserId) {
    return { user: null, login, logout };
  }

  const base =
    mockUsers.find((u) => u.id === currentUserId) ??
    usuariosCreados.find((u) => u.id === currentUserId) ??
    null;

  const user = base ? aplicarPerfilOverride(base, perfilOverrides) : null;

  return { user, login, logout };
}
