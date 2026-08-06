# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Ver `README.md` para la descripción de producto, usuarios semilla, mapa de rutas y flujo de invitación — este archivo se enfoca en convenciones para escribir código aquí. Ojo: la versión de Next.js de este repo puede diferir de tu entrenamiento — ver el aviso en `AGENTS.md` (docs en `node_modules/next/dist/docs/`).

## Qué es esto

Frontend-only (sin backend) de Comunidad del Intercambio, plataforma multi-creador de cursos + comunidad. Next.js App Router + TypeScript + Tailwind v4 + shadcn/ui + Zustand + Framer Motion, gestor `bun`. Toda la UI y la copy están en **español**.

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

## Resolvers centrales — extiéndelos, no los rodees

Las ediciones/acciones del admin no mutan mocks: se guardan como **overrides** en el store y se aplican en un único punto de verdad exportado desde `src/lib/store.ts` / `src/lib/hooks/use-courses.ts`:

- `resolverComunidad(...)` — aplica overrides de comunidad (nombre, color, estado suspendida, categorías, niveles). Lo usan `useCommunity`, `useMyCommunity`, `useInvitation`, `usePlatform`.
- `resolverEstadoEnrollment(...)` — estado efectivo de un alumno (activo/invitado/suspendido). Suspender DEBE revocar acceso real, no solo cambiar un badge.
- `enrollmentCubreCurso(...)` / `cursoIdsCubreCurso(...)` — criterio único de "este enrollment cubre este curso".
- `cursosVisiblesParaMiembro(...)` — merge mocks+editados filtrando `publicado`; TODO consumidor de cara al miembro (incluido cálculo de progreso en admin) pasa por aquí para que los borradores nunca se filtren.

Si agregas un consumidor nuevo de comunidad/enrollment/cursos, usa estos helpers. Cada bug importante que encontró la revisión de este repo fue un consumidor que re-derivó esta lógica por su cuenta.

## Base de datos (cimiento completado)

El esquema vive en `supabase/migrations/`. Los cuatro resolvers de la sección anterior tienen su **gemelo SQL** en el esquema `privado` (`pertenece_a`, `cubre_curso`, `es_propietario_de`, `es_superadmin`, más `comparte_comunidad_con`), y ahí son inevitables: ninguna consulta los puede rodear. La app aún lee mocks — migrar las lecturas es el proyecto 2. Ver `docs/superpowers/specs/2026-08-05-backend-cimiento-design.md`.

```bash
supabase migration new <nombre>   # crea el archivo SQL
bun run db:push                   # aplica lo pendiente al proyecto alojado
bun run test:rls                  # pruebas de aislamiento — deben quedar verdes
```

- **No hay base local** (esta máquina no tiene Docker): las migraciones van al proyecto alojado. `bun run db:push` conecta directo a Postgres y registra cada migración en `supabase_migrations.schema_migrations`, así que `supabase db push` sigue siendo válido si alguien enlaza la CLI.
- **RLS activado en toda tabla nueva, en su misma migración**, nunca después. Y `grant` explícito: crear una tabla por SQL no la expone al API sola.
- Toda función `security definer` lleva `set search_path = ''` y referencia tablas con esquema explícito. `tests/rls/auditoria.test.ts` lo verifica en cada ejecución.
- **Nunca uses `user_metadata` para decidir permisos** — el propio usuario lo edita desde el navegador. Los roles van en `app_metadata`.

## Determinismo

- **Seeds** (`src/lib/mocks/`): cero `Math.random()`/`Date.now()`; fechas derivadas de la fecha base fija en `src/lib/mocks/fechas.ts`; datos generados por índice.
- **IDs creados en runtime** (posts, invitaciones, cursos/módulos/lecciones): contadores persistidos en el store (`proximoInviteId`, `proximoPostId`, `siguienteCursoId`...). Nunca `array.length + 1` (colisiona tras eliminar) ni `Math.random`. Sigue el patrón existente si necesitas un ID nuevo.
- Excepción: `new Date().toISOString()` sí se usa para `creadoEl` de entidades creadas por el usuario en sesión — es estado real, no seed.

## Selectores de Zustand (React 19)

`getSnapshot` debe devolver referencias estables: **no hagas `.filter()`/`.map()` ni crees objetos dentro del selector** (`useAppStore(s => s.x.filter(...))` crashea con el invariante de `useSyncExternalStore`). Selecciona el array crudo y deriva con `useMemo` en el hook. Ver `use-invitations.ts` y `use-ahora.ts`, que se corrigieron exactamente por esto.

## Estado y sesión

- `src/lib/store.ts` es el único estado mutable de la app (Zustand + `persist`, clave de `localStorage`: `intercambio-v1`). Ahí viven: sesión activa, invitaciones, progreso de lecciones, posts/comentarios/likes creados en la demo, comunidades registradas en runtime, overrides de edición admin.
- `useSession()` / `useHydrated()` (`src/lib/hooks/use-session.ts`) son el punto de entrada para saber quién está logueado y si el store ya hidrató desde `localStorage`. **Todo layout de grupo de rutas debe gatear en `!hydrated` antes de decidir un redirect** — mira `src/app/(miembro)/layout.tsx` como referencia canónica del patrón (`if (!hydrated || !user) return <FullScreenLoader />`).
- Los 4 layouts de grupo (`(auth)`, `(miembro)`, `(creador)`, `(superadmin)`) son los guards de rol. No dupliques lógica de redirect dentro de páginas hijas. Matices: `(creador)` admite `creador` Y `superadmin` (el superadmin puede ser dueño de una comunidad — hoy admin@intercambio.app es dueño de Comunidad del Intercambio); `/invitacion` está excluida del redirect de ya-logueado en `(auth)`; el destino post-login vive en `homePorRol` (`src/lib/routes.ts`) — no dupliques esa tabla.

## Convenciones de UI

- Tokens de color/espaciado viven en `src/app/globals.css` (`@theme inline` + variables `:root`/`.dark`). Usa clases semánticas (`bg-card`, `text-muted-foreground`, `ring-foreground/10`) en vez de colores hardcodeados — así el modo oscuro funciona gratis. Excepción legítima: overlays sobre imágenes/video (hero con gradiente, `VimeoPlayer`, `Sheet`/`Dialog` backdrop) donde `bg-black`/`text-white` son intencionales y no dependen del tema.
- **Tres tokens de color que se confunden fácil** (paleta derivada del logo: cian `#06ABEB`, negro, blanco):
  - `--primary` (`#0073B0`, cian profundo) — botones, enlaces, estados activos. Es el único cian que pasa contraste AA en las dos direcciones: como texto sobre fondo claro (4.9:1) y como relleno con `--primary-foreground` blanco (5.2:1). Por defecto, usa este.
  - `--brand` (el cian exacto del logo) — solo rellenos grandes con `--brand-foreground` (casi negro) encima. Con texto blanco da 2.6:1 y **reprueba AA**, así que nunca lo combines con blanco.
  - `--accent` — neutro, es el fondo de hover de shadcn (`bg-accent` dentro de `components/ui`). No es un color de marca; si estás pintando algo de la marca querías `--brand`.

- Elementos "tarjeta" que son en realidad un `<button>` (no un `<a>`/`Link`) necesitan la clase `cursor-pointer` explícita — los navegadores no ponen cursor de mano en `<button>` por defecto. Revisa `member-card.tsx` / `post-composer.tsx` como ejemplos.
- `src/components/shared/page-transition.tsx` es la transición de página (fade/slide, respeta `prefers-reduced-motion` vía `useReducedMotion` de Framer Motion) usada por los `template.tsx` de `(miembro)`, `(creador)`, `(superadmin)`. El resto de usos de Framer Motion en el proyecto **no** respeta esa preferencia todavía (limitación conocida, documentada en el README — no la repliques sin revisar si vale la pena para ese caso puntual).
- Componentes de `src/components/ui/` son la base de shadcn/ui, generados — evita editarlos a mano salvo que sea un fix real de la librería; para variantes de producto, envuelve o crea un componente en `src/components/shared|admin|community|course/`.

## Antes de terminar cualquier cambio

1. `bun run build` y `bun run lint` limpios.
2. Si tocaste una pantalla con estados de carga: verifica que ya gatea con `useHydrated` internamente (muchas páginas de `(creador)`/`(superadmin)` lo hacen) antes de agregar un `loading.tsx` nuevo — no dupliques el esqueleto.
3. Revisa el modo oscuro del área que tocaste (toggle en el menú de usuario o en `/perfil`).
