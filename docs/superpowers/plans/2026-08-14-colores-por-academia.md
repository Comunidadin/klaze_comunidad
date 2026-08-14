# Colores y pestaña por academia — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el color elegido en Configuración mande en toda el área del alumno y la entrada, con paleta derivada legible, y que la pestaña del navegador lleve el nombre y el logo de la academia.

**Architecture:** Una librería pura (`color-academia.ts`) convierte el hex del creador a OKLCH, conserva su tono, impone la luminosidad probada de `globals.css` (ajustándola por tono hasta pasar AA) y emite un `<style>` con `:root, .light { … }` y `.dark { … }`. Los layouts de servidor de `/c/[comunidad]`, `/login/[academia]` e `/invitacion/[token]` leen la marca por REST (`marca_publica` / `invitacion_publica`, sin sesión) y pintan ese `<style>` más `generateMetadata`.

**Tech Stack:** Next.js 16 App Router (Server Components), TypeScript, OKLCH a mano (sin dependencias), PostgREST por `fetch`, bun test.

**Spec:** `docs/superpowers/specs/2026-08-14-colores-por-academia-design.md`

## Global Constraints

- Copy en español; vocabulario UI: curso=módulo, modulo=submódulo, leccion=clase.
- `bun run build` y `bun run lint` limpios antes de cada commit de feature.
- No tocar `--accent`, `--primary-foreground`, `--brand-foreground`, fondos, bordes ni `--destructive`.
- `globals.css` no cambia: el `<style>` inyectado pisa por cascada.
- Nada de datos reales: pruebas puras o contra el escenario de test. Prohibido escribir en `mentoria-v7`.
- El panel del creador y `/plataforma` quedan con la marca Klaze.

---

### Task 1: `src/lib/color-academia.ts` — la paleta derivada, pura

**Files:**
- Create: `src/lib/color-academia.ts`
- Test: `tests/color-academia.test.ts`

**Interfaces:**
- Consumes: nada (lógica pura).
- Produces:
  - `hexAOklch(hex: string): {l,c,h} | null`
  - `oklchAHex(l: number, c: number, h: number): string` (con recorte de gamut)
  - `contrasteHex(a: string, b: string): number` (ratio WCAG)
  - `paletaDeAcademia(hex: string): PaletaAcademia | null`
  - `estiloDeAcademia(hex: string): string` (`""` si el hex no vale)

`PaletaAcademia`: `{ claro: TonosTema; oscuro: TonosTema }` con
`TonosTema = { primary: string; brand: string; charts: [string,string,string,string,string] }`
(cada valor un literal `oklch(L C H)`).

- [ ] **Step 1: prueba que falla**

```ts
// tests/color-academia.test.ts
import { expect, test } from "bun:test";
import {
  contrasteHex,
  estiloDeAcademia,
  hexAOklch,
  oklchAHex,
  paletaDeAcademia,
} from "../src/lib/color-academia";

// Los neutros FIJOS de globals.css contra los que la paleta debe leerse.
const FG_BLANCO = oklchAHex(0.99, 0, 0);          // --primary-foreground claro
const FONDO_CLARO = oklchAHex(0.985, 0.002, 235); // --background claro
const BRAND_FG_CLARO = oklchAHex(0.18, 0.02, 235);
const FG_OSCURO = oklchAHex(0.16, 0.02, 235);     // --primary-foreground oscuro
const FONDO_OSCURO = oklchAHex(0.17, 0.012, 235); // --background oscuro

function oklchDeCss(valor: string): { l: number; c: number; h: number } {
  const m = valor.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/);
  if (!m) throw new Error(`No es un oklch: ${valor}`);
  return { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) };
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

    const priClaro = oklchAHex(...valores(p!.claro.primary));
    const priOscuro = oklchAHex(...valores(p!.oscuro.primary));
    const brandClaro = oklchAHex(...valores(p!.claro.brand));
    const brandOscuro = oklchAHex(...valores(p!.oscuro.brand));

    // Relleno con su texto encima, y texto sobre el fondo del tema.
    expect(contrasteHex(priClaro, FG_BLANCO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(priClaro, FONDO_CLARO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(priOscuro, FG_OSCURO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(priOscuro, FONDO_OSCURO)).toBeGreaterThanOrEqual(4.5);
    // brand solo como relleno con brand-foreground (así lo manda CLAUDE.md).
    expect(contrasteHex(brandClaro, BRAND_FG_CLARO)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(brandOscuro, FG_OSCURO)).toBeGreaterThanOrEqual(4.5);
  }

  function valores(css: string): [number, number, number] {
    const { l, c, h } = oklchDeCss(css);
    return [l, c, h];
  }
});

test("el tono del creador sobrevive a la derivación", () => {
  const p = paletaDeAcademia("#DC2626"); // un rojo
  const { h } = oklchDeCss(p!.claro.primary);
  const original = hexAOklch("#DC2626")!.h;
  expect(Math.abs(h - original)).toBeLessThan(1);
});

test("un gris se queda gris y un neón se recorta al techo de la tabla", () => {
  const gris = paletaDeAcademia("#808080");
  expect(oklchDeCss(gris!.claro.primary).c).toBeLessThanOrEqual(0.02);

  const neon = paletaDeAcademia("#FF0000");
  expect(oklchDeCss(neon!.claro.primary).c).toBeLessThanOrEqual(0.147);
});

test("estiloDeAcademia emite los dos bloques y nada prohibido", () => {
  const css = estiloDeAcademia("#DC2626");
  expect(css).toContain(":root, .light {");
  expect(css).toContain(".dark {");
  expect(css).toContain("--primary:");
  expect(css).toContain("--ring:");
  expect(css).toContain("--brand:");
  expect(css).toContain("--sidebar-primary:");
  expect(css).toContain("--chart-5:");
  expect(css).not.toContain("--accent:");
  expect(css).not.toContain("--primary-foreground:");
  expect(css).not.toContain("--brand-foreground:");
});

test("con un hex inválido no sale CSS a medias: sale nada", () => {
  expect(estiloDeAcademia("")).toBe("");
  expect(estiloDeAcademia("#XYZ123")).toBe("");
});
```

- [ ] **Step 2: correr y ver fallar** — `bun test tests/color-academia.test.ts` → módulo inexistente.

- [ ] **Step 3: implementación**

```ts
// src/lib/color-academia.ts
/**
 * La paleta de una academia, derivada de su color de acento.
 *
 * Regla de oro (spec 2026-08-14): el hex del creador NUNCA entra tal cual a un
 * token que lleve texto encima. Se conserva su TONO; la luminosidad la pone la
 * tabla de `globals.css`, que ya pasa AA — y si un tono concreto no llega
 * (la L de OKLCH es perceptual, no la luminancia WCAG: un amarillo a L 0.52
 * es más luminoso que un azul a L 0.52), se ajusta en pasos de 0.01 hasta
 * pasar. El croma es `min(el suyo, el de la tabla)`: un neón se recorta, un
 * tono empolvado conserva lo apagado. Un gris queda gris.
 *
 * Matemática OKLCH de Björn Ottosson, a mano: son ~40 líneas y meter una
 * dependencia de color para esto es más superficie que valor.
 */

export interface Oklch { l: number; c: number; h: number }
export interface TonosTema { primary: string; brand: string; charts: [string, string, string, string, string] }
export interface PaletaAcademia { claro: TonosTema; oscuro: TonosTema }

/* --- sRGB ↔ OKLab -------------------------------------------------------- */

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

/** rgb LINEAL, puede salirse de [0,1]: quien llama decide qué hacer. */
function oklchALineal({ l, c, h }: Oklch): { r: number; g: number; b: number } {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3;
  return {
    r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  };
}

function enGamut(rgb: { r: number; g: number; b: number }): boolean {
  const e = 1e-6;
  return rgb.r >= -e && rgb.r <= 1 + e && rgb.g >= -e && rgb.g <= 1 + e && rgb.b >= -e && rgb.b <= 1 + e;
}

/** Reduce el croma hasta caber en sRGB. La luz apenas cambia; el color, poco. */
function alGamut(color: Oklch): Oklch {
  let c = color.c;
  while (c > 0 && !enGamut(oklchALineal({ ...color, c }))) c -= 0.005;
  return { ...color, c: Math.max(0, c) };
}

/* --- API pública de conversión ------------------------------------------- */

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

export function contrasteHex(a: string, b: string): number {
  const oa = hexAOklch(a), ob = hexAOklch(b);
  if (!oa || !ob) return 0;
  const la = luminancia(oa), lb = luminancia(ob);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* --- Derivación ----------------------------------------------------------- */

function ratio(a: Oklch, b: Oklch): number {
  const la = luminancia(a), lb = luminancia(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Parte de la L de la tabla y la mueve en `dir` (±0.01) hasta que el color
 * pasa 4.5:1 contra TODOS los `contra`. El tope evita bucles con exigencias
 * imposibles — no debería alcanzarse nunca, y la prueba de los 360 tonos es
 * quien lo garantiza.
 */
function conContraste(base: Oklch, contra: Oklch[], dir: 1 | -1): Oklch {
  let { l } = base;
  for (let i = 0; i < 90; i++) {
    const color = alGamut({ ...base, l });
    if (contra.every((n) => ratio(color, n) >= 4.5)) return color;
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
const CHARTS_CLARO: [number, number][] = [[0.699, 0.147], [0.6, 0.13], [0.5, 0.11], [0.4, 0.09], [0.32, 0.07]];
const CHARTS_OSCURO: [number, number][] = [[0.75, 0.14], [0.66, 0.13], [0.57, 0.12], [0.48, 0.1], [0.39, 0.08]];

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
  // lee con el texto oscuro y sobre fondo oscuro → se ACLARA. --brand lleva
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
```

- [ ] **Step 4: correr y ver pasar** — `bun test tests/color-academia.test.ts` → todo verde. Si algún tono falla AA, el defecto está en `conContraste` (dirección o tope), no en la prueba.

- [ ] **Step 5: commit**

```bash
git add src/lib/color-academia.ts tests/color-academia.test.ts
git commit -m "feat(color): paleta derivada del acento de la academia"
```

### Task 2: la marca llega desde el servidor — `<style>`, título y favicon

**Files:**
- Create: `src/lib/marca-servidor.ts`
- Modify: `src/app/(miembro)/c/[comunidad]/layout.tsx`
- Modify: `src/app/(auth)/login/[academia]/page.tsx`
- Modify: `src/app/(auth)/invitacion/[token]/page.tsx`

**Interfaces:**
- Consumes: `estiloDeAcademia(hex): string` (Task 1); RPCs `marca_publica(p_slug)` e `invitacion_publica(p_token)` ya desplegadas (ambas `stable` → se llaman por GET y el fetch de Next las memoiza por petición).
- Produces: `leerMarcaServidor(slug: string): Promise<MarcaServidor | null>` y `leerMarcaInvitacion(token: string): Promise<MarcaServidor | null>` con `MarcaServidor = { nombre: string; logoUrl: string | null; colorAcento: string | null }`.

- [ ] **Step 1: `src/lib/marca-servidor.ts`**

Antes de escribirlo, mirar `src/lib/supabase/env.ts` y usar sus exports para URL y clave publishable (si el archivo es importable desde servidor; si lleva `"use client"`, leer `process.env.NEXT_PUBLIC_*` con los mismos nombres que use ese archivo).

```ts
// src/lib/marca-servidor.ts
/**
 * La marca de una academia, leída DESDE EL SERVIDOR y sin sesión.
 *
 * Llama a las RPC públicas por GET —son `stable`, PostgREST lo permite— y no
 * por POST a propósito: el fetch de Next solo memoiza y cachea GET, y cada
 * layout la pide dos veces por petición (generateMetadata y el render).
 *
 * Nunca lanza. La marca es decoración: sin red, sin fila o con la academia
 * suspendida se devuelve `null` y la página sale con la marca de Klaze.
 * `AbortSignal.timeout(3000)`: una base lenta no puede bloquear la entrada.
 */
export interface MarcaServidor {
  nombre: string;
  logoUrl: string | null;
  colorAcento: string | null;
}

async function rpcPublica(fn: string, params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; // confirmar nombre en env.ts
  if (!url || !clave) return null;

  try {
    const q = new URLSearchParams(params).toString();
    const r = await fetch(`${url}/rest/v1/rpc/${fn}?${q}`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return null;
    const filas = (await r.json()) as Record<string, unknown>[];
    return filas?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function leerMarcaServidor(slug: string): Promise<MarcaServidor | null> {
  const f = await rpcPublica("marca_publica", { p_slug: slug });
  if (!f) return null;
  return {
    nombre: (f.nombre as string) ?? "",
    logoUrl: (f.logo_url as string) ?? null,
    colorAcento: (f.color_acento as string) ?? null,
  };
}

export async function leerMarcaInvitacion(token: string): Promise<MarcaServidor | null> {
  const f = await rpcPublica("invitacion_publica", { p_token: token });
  if (!f) return null;
  return {
    nombre: (f.comunidad_nombre as string) ?? "",
    logoUrl: (f.comunidad_logo as string) ?? null,
    colorAcento: (f.comunidad_color as string) ?? null,
  };
}
```

- [ ] **Step 2: layout de `/c/[comunidad]`**

```tsx
// src/app/(miembro)/c/[comunidad]/layout.tsx
import type { Metadata } from "next";
import { MemberShell } from "@/components/shells/member-shell";
import { estiloDeAcademia } from "@/lib/color-academia";
import { leerMarcaServidor } from "@/lib/marca-servidor";

/**
 * La pestaña y el color son de la academia, no de Klaze — y llegan DESDE EL
 * SERVIDOR: cero parpadeo (los botones nunca existen en cian), y el `:root`
 * alcanza también a los diálogos y toasts que se montan por portal en el
 * `body`, fuera del árbol del shell. Al navegar al panel, React desmonta este
 * layout y el `<style>` se va con él.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}): Promise<Metadata> {
  const { comunidad } = await params;
  const marca = await leerMarcaServidor(comunidad);
  if (!marca?.nombre) return {};
  return {
    title: marca.nombre,
    ...(marca.logoUrl ? { icons: { icon: marca.logoUrl } } : {}),
  };
}

export default async function ComunidadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad } = await params;
  // Mismo GET que generateMetadata: el fetch de Next lo memoiza por petición.
  const marca = await leerMarcaServidor(comunidad);
  const css = marca?.colorAcento ? estiloDeAcademia(marca.colorAcento) : "";

  return (
    <>
      {css ? <style>{css}</style> : null}
      <MemberShell communitySlug={comunidad}>{children}</MemberShell>
    </>
  );
}
```

- [ ] **Step 3: `/login/[academia]` e `/invitacion/[token]`**

En `src/app/(auth)/login/[academia]/page.tsx` (conserva el docstring existente,
se añade lo de servidor):

```tsx
import type { Metadata } from "next";
import LoginPage from "../page";
import { estiloDeAcademia } from "@/lib/color-academia";
import { leerMarcaServidor } from "@/lib/marca-servidor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ academia: string }>;
}): Promise<Metadata> {
  const { academia } = await params;
  const marca = await leerMarcaServidor(academia);
  if (!marca?.nombre) return {};
  return {
    title: `Entrar — ${marca.nombre}`,
    ...(marca.logoUrl ? { icons: { icon: marca.logoUrl } } : {}),
  };
}

export default async function LoginDeAcademiaPage({
  params,
}: {
  params: Promise<{ academia: string }>;
}) {
  const { academia } = await params;
  const marca = await leerMarcaServidor(academia);
  const css = marca?.colorAcento ? estiloDeAcademia(marca.colorAcento) : "";
  return (
    <>
      {css ? <style>{css}</style> : null}
      <LoginPage />
    </>
  );
}
```

En `src/app/(auth)/invitacion/[token]/page.tsx`: leer primero el archivo actual
(probablemente un wrapper de servidor sobre `_invitation-screen`); añadir
`generateMetadata` con título `Invitación a ${marca.nombre}` y el mismo patrón
de `<style>`, usando `leerMarcaInvitacion(token)`. Conservar intacto lo que ya
haga con el token.

- [ ] **Step 4: verificación con el dev server**

```bash
bun run dev &   # esperar a que responda
curl -s http://localhost:3000/login/mentoria-v7 | grep -o "<title>[^<]*</title>"
# Esperado: <title>Entrar — Mentoría V7.0</title>
curl -s http://localhost:3000/login/mentoria-v7 | grep -c "oklch"
# Esperado: > 0 si esa academia tiene color guardado; el <style> viaja en el HTML
curl -s http://localhost:3000/login/no-existe | grep -o "<title>[^<]*</title>"
# Esperado: el título por defecto de Klaze (metadata vacío al no haber fila)
```

(Es una LECTURA de producción vía RPC pública — permitida; no se escribe nada.)

- [ ] **Step 5: `bun run lint && bun run build`** — limpios.

- [ ] **Step 6: commit**

```bash
git add src/lib/marca-servidor.ts "src/app/(miembro)/c/[comunidad]/layout.tsx" "src/app/(auth)/login/[academia]/page.tsx" "src/app/(auth)/invitacion/[token]/page.tsx"
git commit -m "feat(marca): color, titulo y favicon de la academia desde el servidor"
```

### Task 3: el preview de Configuración dice la verdad

**Files:**
- Modify: `src/app/(creador)/admin/configuracion/page.tsx` (zona del preview, ~línea 75-110 y 358)

**Interfaces:**
- Consumes: `paletaDeAcademia(hex): PaletaAcademia | null` (Task 1; es pura y corre en el navegador).

- [ ] **Step 1: añadir el preview de interfaz**

Debajo del `PreviewEncabezado` existente (que se conserva: enseña el hex exacto
en el monograma), un componente nuevo en el mismo archivo:

```tsx
/**
 * Lo que de verdad verán los alumnos: la paleta DERIVADA, no el hex crudo.
 * Enseña las dos caras porque la corrección de luminosidad actúa distinto en
 * cada tema — un amarillo se oscurece en claro y apenas cambia en oscuro — y
 * el creador tiene que ver ambas antes de guardar.
 */
function PreviewInterfaz({ colorAcento }: { colorAcento: string }) {
  const paleta = paletaDeAcademia(colorAcento);
  if (!paleta) return null;

  const cara = (tonos: TonosTema, fondo: string, texto: string, etiqueta: string) => (
    <div className="flex-1 space-y-2 rounded-lg p-3 ring-1 ring-foreground/10" style={{ backgroundColor: fondo }}>
      <p className="text-xs" style={{ color: texto, opacity: 0.6 }}>{etiqueta}</p>
      <span
        className="inline-block rounded-md px-3 py-1.5 text-sm font-medium"
        style={{ backgroundColor: tonos.primary, color: etiqueta === "Tema claro" ? "#fcfcfc" : "#111827" }}
      >
        Continuar
      </span>
      <p className="text-sm">
        <span style={{ color: tonos.primary }}>Un enlace</span>{" "}
        <span
          className="ml-2 border-b-2 pb-0.5"
          style={{ borderColor: tonos.primary, color: texto }}
        >
          Pestaña activa
        </span>
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {cara(paleta.claro, "#fbfbfc", "#1c1e21", "Tema claro")}
      {cara(paleta.oscuro, "#16181c", "#f2f3f5", "Tema oscuro")}
    </div>
  );
}
```

Imports arriba del archivo: `import { paletaDeAcademia, type TonosTema } from "@/lib/color-academia";`

En el JSX, tras el `<PreviewEncabezado …/>` (línea ~358):

```tsx
<PreviewInterfaz colorAcento={colorAcento} />
<p className="text-xs text-muted-foreground">
  El tono es el tuyo; el brillo se ajusta solo para que el texto siempre se
  lea. El color exacto sale en tu logo y en la portada de tu entrada.
</p>
```

- [ ] **Step 2: `bun run lint && bun run build`** — limpios.

- [ ] **Step 3: commit**

```bash
git add "src/app/(creador)/admin/configuracion/page.tsx"
git commit -m "feat(config): el preview enseña la paleta derivada en los dos temas"
```

### Task 4: suite completa y despliegue

- [ ] **Step 1:** `bun run dev` en segundo plano y `bun run test` — **todo verde** (las RLS necesitan el dev server).
- [ ] **Step 2:** merge a `main` con `--no-ff`, push.
- [ ] **Step 3:** `bun run deploy`; smoke: `/login` 200, `/login/mentoria-v7` con título de la academia.
- [ ] **Step 4:** anotar en el informe el smoke manual humano: elegir un color llamativo en Configuración, mirar área de alumno en claro/oscuro, pestaña con nombre y logo, panel de creador sigue cian.

## Self-review

- **Cobertura de la spec:** derivación (T1), `<style>` servidor + portales + `.light` (T2), pestaña título/favicon (T2), preview honesto (T3), prueba 360 tonos (T1), bordes (hex inválido T1; academia inexistente/suspendida y timeout en T2 vía `null`). El punto «`globals.css` no cambia» se cumple por omisión: ninguna tarea lo toca.
- **Placeholders:** ninguno; el único «leer el archivo actual primero» (invitación) es una instrucción de exploración con el patrón completo dado.
- **Consistencia de tipos:** `PaletaAcademia`/`TonosTema`/`estiloDeAcademia`/`paletaDeAcademia` idénticos en T1, T2 y T3.
