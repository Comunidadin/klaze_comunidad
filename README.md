# Comunidad del Intercambio V2

Demo de frontend de **Comunidad del Intercambio**, una plataforma de gestión de cursos en video y comunidades estilo Skool / Cademi / Hotmart Club. Es **multi-creador**: cada creador tiene su propia comunidad con cursos, feed, calendario y gamificación. La comunidad que da nombre a la plataforma es la del dueño, que además administra todo desde un panel super-admin — la cuenta unificada dueño-de-plataforma + dueño-de-comunidad.

## Marca

El logotipo (`public/marca/`) es el globo dentro de una "C" cian y define la paleta: **cian `#06ABEB`, negro y blanco**. En `src/app/globals.css` viven dos tokens de cian y la diferencia importa:

- `--brand` es el cian exacto del logo. Con texto blanco encima da 2.6:1 y **reprueba WCAG AA**, así que solo se usa como relleno grande con `--brand-foreground` (casi negro) encima, que da 7.2:1 — el mismo contraste del logo.
- `--primary` es un cian profundo (`#0073B0`) que funciona tanto de texto sobre fondo claro (4.9:1) como de relleno con blanco encima (5.2:1). Es el que usan botones, enlaces y estados activos.

`--accent` es un neutro: es el fondo de hover de shadcn (`bg-accent` en `components/ui`). No lo uses como color de marca — para eso está `--brand`.

Este repo es **solo frontend, con datos mock y sin backend**. Toda la interfaz y la copy están en español.

## Cómo correr el proyecto

```bash
bun install
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000) — redirige a `/login`.

Otros scripts: `bun run build` (build de producción), `bun run lint` (ESLint).

## Usuarios semilla

No hay contraseñas reales: `login()` solo valida que el correo exista. Cualquier contraseña funciona.

| Correo | Rol | A dónde entra |
|---|---|---|
| `alumno@intercambio.app` | Alumno | `/c/comunidad-del-intercambio/inicio` (miembro de "Comunidad del Intercambio") |
| `creador@intercambio.app` | Creadora (Marta) | `/admin` (dueña de "Inglés con Marta" — comunidad secundaria, mucho menos contenido que la principal; útil para probar estados vacíos) |
| `admin@intercambio.app` | Super-admin (Andrea) | `/admin` (dueña de "Comunidad del Intercambio", uso diario) — con enlace cruzado a `/plataforma` desde el sidebar |

Modelo de roles: un `superadmin` puede además ser dueño de una comunidad (`ownerId` de `Community`) — hoy es el caso de `admin@intercambio.app`, dueño de "Comunidad del Intercambio". `homePorRol` lo manda a `/admin` si tiene comunidad propia, o a `/plataforma` si no. Desde el admin de su academia ve un item de sidebar extra "Panel plataforma" (`/plataforma`); desde `/plataforma` ve "Mi academia" (`/admin`) — ambos enlaces cruzados solo aparecen para ese rol/condición, nunca para un creador normal como Marta.

Daniel Restrepo (`u-creador`, fundador original de Comunidad del Intercambio antes de la reasignación a `admin@intercambio.app`) sigue existiendo como usuario — hoy con rol `alumno` — y queda como autor de posts/comentarios históricos de la comunidad; ya no tiene chip de demo propio.

La pantalla de login trae botones de acceso rápido para los 3 correos de arriba. Además, dentro de cualquier zona logueada hay un selector flotante abajo a la derecha (`UserSwitcher`) para saltar entre esos 3 usuarios semilla sin pasar por login.

### Flujo de invitación (demo end-to-end)

1. Como creador (`creador@intercambio.app`), entra a `/admin/accesos` y crea una invitación con un correo nuevo (no usado antes) y los cursos/curso a los que da acceso.
2. Copia el link generado (`/invitacion/[token]`) y ábrelo (puede ser en la misma sesión — `/invitacion` está excluida del guard que redirige a usuarios ya logueados).
3. La pantalla de invitación muestra a qué comunidad/cursos fue invitado; al completar nombre + contraseña (`aceptarInvitacion`) se crea el usuario, se inicia sesión con él y se redirige al área de miembros.
4. De vuelta en `/admin/accesos` como creador, la invitación pasa a estado "Aceptada".

## Mapa de rutas

Cuatro zonas, cada una con su propio `layout.tsx` que actúa de guard de rol (redirige si no corresponde) y muestra `FullScreenLoader` mientras el store persistido no ha hidratado:

- **`(auth)`** — públicas: `/login`, `/registro` (alta de creador), `/recuperar`, `/invitacion/[token]`.
- **`(miembro)`** — cualquier usuario logueado. `/perfil` vive a nivel de grupo; todo lo demás cuelga de `/c/[comunidad]/...`: `inicio` (feed), `cursos`, `cursos/[curso]`, `cursos/[curso]/leccion/[id]`, `calendario`, `miembros`, `ranking`.
- **`(creador)`** — rol `creador` o `superadmin` (el superadmin también puede entrar a administrar el admin de su propia comunidad, hoy "Comunidad del Intercambio"). `/admin` (dashboard), `/admin/cursos`, `/admin/cursos/[curso]` (editor con módulos/lecciones + campo Vimeo), `/admin/alumnos`, `/admin/accesos` (invitaciones), `/admin/comunidad` (posts/categorías/niveles), `/admin/eventos`, `/admin/reportes`, `/admin/configuracion`. El sidebar agrega un item "Panel plataforma" (`/plataforma`) solo si el usuario es `superadmin`.
- **`(superadmin)`** — solo rol `superadmin`. `/plataforma` (dashboard), `/plataforma/comunidades`, `/plataforma/creadores`, `/plataforma/planes`. El sidebar agrega un item "Mi academia" (`/admin`) solo si ese superadmin es dueño de alguna comunidad (`ownerId`).

## Arquitectura: mocks → hooks → páginas

```
src/lib/mocks/*.ts   →   src/lib/hooks/*.ts   →   páginas/componentes (src/app, src/components)
                              ↑
                       src/lib/store.ts (Zustand)
```

- **`src/lib/mocks/`** es la única fuente de datos "de servidor" (usuarios, comunidades, cursos, posts, eventos, planes, fechas relativas al día de la demo). Son arrays/objetos TypeScript tipados con `src/lib/types.ts`.
- **`src/lib/store.ts`** es el único estado mutable: sesión activa, invitaciones creadas/aceptadas, progreso de lecciones, posts/comentarios/likes creados en la demo, comunidades registradas en runtime, overrides de edición (niveles, categorías, color de acento, etc.). Persiste en `localStorage` bajo la clave `intercambio-v1` (Zustand `persist`).
- **`src/lib/hooks/`** (ver `src/lib/hooks/index.ts` para el listado completo — `useSession`, `useCourses`, `useFeed`, `useMembers`, `useGamification`, `usePlatform`, etc.) son el único punto donde un componente toca datos: mergean mock + store y devuelven la forma ya lista para pintar (progreso calculado, acceso resuelto, ranking ordenado...).
- **Regla dura del proyecto:** ningún componente de `src/components` ni página de `src/app` importa `src/lib/mocks` directamente — siempre pasa por un hook, con tres excepciones puntuales que aplican los mismos resolvers de `src/lib/store.ts`/`src/lib/hooks/` sobre el mock en línea en vez de vía un hook dedicado: `src/components/shared/user-switcher.tsx` (lista de usuarios semilla para saltar de sesión), `src/app/(creador)/admin/reportes/page.tsx` (enrollments para las métricas del reporte) y `src/app/(miembro)/perfil/page.tsx` (nombre de la comunidad del usuario).

### Dónde conectará el backend real

Ese árbol de hooks es la costura (*seam*) pensada para reemplazar mocks por datos reales sin tocar una sola página:

- **Supabase** (auth + Postgres): reemplazaría `src/lib/store.ts` (sesión, invitaciones, progreso, posts) y las lecturas mock de `src/lib/mocks/*.ts` — los hooks pasarían de leer arrays en memoria a hacer queries/consultas en tiempo real, manteniendo la misma forma de retorno.
- **API de Vimeo**: hoy `src/lib/vimeo.ts` solo extrae el ID de una URL pegada a mano en `VimeoField` (`src/components/admin/vimeo-field.tsx`). Una integración real cambiaría ese campo por un flujo de upload/OAuth contra la API de Vimeo, pero el resto del reproductor (`src/components/course/vimeo-player.tsx`, embed por iframe) no cambia.
- **Emails transaccionales** (invitación, recuperar contraseña): hoy `/recuperar` y la creación de invitaciones en `/admin/accesos` no envían nada — solo generan el link/token y lo muestran en pantalla para copiar. Un proveedor real (Resend, Postmark, etc.) se conectaría en `useAppStore` donde hoy se crea la invitación/token.

## Limitaciones conocidas

- **Sin backend real**: todo vive en `localStorage` del navegador. Borrar el storage del sitio reinicia la demo a su estado semilla.
- **`prefers-reduced-motion` parcial**: los `template.tsx` de transición de página (`(miembro)`, `(creador)`, `(superadmin)`, ver `src/components/shared/page-transition.tsx`) respetan la preferencia y no animan si está activa. El resto de animaciones de Framer Motion del proyecto (cards, confetti, contadores animados, barra de progreso, etc.) **no** la respeta todavía.
- **Sin envío de correo real**: invitaciones y recuperación de contraseña muestran el link/mensaje en pantalla en vez de enviarlo.
- **Precios y métricas simuladas**: MRR, crecimiento mensual y reportes en `/plataforma` y `/admin/reportes` se calculan sobre los datos mock, no sobre transacciones reales.
- **`shadcn` como devDependency**: `globals.css` importa `shadcn/tailwind.css`, resuelto por Tailwind/PostCSS en build time; el paquete no se necesita en runtime después de `next build`, así que vive en `devDependencies`.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Zustand + Framer Motion, gestor de paquetes `bun`.
