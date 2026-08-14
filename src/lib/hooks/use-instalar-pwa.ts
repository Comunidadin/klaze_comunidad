"use client";

import { useEffect, useState } from "react";

/**
 * El botón de «Instalar la app», con las tres realidades del mercado:
 *
 * - **Android/Chrome**: el navegador dispara `beforeinstallprompt`; se
 *   guarda el evento y `instalar()` abre el diálogo nativo.
 * - **iPhone/iPad**: Apple no da API — `esIOS` le dice a la interfaz que
 *   enseñe los dos pasos (Compartir → Añadir a pantalla de inicio).
 * - **Ya instalada** (`display-mode: standalone`): no se ofrece nada.
 */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstalarPwa() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  // Perezosos y no en un efecto: son hechos del entorno, fijos durante toda
  // la sesión, y el patrón del proyecto prohíbe `setState` síncrono en
  // efectos (ver CLAUDE.md).
  const [instalada, setInstalada] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        // Safari viejo expone su propia bandera.
        Boolean((navigator as { standalone?: boolean }).standalone))
  );
  const [esIOS] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !/crios|fxios/i.test(navigator.userAgent)
  );

  useEffect(() => {
    // El registro vive aquí y no en el layout: solo el área de alumno es la
    // "app". Sin service worker, Chrome no considera instalable la página.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin SW no hay prompt nativo, pero la app sigue funcionando igual.
      });
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setEvento(e as EventoInstalacion);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function instalar(): Promise<boolean> {
    if (!evento) return false;
    await evento.prompt();
    const eleccion = await evento.userChoice;
    if (eleccion.outcome === "accepted") {
      setEvento(null);
      setInstalada(true);
      return true;
    }
    return false;
  }

  return {
    /** `true` si hay diálogo nativo listo (Android/Chrome/Edge). */
    puedeInstalar: evento !== null && !instalada,
    /** `true` en Safari de iPhone/iPad: la instalación es manual, con pasos. */
    esIOS: esIOS && !instalada,
    instalada,
    instalar,
  };
}
