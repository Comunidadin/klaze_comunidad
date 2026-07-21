"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function subscribeNoop(): () => void {
  return () => {};
}

function getMountedClient(): boolean {
  return true;
}

function getMountedServer(): boolean {
  return false;
}

/**
 * `true` solo después del primer render en el cliente. Igual que
 * `useHydrated` en `use-session.ts`: usa `useSyncExternalStore` en vez de
 * `useEffect` + `setState` para no violar la regla de lint
 * `react-hooks/set-state-in-effect`.
 */
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, getMountedClient, getMountedServer);
}

/**
 * Lógica compartida de cambio de tema. Se expone como hook para poder
 * reutilizarla tanto en el botón standalone de abajo como en un
 * `DropdownMenuItem` (ver `MemberShell`/`AdminShell`), evitando anidar un
 * `<button>` dentro de otro elemento interactivo.
 *
 * `mounted` evita el mismatch de hidratación: `resolvedTheme` no existe en
 * el primer render del servidor.
 */
export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const esOscuro = mounted && resolvedTheme === "dark";

  return {
    Icono: esOscuro ? Sun : Moon,
    etiqueta: esOscuro ? "Modo claro" : "Modo oscuro",
    toggle: () => setTheme(esOscuro ? "light" : "dark"),
    mounted,
  };
}

export interface ThemeToggleProps {
  className?: string;
}

/** Botón icono standalone para cambiar entre modo claro/oscuro. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { Icono, etiqueta, toggle } = useThemeToggle();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={etiqueta}
      className={cn(className)}
    >
      <Icono className="size-4" />
    </Button>
  );
}
