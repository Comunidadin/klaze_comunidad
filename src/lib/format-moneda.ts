// Formateo de montos en USD para el panel de plataforma (T15) — precios de
// plan y MRR simulado. `maximumFractionDigits: 0` a propósito: todos los
// precios del mock son enteros ($39/$99/$249), así que mostrar "$99.00"
// sería ruido; si algún día un plan tuviera centavos, se truncan (no es un
// dato financiero real, es un mock de negocio).
const FORMATO_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** "$99", "$12,400" — nunca decimales. Ver docstring de `FORMATO_USD`. */
export function formatUSD(valor: number): string {
  return FORMATO_USD.format(valor);
}
