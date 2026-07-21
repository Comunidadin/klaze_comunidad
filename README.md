# Klaze V2

Demo de frontend de **Klaze**, una plataforma de gestión de cursos en video y comunidades estilo Skool / Cademi / Hotmart Club. Es **multi-creador**: cada creador tiene su propia comunidad con cursos, feed, calendario y gamificación; el dueño de Klaze administra la plataforma completa desde un panel super-admin.

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
| `alumno@klaze.app` | Alumno | `/c/academia-klaze/inicio` (miembro de "Academia Klaze") |
| `creador@klaze.app` | Creador | `/admin` (dueño de "Academia Klaze") |
| `admin@klaze.app` | Super-admin | `/plataforma` |

Un cuarto usuario útil para probar estados vacíos: `marta@klaze.app` (creadora de la segunda comunidad, "Inglés con Marta" — `/c/ingles-con-marta`, mucho menos contenido que la comunidad principal).

La pantalla de login trae botones de acceso rápido para los 3 correos de arriba. Además, dentro de cualquier zona logueada hay un selector flotante abajo a la derecha (`UserSwitcher`) para saltar entre los 3 usuarios semilla sin pasar por login.

### Flujo de invitación (demo end-to-end)

1. Como creador (`creador@klaze.app`), entra a `/admin/accesos` y crea una invitación con un correo nuevo (no usado antes) y los cursos/curso a los que da acceso.
2. Copia el link generado (`/invitacion/[token]`) y ábrelo (puede ser en la misma sesión — `/invitacion` está excluida del guard que redirige a usuarios ya logueados).
3. La pantalla de invitación muestra a qué comunidad/cursos fue invitado; al completar nombre + contraseña (`aceptarInvitacion`) se crea el usuario, se inicia sesión con él y se redirige al área de miembros.
4. De vuelta en `/admin/accesos` como creador, la invitación pasa a estado "Aceptada".

## Mapa de rutas

Cuatro zonas, cada una con su propio `layout.tsx` que actúa de guard de rol (redirige si no corresponde) y muestra `FullScreenLoader` mientras el store persistido no ha hidratado:

- **`(auth)`** — públicas: `/login`, `/registro` (alta de creador), `/recuperar`, `/invitacion/[token]`.
- **`(miembro)`** — cualquier usuario logueado. `/perfil` vive a nivel de grupo; todo lo demás cuelga de `/c/[comunidad]/...`: `inicio` (feed), `cursos`, `cursos/[curso]`, `cursos/[curso]/leccion/[id]`, `calendario`, `miembros`, `ranking`.
- **`(creador)`** — solo rol `creador`. `/admin` (dashboard), `/admin/cursos`, `/admin/cursos/[curso]` (editor con módulos/lecciones + campo Vimeo), `/admin/alumnos`, `/admin/accesos` (invitaciones), `/admin/comunidad` (posts/categorías/niveles), `/admin/eventos`, `/admin/reportes`, `/admin/configuracion`.
- **`(superadmin)`** — solo rol `superadmin`. `/plataforma` (dashboard), `/plataforma/comunidades`, `/plataforma/creadores`, `/plataforma/planes`.

## Arquitectura: mocks → hooks → páginas

```
src/lib/mocks/*.ts   →   src/lib/hooks/*.ts   →   páginas/componentes (src/app, src/components)
                              ↑
                       src/lib/store.ts (Zustand)
```

- **`src/lib/mocks/`** es la única fuente de datos "de servidor" (usuarios, comunidades, cursos, posts, eventos, planes, fechas relativas al día de la demo). Son arrays/objetos TypeScript tipados con `src/lib/types.ts`.
- **`src/lib/store.ts`** es el único estado mutable: sesión activa, invitaciones creadas/aceptadas, progreso de lecciones, posts/comentarios/likes creados en la demo, comunidades registradas en runtime, overrides de edición (niveles, categorías, color de acento, etc.). Persiste en `localStorage` bajo la clave `klaze-v2` (Zustand `persist`).
- **`src/lib/hooks/`** (ver `src/lib/hooks/index.ts` para el listado completo — `useSession`, `useCourses`, `useFeed`, `useMembers`, `useGamification`, `usePlatform`, etc.) son el único punto donde un componente toca datos: mergean mock + store y devuelven la forma ya lista para pintar (progreso calculado, acceso resuelto, ranking ordenado...).
- **Regla dura del proyecto:** ningún componente de `src/components` ni página de `src/app` importa `src/lib/mocks` directamente — siempre pasa por un hook.

### Dónde conectará el backend real

Ese árbol de hooks es la costura (*seam*) pensada para reemplazar mocks por datos reales sin tocar una sola página:

- **Supabase** (auth + Postgres): reemplazaría `src/lib/store.ts` (sesión, invitaciones, progreso, posts) y las lecturas mock de `src/lib/mocks/*.ts` — los hooks pasarían de leer arrays en memoria a hacer queries/consultas en tiempo real, manteniendo la misma forma de retorno.
- **API de Vimeo**: hoy `src/lib/vimeo.ts` solo extrae el ID de una URL pegada a mano en `VimeoField` (`src/components/admin/vimeo-field.tsx`). Una integración real cambiaría ese campo por un flujo de upload/OAuth contra la API de Vimeo, pero el resto del reproductor (`src/components/course/vimeo-player.tsx`, embed por iframe) no cambia.
- **Emails transaccionales** (invitación, recuperar contraseña): hoy `/recuperar` y la creación de invitaciones en `/admin/accesos` no envían nada — solo generan el link/token y lo muestran en pantalla para copiar. Un proveedor real (Resend, Postmark, etc.) se conectaría en `useKlazeStore` donde hoy se crea la invitación/token.

## Limitaciones conocidas

- **Sin backend real**: todo vive en `localStorage` del navegador. Borrar el storage del sitio reinicia la demo a su estado semilla.
- **`prefers-reduced-motion` parcial**: los `template.tsx` de transición de página (`(miembro)`, `(creador)`, `(superadmin)`, ver `src/components/shared/page-transition.tsx`) respetan la preferencia y no animan si está activa. El resto de animaciones de Framer Motion del proyecto (cards, confetti, contadores animados, barra de progreso, etc.) **no** la respeta todavía.
- **Sin envío de correo real**: invitaciones y recuperación de contraseña muestran el link/mensaje en pantalla en vez de enviarlo.
- **Precios y métricas simuladas**: MRR, crecimiento mensual y reportes en `/plataforma` y `/admin/reportes` se calculan sobre los datos mock, no sobre transacciones reales.
- **`shadcn` como devDependency**: `globals.css` importa `shadcn/tailwind.css`, resuelto por Tailwind/PostCSS en build time; el paquete no se necesita en runtime después de `next build`, así que vive en `devDependencies`.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Zustand + Framer Motion, gestor de paquetes `bun`.
