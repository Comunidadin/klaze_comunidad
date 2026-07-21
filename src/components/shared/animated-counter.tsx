"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedCounterProps {
  /** Valor final. Cada cambio (p. ej. al cambiar de tab de periodo) reinicia la animación desde 0. */
  value: number;
  duration?: number;
  className?: string;
}

/**
 * Contador que anima de 0 al valor final con `framer-motion` (`animate`
 * imperativo sobre un `<span>`, sin re-render de React en cada frame).
 * Se re-dispara en cada cambio de `value` — útil para el ranking, donde
 * cambiar de periodo (7d/30d/total) debe "recontar" los puntos.
 */
export function AnimatedCounter({ value, duration = 0.7, className }: AnimatedCounterProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate(latest) {
        el.textContent = Math.round(latest).toLocaleString("es");
      },
    });

    return () => controls.stop();
  }, [value, duration]);

  return (
    <span ref={spanRef} className={cn("tabular-nums", className)}>
      0
    </span>
  );
}
