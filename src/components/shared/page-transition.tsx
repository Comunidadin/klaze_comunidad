"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Transición de página sutil (fade + slide vertical corto, ~150ms) para los
 * `template.tsx` de `(miembro)`, `(creador)` y `(superadmin)` — Next remonta
 * `template.tsx` en cada navegación dentro del grupo, a diferencia de
 * `layout.tsx`, así que es el punto correcto para animar la transición.
 *
 * Respeta `prefers-reduced-motion`: si está activo, renderiza sin animación
 * (duración 0). El resto de usos de `framer-motion` en el proyecto (cards,
 * confetti, contadores animados, etc.) NO respeta esta preferencia — ver
 * limitación conocida en el README.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const prefiereMenosMovimiento = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefiereMenosMovimiento ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefiereMenosMovimiento ? 0 : 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
