// Sistema de niveles por puntos.
//
// Los puntos los otorga un disparador de Postgres (10 por leccion completada,
// ver `ajustar_puntos`); el nivel se deriva aqui, al leer. La base guarda un
// solo numero y esta tabla decide que significa, asi que mover un umbral no
// obliga a recalcular nada.

const NIVEL_UMBRALES = [0, 20, 65, 155, 315, 515, 815, 1215, 1715];

/** Nivel (1..9) correspondiente a una cantidad de puntos. */
export function nivelPorPuntos(puntos: number): number {
  let nivel = 1;
  for (let i = 0; i < NIVEL_UMBRALES.length; i++) {
    if (puntos >= NIVEL_UMBRALES[i]) nivel = i + 1;
  }
  return nivel;
}

/** Puntos mínimos requeridos para alcanzar `nivel` (1..9). */
export function puntosParaNivel(nivel: number): number {
  const idx = Math.min(Math.max(nivel, 1), NIVEL_UMBRALES.length) - 1;
  return NIVEL_UMBRALES[idx];
}

export const NIVEL_MAXIMO = NIVEL_UMBRALES.length;
