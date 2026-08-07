"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const NUM_PARTICULAS = 40;
const DURACION_S = 1.1;

/**
 * Pseudo-aleatorio determinístico por índice (nunca `Math.random()` — el
 * mismo índice siempre produce el mismo valor, así que las partículas no
 * "saltan" entre renders ni difieren entre servidor/cliente).
 */
function seed(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

interface Particula {
  id: number;
  xVw: number;
  yVh: number;
  rotate: number;
  delay: number;
  color: string;
  width: number;
  height: number;
}

const PARTICULAS: Particula[] = Array.from({ length: NUM_PARTICULAS }, (_, i) => {
  const angulo = seed(i, 1) * Math.PI * 2;
  const distancia = 22 + seed(i, 2) * 40;
  return {
    id: i,
    xVw: Math.cos(angulo) * distancia,
    yVh: Math.sin(angulo) * distancia * 0.6 - 18,
    rotate: seed(i, 3) * 720 - 360,
    delay: seed(i, 4) * 0.25,
    // Alterna índigo (--primary) y lima (--accent), la pareja de acento de Comunidad del Intercambio.
    color: i % 2 === 0 ? "var(--primary)" : "var(--brand)",
    width: 5 + seed(i, 5) * 5,
    height: 8 + seed(i, 6) * 6,
  };
});

export interface ConfettiProps {
  /** Se dispara cuando termina la animación — úsalo para desmontar el componente desde el padre. */
  onDone?: () => void;
}

/**
 * Celebración de "módulo completado al 100%": ~40 partículas CSS que
 * explotan desde el centro y se desvanecen. Se autodestruye (retorna
 * `null`) al terminar su propia animación, además de avisar al padre vía
 * `onDone` para que también limpie su estado.
 */
export function Confetti({ onDone }: ConfettiProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        setVisible(false);
        onDone?.();
      },
      (DURACION_S + 0.3) * 1000
    );
    return () => clearTimeout(timeout);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {PARTICULAS.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-1/2 left-1/2 rounded-[2px]"
          style={{ width: p.width, height: p.height, backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: `${p.xVw}vw`, y: `${p.yVh}vh`, opacity: 0, rotate: p.rotate }}
          transition={{ duration: DURACION_S, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
