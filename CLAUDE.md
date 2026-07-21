# CLAUDE.md — Klaze V2

Guía para trabajar en este repo. Ver `README.md` para la descripción de producto, usuarios semilla y mapa de rutas completos — este archivo se enfoca en convenciones para escribir código aquí.

## Qué es esto

Frontend-only (sin backend) de Klaze, plataforma multi-creador de cursos + comunidad. Next.js App Router + TypeScript + Tailwind v4 + shadcn/ui + Zustand + Framer Motion, gestor `bun`. Toda la UI y la copy están en **español**.

## Comandos

```bash
bun install
bun run dev      # dev server, Turbopack
bun run build    # build de producción — debe quedar limpio antes de cada commit de feature
bun run lint     # ESLint — debe quedar limpio antes de cada commit de feature
```

No hay tests automatizados en este proyecto (decisión del spec original); la verificación es `build` + `lint` + smoke visual/E2E manual (Playwright ad hoc cuando aplica).

## Regla dura: mocks → hooks → páginas

```
src/lib/mocks/*.ts  →  src/lib/hooks/*.ts  →  src/app/** y src/components/**
                             ↑
                      src/lib/store.ts (Zustand, persistido en localStorage)
```

**Ningún componente ni página importa `src/lib/mocks` directamente.** Todo dato pasa por un hook de `src/lib/hooks/` (ver `src/lib/hooks/index.ts` para el listado completo), que mergea mock + estado del store y devuelve la forma ya lista para pintar. Si necesitas un dato nuevo derivado de mocks, agrega o extiende un hook — no importes el mock desde la página.

Al añadir un mock nuevo, respeta los tipos de `src/lib/types.ts` y mantén los IDs deterministas (`curso-1`, `u-m22`, `post-15`, etc.) — varios hooks y componentes los referencian por convención de prefijo (`u-` usuarios, `com-` comunidades, `curso-`/`c{n}-m{n}` cursos/módulos, `post-` posts).

## Estado y sesión

- `src/lib/store.ts` es el único estado mutable de la app (Zustand + `persist`, clave de `localStorage`: `klaze-v2`). Ahí viven: sesión activa, invitaciones, progreso de lecciones, posts/comentarios/likes creados en la demo, comunidades registradas en runtime, overrides de edición admin.
- `useSession()` / `useHydrated()` (`src/lib/hooks/use-session.ts`) son el punto de entrada para saber quién está logueado y si el store ya hidrató desde `localStorage`. **Todo layout de grupo de rutas debe gatear en `!hydrated` antes de decidir un redirect** — mira `src/app/(miembro)/layout.tsx` como referencia canónica del patrón (`if (!hydrated || !user) return <FullScreenLoader />`).
- Los 4 layouts de grupo (`(auth)`, `(miembro)`, `(creador)`, `(superadmin)`) son los guards de rol. No dupliques lógica de redirect dentro de páginas hijas.

## Convenciones de UI

- Tokens de color/espaciado viven en `src/app/globals.css` (`@theme inline` + variables `:root`/`.dark`). Usa clases semánticas (`bg-card`, `text-muted-foreground`, `ring-foreground/10`, `bg-accent`) en vez de colores hardcodeados — así el modo oscuro funciona gratis. Excepción legítima: overlays sobre imágenes/video (hero con gradiente, `VimeoPlayer`, `Sheet`/`Dialog` backdrop) donde `bg-black`/`text-white` son intencionales y no dependen del tema.
- Elementos "tarjeta" que son en realidad un `<button>` (no un `<a>`/`Link`) necesitan la clase `cursor-pointer` explícita — los navegadores no ponen cursor de mano en `<button>` por defecto. Revisa `member-card.tsx` / `post-composer.tsx` como ejemplos.
- `src/components/shared/page-transition.tsx` es la transición de página (fade/slide, respeta `prefers-reduced-motion` vía `useReducedMotion` de Framer Motion) usada por los `template.tsx` de `(miembro)`, `(creador)`, `(superadmin)`. El resto de usos de Framer Motion en el proyecto **no** respeta esa preferencia todavía (limitación conocida, documentada en el README — no la repliques sin revisar si vale la pena para ese caso puntual).
- Componentes de `src/components/ui/` son la base de shadcn/ui, generados — evita editarlos a mano salvo que sea un fix real de la librería; para variantes de producto, envuelve o crea un componente en `src/components/shared|admin|community|course/`.

## Antes de terminar cualquier cambio

1. `bun run build` y `bun run lint` limpios.
2. Si tocaste una pantalla con estados de carga: verifica que ya gatea con `useHydrated` internamente (muchas páginas de `(creador)`/`(superadmin)` lo hacen) antes de agregar un `loading.tsx` nuevo — no dupliques el esqueleto.
3. Revisa el modo oscuro del área que tocaste (toggle en el menú de usuario o en `/perfil`).
