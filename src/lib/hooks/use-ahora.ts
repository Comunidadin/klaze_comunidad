"use client";

import { useSyncExternalStore } from "react";

// `cached` es el "ahora" resuelto, guardado a nivel de módulo. `getSnapshot`
// solo lo lee (nunca llama `Date.now()` directamente) para cumplir la regla
// de pureza de render de React: si `getSnapshot` devolviera un valor nuevo
// en cada llamada (como haría `Date.now()` sin cachear), React detecta
// "the result of getSnapshot should be cached" y tira un loop infinito.
// El valor real solo se escribe desde `actualizar`, invocada por
// `subscribe` — que React llama desde un efecto, no durante el render — y
// se refresca cada 30s, suficiente para comparaciones de "próximo evento"
// o "posts de esta semana" donde un desfase de segundos es imperceptible.
let cached = 0;
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function actualizar(): void {
  cached = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (intervalId === null) {
    actualizar();
    intervalId = setInterval(actualizar, 30_000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return cached;
}

function getServerSnapshot(): number {
  // En el server no conocemos la hora real: 0 hace que todo se trate como
  // "próximo"/"reciente" hasta que `subscribe` resuelva el valor real justo
  // después de montar en el cliente (mismo patrón que `useMounted` en
  // theme-toggle.tsx).
  return 0;
}

/** Marca de tiempo "ahora", resuelta de forma segura para SSR/hidratación. */
export function useAhora(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
