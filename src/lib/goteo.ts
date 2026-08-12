/**
 * Cuándo se abre un módulo, y cómo se dice.
 *
 * Lógica pura y en su propio archivo, como `slug.ts`: se prueba sin base de
 * datos y sin React, que es donde están los casos raros de verdad —el plazo que
 * se cumple justo ahora, el cambio de mes, la fecha ya pasada.
 *
 * **Nada de esto es el candado.** Quien decide es Postgres
 * (`privado.curso_disponible`). Si el reloj del alumno va adelantado y su
 * tarjeta dice que ya abrió, al entrar no habrá nada — y eso es correcto. Esta
 * fue la lección del candado por nivel, que vivía solo aquí y por eso no
 * protegía nada.
 *
 * `ahora` se recibe por parámetro en vez de leer el reloj dentro: así las
 * pruebas son deterministas y no dependen del día en que se ejecuten.
 */

export type GoteoModo = "ninguno" | "dias" | "fecha";

export interface ConfigGoteo {
  goteoModo: GoteoModo;
  /** Solo en modo `dias`: días desde que el alumno entró a la academia. */
  goteoDias: number | null;
  /** Solo en modo `fecha`, en ISO. */
  goteoDesde: string | null;
}

const UNA_HORA = 60 * 60 * 1000;
const UN_DIA = 24 * UNA_HORA;

/**
 * El instante en que se abre, o `null` si ya está abierto.
 *
 * Sin fecha de entrada en modo `dias` devuelve `null`, o sea abierto. No es
 * permisividad: no sabemos, y quien decide de verdad es la base. Pintar un
 * candado sin poder decir cuándo se levanta es peor que no pintarlo.
 */
export function fechaDeApertura(
  config: ConfigGoteo,
  entradaEl: string | null,
  ahora: Date
): Date | null {
  if (config.goteoModo === "fecha" && config.goteoDesde) {
    const abre = new Date(config.goteoDesde);
    return abre.getTime() <= ahora.getTime() ? null : abre;
  }

  if (config.goteoModo === "dias" && config.goteoDias && entradaEl) {
    const abre = new Date(new Date(entradaEl).getTime() + config.goteoDias * UN_DIA);
    // `<=` y no `<`: cumplido el instante exacto está abierto, igual que en el
    // resolver de Postgres. Con `<` la pantalla enseñaría "se abre en 0
    // minutos" sobre un módulo que la base ya está entregando.
    return abre.getTime() <= ahora.getTime() ? null : abre;
  }

  return null;
}

/**
 * «Se abre en 30 minutos», «Se abre en 3 horas», «Se abre el martes 19 de agosto».
 *
 * Se redondea hacia ARRIBA, y no al valor más cercano. Es una cuenta atrás
 * hacia algo que se abre: decirle a alguien «en 2 horas» cuando faltan 2h30m
 * hace que vuelva a las dos horas y se encuentre la puerta cerrada. Al revés
 * —«en 3 horas» cuando faltan 2h30m— vuelve tarde y ya está abierto, que no le
 * cuesta nada a nadie. Nunca prometer antes de tiempo.
 *
 * No hay un tramo de «mañana», y se quitó a propósito. Decidir qué es mañana
 * exige o bien un umbral en horas —y algo a 36 horas no es mañana, es pasado—
 * o bien comparar días de calendario, que depende de la zona horaria de quien
 * ejecute: la misma prueba pasaría en Quito y fallaría en Samoa. Con tres
 * tramos por tiempo transcurrido no hay ambigüedad, y «el jueves 14 de agosto»
 * dice lo mismo que «mañana» y además dice cuál.
 *
 * Si el instante ya pasó lo dice y pide recargar: quien llega aquí con una
 * fecha vencida tiene el armazón viejo, y la base ya le está entregando el
 * contenido.
 */
export function textoDeApertura(abreEl: Date, ahora: Date): string {
  const falta = abreEl.getTime() - ahora.getTime();

  // Ya pasó el momento. Ocurre de verdad: el instante de apertura se calcula
  // una vez y la tarjeta se repinta con la hora actual, así que a quien deja
  // la pestaña abierta esperando se le cumple el plazo sin que nada se
  // recalcule. Sin esta línea vería «Se abre en 1 minuto» para siempre —
  // justo la persona que más pendiente está.
  if (falta <= 0) return "Ya está abierto — recarga la página";

  if (falta < UNA_HORA) {
    const minutos = Math.max(1, Math.ceil(falta / 60_000));
    return `Se abre en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  }

  if (falta < UN_DIA) {
    const horas = Math.ceil(falta / UNA_HORA);
    return `Se abre en ${horas} ${horas === 1 ? "hora" : "horas"}`;
  }

  return `Se abre el ${fechaLarga(abreEl)}`;
}

/** Lo que ve el creador en la lista de módulos, o `null` si no hay goteo. */
export function notaDeGoteo(config: ConfigGoteo): string | null {
  if (config.goteoModo === "dias" && config.goteoDias) {
    return config.goteoDias === 1
      ? "Se abre al día siguiente"
      : `Se abre a los ${config.goteoDias} días`;
  }
  if (config.goteoModo === "fecha" && config.goteoDesde) {
    return `Se abre el ${fechaLarga(new Date(config.goteoDesde))}`;
  }
  return null;
}

function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
}
