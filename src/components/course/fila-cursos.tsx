"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilaCursosProps {
  titulo: string;
  /** Segunda línea, más pequeña — p. ej. qué hace falta para desbloquearlo. */
  subtitulo?: string;
  children: React.ReactNode;
  className?: string;
}

/** Cuánto avanza cada pulsación: casi una pantalla, dejando una tarjeta a la vista. */
const FRACCION_SALTO = 0.8;

/**
 * Una fila horizontal de tarjetas, con flechas — la estructura de Netflix y de
 * Hotmart Club.
 *
 * Las flechas **solo se pintan si hay algo que desplazar**, y se apagan al
 * llegar a un extremo. Una flecha que no hace nada enseña a ignorar las
 * flechas, y a partir de ahí las demás tampoco se usan.
 *
 * El desplazamiento es `overflow-x-auto` de verdad, no un `transform`: así
 * funciona el arrastre con el dedo, la rueda horizontal del trackpad y el
 * teclado, sin escribir nada para cada uno. Solo se oculta la barra.
 */
export function FilaCursos({ titulo, subtitulo, children, className }: FilaCursosProps) {
  const pista = useRef<HTMLDivElement>(null);
  const [puedeIzquierda, setPuedeIzquierda] = useState(false);
  const [puedeDerecha, setPuedeDerecha] = useState(false);

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    // El margen de 1px absorbe los redondeos a fracción de píxel de los
    // navegadores: sin él, la flecha derecha se queda encendida para siempre
    // al final de algunas filas.
    setPuedeIzquierda(el.scrollLeft > 1);
    setPuedeDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = pista.current;
    if (!el) return;

    medir();
    el.addEventListener("scroll", medir, { passive: true });

    // Al cambiar el ancho —girar el móvil, plegar la barra lateral— puede
    // dejar de haber nada que desplazar.
    const observador = new ResizeObserver(medir);
    observador.observe(el);

    return () => {
      el.removeEventListener("scroll", medir);
      observador.disconnect();
    };
  }, [medir, children]);

  function desplazar(direccion: -1 | 1) {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: direccion * el.clientWidth * FRACCION_SALTO, behavior: "smooth" });
  }

  const hayFlechas = puedeIzquierda || puedeDerecha;

  return (
    <section className={cn("space-y-2.5", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-base font-semibold text-foreground">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>
          )}
        </div>

        {/* Ocultas en móvil: ahí se arrastra, y ocupan sitio sin aportar. */}
        {hayFlechas && (
          <div className="hidden shrink-0 gap-1 sm:flex">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => desplazar(-1)}
              disabled={!puedeIzquierda}
              aria-label={`Ver anteriores de ${titulo}`}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => desplazar(1)}
              disabled={!puedeDerecha}
              aria-label={`Ver siguientes de ${titulo}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <div
        ref={pista}
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1",
          // Sin barra a la vista, pero el contenedor sigue siendo desplazable
          // con teclado y con el dedo.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {children}
      </div>
    </section>
  );
}
