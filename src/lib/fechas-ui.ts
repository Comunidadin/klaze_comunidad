// Tiempo relativo para UI en vivo (feed, comentarios). A diferencia de
// `src/lib/mocks/fechas.ts` (que siembra datos de forma determinística
// contra una fecha base fija), acá SÍ usamos `Date.now()` a propósito: es
// texto de interfaz en tiempo real ("hace 2 h"), no un seed que deba ser
// estable entre renders/tests.

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;
const SEMANA_MS = 7 * DIA_MS;
const MES_MS = 30 * DIA_MS;

/**
 * "hace 2 días" / "hace 3 h" / "ahora" — tiempo transcurrido desde `iso`
 * hasta este momento, en español, sin librería externa. Fechas futuras (o
 * relojes ligeramente desincronizados) se tratan como "ahora" en vez de
 * mostrar un valor negativo.
 */
export function tiempoRelativo(iso: string): string {
  const transcurridoMs = Math.max(0, Date.now() - new Date(iso).getTime());

  if (transcurridoMs < MINUTO_MS) return "ahora";

  if (transcurridoMs < HORA_MS) {
    const minutos = Math.floor(transcurridoMs / MINUTO_MS);
    return `hace ${minutos} min`;
  }

  if (transcurridoMs < DIA_MS) {
    const horas = Math.floor(transcurridoMs / HORA_MS);
    return `hace ${horas} h`;
  }

  if (transcurridoMs < SEMANA_MS) {
    const dias = Math.floor(transcurridoMs / DIA_MS);
    return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  }

  if (transcurridoMs < MES_MS) {
    const semanas = Math.floor(transcurridoMs / SEMANA_MS);
    return `hace ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }

  const meses = Math.floor(transcurridoMs / MES_MS);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
}
