// Helpers de fecha determinísticos para sembrar los mocks.
// Nunca usar Date.now() ni Math.random(): todo se deriva de una fecha base fija.

const BASE_DATE = new Date("2026-07-20T12:00:00.000Z");

/** ISO datetime de la fecha base menos `dias` días. Útil para "creadoEl". */
export function haceDias(dias: number): string {
  const fecha = new Date(BASE_DATE);
  fecha.setUTCDate(fecha.getUTCDate() - dias);
  return fecha.toISOString();
}

/** ISO datetime de la fecha base más `dias` días. Útil para eventos futuros. */
export function enDias(dias: number, horaUTC = 18): string {
  const fecha = new Date(BASE_DATE);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  fecha.setUTCHours(horaUTC, 0, 0, 0);
  return fecha.toISOString();
}
