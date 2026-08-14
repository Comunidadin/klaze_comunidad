import { expect, test } from "bun:test";
import {
  contrasteHex,
  estiloDeAcademia,
  hexAOklch,
  oklchAHex,
  paletaDeAcademia,
} from "../src/lib/color-academia";

/**
 * La paleta derivada del color de una academia.
 *
 * La prueba que importa es la de los 360 tonos: la promesa del diseño es que
 * NINGÚN color que elija un creador puede dejar su academia ilegible, y eso no
 * se garantiza revisando a ojo — se garantiza recorriendo el círculo entero y
 * midiendo el contraste WCAG de lo que la paleta emite.
 */

// Los neutros FIJOS de globals.css contra los que la paleta debe leerse.
const FG_BLANCO = oklchAHex(0.99, 0, 0); // --primary-foreground claro
const FONDO_CLARO = oklchAHex(0.985, 0.002, 235); // --background claro
const BRAND_FG_CLARO = oklchAHex(0.18, 0.02, 235);
const FG_OSCURO = oklchAHex(0.16, 0.02, 235); // --primary-foreground oscuro
const FONDO_OSCURO = oklchAHex(0.17, 0.012, 235); // --background oscuro

function oklchDeCss(valor: string): { l: number; c: number; h: number } {
  const m = valor.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/);
  if (!m) throw new Error(`No es un oklch: ${valor}`);
  return { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) };
}

function aHex(css: string): string {
  const { l, c, h } = oklchDeCss(css);
  return oklchAHex(l, c, h);
}

test("hexAOklch entiende #rrggbb y #rgb, y rechaza lo demás", () => {
  const cian = hexAOklch("#06ABEB");
  expect(cian).not.toBeNull();
  expect(cian!.h).toBeGreaterThan(200);
  expect(cian!.h).toBeLessThan(260);
  expect(hexAOklch("#fff")).not.toBeNull();
  expect(hexAOklch("")).toBeNull();
  expect(hexAOklch("rojo")).toBeNull();
  expect(hexAOklch("#12")).toBeNull();
});

test("los 360 tonos pasan AA en las dos direcciones y los dos temas", () => {
  for (let h = 0; h < 360; h++) {
    const entrada = oklchAHex(0.65, 0.2, h);
    const p = paletaDeAcademia(entrada);
    expect(p).not.toBeNull();

    const priClaro = aHex(p!.claro.primary);
    const priOscuro = aHex(p!.oscuro.primary);
    const brandClaro = aHex(p!.claro.brand);
    const brandOscuro = aHex(p!.oscuro.brand);

    // Relleno con su texto encima, y texto sobre el fondo del tema.
    expect(contrasteHex(priClaro, FG_BLANCO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(priClaro, FONDO_CLARO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(priOscuro, FG_OSCURO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(priOscuro, FONDO_OSCURO)).toBeGreaterThanOrEqual(4.5);
    // --brand solo se usa como relleno con --brand-foreground (CLAUDE.md).
    expect(contrasteHex(brandClaro, BRAND_FG_CLARO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(brandOscuro, FG_OSCURO)).toBeGreaterThanOrEqual(4.5);
  }
});

test("el tono del creador sobrevive a la derivación", () => {
  const p = paletaDeAcademia("#DC2626"); // un rojo
  const { h } = oklchDeCss(p!.claro.primary);
  const original = hexAOklch("#DC2626")!.h;
  expect(Math.abs(h - original)).toBeLessThan(1);
});

test("un gris se queda gris y un neón se recorta al techo de la tabla", () => {
  // El tono de un gris no significa nada: no se le inventa color.
  const gris = paletaDeAcademia("#808080");
  expect(oklchDeCss(gris!.claro.primary).c).toBeLessThanOrEqual(0.02);

  const neon = paletaDeAcademia("#FF0000");
  expect(oklchDeCss(neon!.claro.primary).c).toBeLessThanOrEqual(0.147);
});

test("estiloDeAcademia emite los dos bloques y nada prohibido", () => {
  const css = estiloDeAcademia("#DC2626");
  // Espeja los selectores de globals.css: un `:root` a secas perdería contra
  // la redefinición `.light` del panel de (auth).
  expect(css).toContain(":root, .light {");
  expect(css).toContain(".dark {");
  expect(css).toContain("--primary:");
  expect(css).toContain("--ring:");
  expect(css).toContain("--brand:");
  expect(css).toContain("--sidebar-primary:");
  expect(css).toContain("--chart-5:");
  // Teñir --accent es el error ya corregido de los menús que se coloreaban;
  // tocar los foreground rompería el contraste que la tabla garantiza.
  expect(css).not.toContain("--accent:");
  expect(css).not.toContain("--primary-foreground:");
  expect(css).not.toContain("--brand-foreground:");
});

test("con un hex inválido no sale CSS a medias: sale nada", () => {
  expect(estiloDeAcademia("")).toBe("");
  expect(estiloDeAcademia("#XYZ123")).toBe("");
});
