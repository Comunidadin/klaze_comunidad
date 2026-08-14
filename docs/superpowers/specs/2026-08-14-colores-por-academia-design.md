# Colores y pestaña por academia — diseño

## El problema

`color_acento` existe, se elige en Configuración y se guarda bien — pero solo
pinta el monograma, el anillo del logo y el degradado de la entrada. Botones,
enlaces, pestañas activas, anillos de foco y gráficas leen `--primary`, el cian
de Klaze fijo en `globals.css`. Un creador elige su rojo, ve el monograma rojo,
y todo lo demás sigue cian.

Y la pestaña del navegador dice «Klaze» con el favicon de Klaze en todas las
academias — `src/app/layout.tsx` ya lo documentaba como pendiente.

## Decisiones tomadas (con el dueño, 2026-08-13)

1. **Un color manda en todo.** El creador elige UN color y de él se deriva el
   acento completo. Fondos, tarjetas y texto siguen siendo los neutros de
   Klaze. Ni fondo propio ni paleta editable.
2. **Alcance: área del alumno + entrada.** Todo lo que cuelga de
   `/c/{slug}` más `/login/{slug}` e `/invitacion/{token}`. El panel del
   creador y `/plataforma` siguen siendo Klaze — así se distingue de un
   vistazo administrar de mirar como alumno.
3. **Contraste: se deriva la paleta del tono.** Nunca se aplica el hex del
   creador a un token que lleve texto encima. Se conserva su TONO y se impone
   la luminosidad ya probada. Nadie puede dejar su academia ilegible.
4. **La pestaña es de la academia.** Título con su nombre y favicon con su
   logo, en el mismo alcance del punto 2.

## Por qué es casi barato: la paleta de Klaze ya es un solo tono

Todos los tokens de marca de `globals.css` son el tono OKLCH **235** con
luminosidad y croma fijados por token: `--primary` es `oklch(0.52 0.147 235)`
en claro y `oklch(0.72 0.14 235)` en oscuro; los cinco `--chart-*` son el
mismo 235 bajando de luz. El sistema ya está construido con el tono como única
variable libre. Este diseño tira de esa palanca.

## Arquitectura

### 1. `src/lib/color-academia.ts` — lógica pura, sin dependencias

```ts
/** "#RRGGBB" → { l, c, h } | null si no es un hex válido. */
export function hexAOklch(hex: string): { l: number; c: number; h: number } | null;

/**
 * El CSS que impone el color de la academia, o "" si el hex no vale.
 * Contiene un bloque `:root { … }` y un bloque `.dark { … }`.
 */
export function estiloDeAcademia(hex: string): string;
```

Conversión sRGB → OKLCH implementada a mano (la matemática es estándar y son
~40 líneas); una dependencia de color para esto es más superficie que valor.

Reglas de derivación, por token:

- **Tono**: el del creador, en todos los tokens derivados.
- **Luminosidad**: la de la tabla actual de `globals.css`, copiada tal cual
  (0.52 para `--primary` claro, 0.72 para el oscuro, la escalera de los
  `--chart-*`, etc.). Es la que ya pasa AA; no se recalcula nada.
- **Croma**: `min(croma del creador, croma del token actual)`. Un rojo neón se
  recorta al techo que ya está probado; un rosa empolvado conserva lo apagado,
  que también es su marca. Un gris (croma ≈ 0) da una interfaz gris: el tono
  de un gris no significa nada y no se le inventa uno.
- **Ajuste fino por tono**: la L de OKLCH es perceptual, no la luminancia de
  WCAG, y no coinciden del todo — un amarillo a L 0.52 es más luminoso para
  WCAG que un azul a L 0.52. Si un tono no alcanza AA con la L de la tabla,
  `estiloDeAcademia` la oscurece (claro) o aclara (oscuro) en pasos de 0.01
  hasta pasar. Es determinista y la prueba de los 360 tonos lo verifica.

Tokens que emite, en `:root` y `.dark`:

| Token | Emite |
|---|---|
| `--primary`, `--ring` | tono del creador, L/C de la tabla |
| `--brand` | tono del creador, L/C de la tabla |
| `--sidebar-primary`, `--sidebar-ring` | ídem |
| `--chart-1` … `--chart-5` | la escalera actual con el tono cambiado |

**No se tocan**: `--accent` (es el hover neutro de shadcn — teñirlo repite el
error ya corregido de los menús que se coloreaban), `--primary-foreground` y
`--brand-foreground` (siguen funcionando porque la luminosidad del fondo no
cambió), fondos, tarjetas, bordes ni `--destructive`.

Si `hexAOklch` devuelve `null` (valor corrupto en la base), `estiloDeAcademia`
devuelve `""` y la academia queda con el cian de Klaze — nunca CSS a medias.

### 2. El CSS llega en el HTML, desde el servidor

`src/app/(miembro)/c/[comunidad]/layout.tsx` ya es un Server Component. Ahí:

1. Se llama a `marca_publica(slug)` — la función pública que ya alimenta la
   pantalla de entrada: devuelve nombre, logo y color **solo de academias
   activas**, sin sesión. Se llama por REST
   (`{SUPABASE_URL}/rest/v1/rpc/marca_publica`, clave publishable) con
   `next: { revalidate: 300 }`: la marca cambia poco y no merece un viaje a la
   base por navegación.
2. `generateMetadata` devuelve `title` con el nombre y `icons` con el
   `logo_url` de la academia. Sin logo, el icono de Klaze.
3. El layout pinta `<style>{estiloDeAcademia(color)}</style>` antes de
   `children`.

Por qué servidor y no un efecto de cliente:

- **Cero parpadeo por construcción**: los botones nunca existen en cian antes
  de corregirse.
- **Los portales quedan cubiertos**: diálogos, sheets y toasts se montan en
  `document.body`, fuera de cualquier `<div>` envolvente. Un `:root` los
  alcanza estén donde estén. (El `--community-accent` actual, puesto en un
  div del `MemberShell`, no los alcanza — este diseño lo arregla de paso.)
- **La limpieza es gratis**: al navegar fuera de `/c/…`, React desmonta el
  layout y su `<style>` se va con él. El panel del creador no hereda nada.

Lo mismo, con la misma función compartida, en:

- `src/app/(auth)/login/[academia]/page.tsx` — ya es el sitio que sabe el
  slug; gana `generateMetadata` y el `<style>`.
- `src/app/(auth)/invitacion/[token]/page.tsx` — el color viene de
  `invitacion_publica`, que el cliente ya consulta; el servidor llama a la
  misma RPC para el `<style>` y el título («Invitación a {academia}»).

La llamada REST compartida vive en `src/lib/marca-servidor.ts` (servidor
solamente): `leerMarcaServidor(slug) → { nombre, logoUrl, colorAcento } | null`.
Nunca lanza: sin red o sin fila, `null`, y la página sale con la marca Klaze.

### 3. `globals.css` no cambia de valores

Los tokens actuales quedan exactamente como están; el `<style>` inyectado los
**pisa** por cascada (viene después en el documento). Donde no hay academia no
se inyecta nada y no cambia ni un píxel. No hace falta reescribir los tokens
como `var(--academia-*, fallback)`: la cascada ya es el mecanismo de respaldo.

### 4. El preview de Configuración dice la verdad

`PreviewEncabezado` en `/admin/configuracion` hoy enseña solo el encabezado.
Pasa a enseñar además, con la paleta **derivada** (no el hex crudo): un botón
primario, un enlace y una pestaña activa. Así lo que el creador ve al elegir
es lo que verán sus alumnos, incluida la corrección de luminosidad. El hex
exacto sigue visible en el monograma del mismo preview.

### 5. Dónde sigue saliendo el hex exacto

Monograma, anillo del logo, degradado de la entrada y portadas — los rellenos
grandes sin texto de interfaz encima. Es lo que ya hace `--community-accent`,
que se conserva para esos usos tal cual.

## Errores y bordes

- Hex inválido o vacío → sin `<style>`, marca Klaze. Nunca CSS parcial.
- Academia suspendida → `marca_publica` no devuelve fila → marca Klaze, y las
  pantallas de «suspendida» siguen como hoy.
- `marca_publica` caída o lenta → `leerMarcaServidor` devuelve `null` (con
  timeout corto); la página nunca se bloquea por la marca.
- Modo oscuro → el bloque `.dark` del `<style>` inyectado usa las
  luminosidades oscuras de la tabla; el toggle funciona sin recálculo.

## Pruebas

- **`tests/color-academia.test.ts`** (pura, sin base):
  - Los 360 tonos: para cada uno, el `--primary` emitido pasa **AA (4.5:1)**
    como relleno con su foreground encima y como texto sobre el fondo del
    tema, en claro y en oscuro. El cálculo de contraste vive en el propio
    test (OKLCH → sRGB → luminancia relativa WCAG).
  - Un gris conserva croma ≈ 0; un neón queda recortado al techo de la tabla.
  - Hex inválido (`""`, `"rojo"`, `"#12"`) → `""`.
  - El CSS emitido no contiene `--accent` ni `--primary-foreground`.
- **Smoke manual** (humano, tras desplegar): elegir un color llamativo en
  Configuración, mirar el área de alumno en claro y oscuro, la pestaña del
  navegador con nombre y logo, y que el panel de creador siga cian.

## Fuera de alcance

- Fondo o paleta editable por academia (decisión 1).
- El panel del creador con los colores de su academia (decisión 2).
- Favicon propio distinto del logo (si a 16px el logo no se lee, se añade un
  campo después; pedir dos imágenes hoy es fricción sin evidencia).
- Dominios personalizados y multi-academia — specs propias.
