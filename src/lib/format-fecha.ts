// Formateo de fechas en español (es-ES) para toda la UI de miembro.
// Todas las funciones parten de un ISO datetime y usan la zona horaria del
// navegador (son componentes "use client", así que no hay riesgo de
// mismatch de hidratación SSR/cliente).

const FORMATO_DIA_GRUPO = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FORMATO_HORA = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});

const FORMATO_DIA_NUM = new Intl.DateTimeFormat("es-ES", { day: "2-digit" });
const FORMATO_MES_ABR = new Intl.DateTimeFormat("es-ES", { month: "short" });

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Jueves, 23 de julio" — encabezado de grupo del calendario. */
export function formatFechaGrupo(iso: string): string {
  return capitalizar(FORMATO_DIA_GRUPO.format(new Date(iso)));
}

/** "23 de julio de 2026" — fecha de ingreso en el perfil de un miembro. */
export function formatFechaLarga(iso: string): string {
  // Una fecha vacía o mal formada tumbaba la página entera con un
  // `RangeError` de `Intl`. Pasó de verdad: al suspender a un alumno, su
  // perfil dejaba de ser legible y llegaba una fecha vacía. Aquello se
  // arregló en la base, pero una fecha ausente nunca debe costar la pantalla.
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return FORMATO_FECHA_LARGA.format(fecha);
}

/** "19:00" */
export function formatHora(iso: string): string {
  return FORMATO_HORA.format(new Date(iso));
}

/** "23" — número de día para el bloque de fecha grande de `EventCard`. */
export function diaNumero(iso: string): string {
  return FORMATO_DIA_NUM.format(new Date(iso));
}

/** "jul" — mes abreviado para el bloque de fecha grande de `EventCard`. */
export function mesAbreviado(iso: string): string {
  return FORMATO_MES_ABR.format(new Date(iso)).replace(".", "");
}

/**
 * Clave de agrupación por día en la zona horaria local (no UTC): dos ISO
 * datetime caen en el mismo grupo si `new Date(iso)` cae en el mismo día
 * calendario para quien lo mira, igual que el encabezado que se muestra.
 */
export function claveDia(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
