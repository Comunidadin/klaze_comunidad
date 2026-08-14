/**
 * La paleta de una academia, derivada de su color de acento.
 *
 * Regla de oro (spec 2026-08-14): el hex del creador NUNCA entra tal cual a un
 * token que lleve texto encima. Se conserva su TONO; la luminosidad la pone la
 * tabla de `globals.css`, que ya pasa AA — y si un tono concreto no llega (la
 * L de OKLCH es perceptual, no la luminancia WCAG: un amarillo a L 0.52 es más
 * luminoso que un azul a L 0.52), se ajusta en pasos de 0.01 hasta pasar. El
 * croma es `min(el suyo, el de la tabla)`: un neón se recorta, un tono
 * empolvado conserva lo apagado, que también es su marca. Un gris queda gris.
 *
 * Matemática OKLCH de Björn Ottosson, a mano: son ~40 líneas, y meter una
 * dependencia de color para esto es más superficie que valor. La prueba de los
 * 360 tonos (`tests/color-academia.test.ts`) es quien la vigila.
 *
 * Es lógica pura sin imports: corre igual en el servidor (los layouts que
 * inyectan el `<style>`) y en el navegador (el preview de Configuración).
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export interface TonosTema {
  primary: string;
  brand: string;
  charts: [string, string, string, string, string];
}

export interface PaletaAcademia {
  claro: TonosTema;
  oscuro: TonosTema;
}

/* --- sRGB ↔ OKLab --------------------------------------------------------- */

function srgbALineal(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linealASrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function linealAOklch(r: number, g: number, b: number): Oklch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

/** rgb LINEAL, puede salirse de [0,1]: quien llama decide qué hacer con eso. */
function oklchALineal({ l, c, h }: Oklch): { r: number; g: number; b: number } {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  return {
    r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  };
}

function enGamut(rgb: { r: number; g: number; b: number }): boolean {
  const e = 1e-6;
  return (
    rgb.r >= -e && rgb.r <= 1 + e && rgb.g >= -e && rgb.g <= 1 + e && rgb.b >= -e && rgb.b <= 1 + e
  );
}

/** Reduce el croma hasta caber en sRGB. La luz apenas cambia; el color, poco. */
function alGamut(color: Oklch): Oklch {
  let c = color.c;
  while (c > 0 && !enGamut(oklchALineal({ ...color, c }))) c -= 0.005;
  return { ...color, c: Math.max(0, c) };
}

/* --- API pública de conversión -------------------------------------------- */

export function hexAOklch(hex: string): Oklch | null {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
  if (!m) return null;
  let v = m[1];
  if (v.length === 3) v = v.split("").map((ch) => ch + ch).join("");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  return linealAOklch(srgbALineal(r), srgbALineal(g), srgbALineal(b));
}

export function oklchAHex(l: number, c: number, h: number): string {
  const rgb = oklchALineal(alGamut({ l, c, h }));
  const canal = (x: number) =>
    Math.round(Math.min(1, Math.max(0, linealASrgb(Math.min(1, Math.max(0, x))))) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${canal(rgb.r)}${canal(rgb.g)}${canal(rgb.b)}`;
}

/** Luminancia relativa WCAG, desde el rgb lineal recortado a [0,1]. */
function luminancia(color: Oklch): number {
  const rgb = oklchALineal(alGamut(color));
  const cl = (x: number) => Math.min(1, Math.max(0, x));
  return 0.2126 * cl(rgb.r) + 0.7152 * cl(rgb.g) + 0.0722 * cl(rgb.b);
}

function ratioLum(a: number, b: number): number {
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function contrasteHex(a: string, b: string): number {
  const oa = hexAOklch(a);
  const ob = hexAOklch(b);
  if (!oa || !ob) return 0;
  return ratioLum(luminancia(oa), luminancia(ob));
}

/* --- Derivación ------------------------------------------------------------ */

/**
 * Parte de la L de la tabla y la mueve en `dir` (±0.01) hasta que el color
 * pasa 4.5:1 contra TODOS los `contra`. El tope de iteraciones evita bucles
 * con exigencias imposibles — no debería alcanzarse nunca, y la prueba de los
 * 360 tonos es quien lo garantiza, no este comentario.
 */
function conContraste(base: Oklch, contra: Oklch[], dir: 1 | -1): Oklch {
  let { l } = base;
  for (let i = 0; i < 90; i++) {
    const color = alGamut({ ...base, l });
    const lum = luminancia(color);
    if (contra.every((n) => ratioLum(lum, luminancia(n)) >= 4.5)) return color;
    l += dir * 0.01;
    if (l <= 0.03 || l >= 0.99) break;
  }
  return alGamut({ ...base, l });
}

// Los neutros de globals.css que llevan texto o fondo bajo estos tokens.
const FG_BLANCO: Oklch = { l: 0.99, c: 0, h: 0 };
const FONDO_CLARO: Oklch = { l: 0.985, c: 0.002, h: 235 };
const BRAND_FG_CLARO: Oklch = { l: 0.18, c: 0.02, h: 235 };
const FG_OSCURO: Oklch = { l: 0.16, c: 0.02, h: 235 };
const FONDO_OSCURO: Oklch = { l: 0.17, c: 0.012, h: 235 };

// La escalera de las gráficas, tal cual está en globals.css.
const CHARTS_CLARO: [number, number][] = [
  [0.699, 0.147],
  [0.6, 0.13],
  [0.5, 0.11],
  [0.4, 0.09],
  [0.32, 0.07],
];
const CHARTS_OSCURO: [number, number][] = [
  [0.75, 0.14],
  [0.66, 0.13],
  [0.57, 0.12],
  [0.48, 0.1],
  [0.39, 0.08],
];

function css({ l, c, h }: Oklch): string {
  const n = (x: number, d: number) => Number(x.toFixed(d)).toString();
  return `oklch(${n(l, 3)} ${n(c, 3)} ${n(h, 1)})`;
}

export function paletaDeAcademia(hex: string): PaletaAcademia | null {
  const suyo = hexAOklch(hex);
  if (!suyo) return null;
  const { h } = suyo;
  const croma = (tabla: number) => Math.min(suyo.c, tabla);

  // --primary claro (tabla: 0.52/0.147) se lee con blanco encima Y como texto
  // sobre el fondo claro → si no llega, se OSCURECE. El oscuro (0.72/0.14) se
  // lee con el texto oscuro y sobre el fondo oscuro → se ACLARA. --brand lleva
  // su foreground casi negro en los dos temas → se aclara.
  const primaryClaro = conContraste({ l: 0.52, c: croma(0.147), h }, [FG_BLANCO, FONDO_CLARO], -1);
  const primaryOscuro = conContraste({ l: 0.72, c: croma(0.14), h }, [FG_OSCURO, FONDO_OSCURO], 1);
  const brandClaro = conContraste({ l: 0.699, c: croma(0.147), h }, [BRAND_FG_CLARO], 1);
  const brandOscuro = conContraste({ l: 0.699, c: croma(0.147), h }, [FG_OSCURO], 1);

  const charts = (tabla: [number, number][]) =>
    tabla.map(([l, c]) => css(alGamut({ l, c: croma(c), h }))) as TonosTema["charts"];

  return {
    claro: { primary: css(primaryClaro), brand: css(brandClaro), charts: charts(CHARTS_CLARO) },
    oscuro: { primary: css(primaryOscuro), brand: css(brandOscuro), charts: charts(CHARTS_OSCURO) },
  };
}

/**
 * El `<style>` que impone la paleta. Espeja la estructura de selectores de
 * `globals.css` (`:root, .light` / `.dark`) a propósito: el panel claro de
 * `(auth)` fuerza `.light` en un subárbol, y un `:root` a secas perdería
 * contra esa redefinición — el botón de entrar volvería a salir cian.
 *
 * Tokens que NO emite, también a propósito: `--accent` (hover neutro de
 * shadcn; teñirlo repite el error ya corregido de los menús coloreados) y los
 * `--*-foreground` (siguen valiendo porque la luminosidad del relleno no se
 * aparta de la tabla).
 */
export function estiloDeAcademia(hex: string): string {
  const p = paletaDeAcademia(hex);
  if (!p) return "";

  const bloque = (t: TonosTema) =>
    [
      `--primary: ${t.primary};`,
      `--ring: ${t.primary};`,
      `--brand: ${t.brand};`,
      `--sidebar-primary: ${t.primary};`,
      `--sidebar-ring: ${t.primary};`,
      ...t.charts.map((c, i) => `--chart-${i + 1}: ${c};`),
    ].join(" ");

  return `:root, .light { ${bloque(p.claro)} }\n.dark { ${bloque(p.oscuro)} }`;
}
