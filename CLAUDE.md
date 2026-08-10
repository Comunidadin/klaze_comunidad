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

## El código y la interfaz usan palabras distintas

Esto se lee una vez y ahorra mucha confusión:

| En el código y la base | En la interfaz |
|---|---|
| `curso` / `Course` | **módulo** |
| `modulo` / `CourseModule` | **submódulo** |
| `leccion` / `Lesson` | **clase** |

El vocabulario de la interfaz es el que usa el dueño de la plataforma, que
viene de Hotmart Club. El del código es el que ya tenían las tablas, las
políticas, las rutas y las 127 pruebas: renombrarlo habría sido una migración
enorme a cambio de nada que se vea.

**Las rutas siguen el código, no la interfaz**: `/admin/cursos` es la lista de
vitrinas, y `/c/{slug}/cursos/{curso}/modulo/{id}` es una clase dentro de un
curso. Un enlace que diga `/admin/vitrinas` da 404 — pasó al hacer el
renombrado.

Al escribir copy nueva, usa las palabras de la derecha.

Este vocabulario cambió dos veces (`vitrina/curso/clase` fue un intento previo).
Si vuelve a cambiar, renombra **solo dentro de cadenas y texto JSX**, y cuenta
con tres trampas que ya mordieron: líneas que llevan `className` y texto en la
misma línea, texto suelto en su propia línea entre `<h1>` y `</h1>`, y cadenas
que parecen copy pero son **claves de objeto** o **rutas**.

## Regla dura: supabase → hooks → páginas

```
src/lib/supabase/*.ts  →  src/lib/hooks/*.ts  →  src/app/** y src/components/**
                                 ↑
                    src/lib/store.ts (solo estado de interfaz)
```

**Ningún componente ni página consulta Supabase directamente.** Todo dato pasa por un hook de `src/lib/hooks/` (ver `src/lib/hooks/index.ts` para el listado completo), que llama a un módulo de `src/lib/supabase/` y devuelve la forma ya lista para pintar.

`src/lib/mocks/` ya no existe: se borró al migrar `/plataforma`, cuando dejó de tener un solo consumidor. Si encuentras una referencia a esa carpeta en un comentario, es un fósil — bórralo.

## Resolvers centrales — extiéndelos, no los rodees

El control de acceso vive en las políticas de Postgres, y su punto único de verdad son las funciones del esquema `privado`. Ninguna consulta las puede rodear, que es justo la razón de tenerlas ahí:

- `inscrito_en(comunidad)` — ¿tiene inscripción activa? Guarda la **fila** de la academia.
- `pertenece_a(comunidad)` — eso **y** que la academia esté activa. Guarda el **contenido**.
- `es_propietario_de(comunidad)` — dueño de una academia **activa**.
- `cubre_curso(curso)` — "este acceso incluye este curso", y el curso está publicado.
- `es_superadmin()` — lee `app_metadata.rol`. Nunca `user_metadata`.
- `comparte_comunidad_con(usuario)` / `administra_a(usuario)` — quién puede ver el perfil de quién.

**Suspender DEBE revocar acceso real, no solo cambiar un badge.** Vale para un alumno y vale para una academia entera. La división entre `inscrito_en` y `pertenece_a` existe por eso: si suspender quitara también la lectura de la fila, la app no podría distinguir "suspendida" de "no existe" y enseñaría "Comunidad no encontrada" — que es el callejón sin salida que ya apareció una vez aquí.

Del lado de TypeScript queda `enrollmentCubreCurso(...)` / `cursoIdsCubreCurso(...)` en `store.ts`, y `cursosVisiblesParaMiembro(...)` en `use-courses.ts`.

Si agregas un consumidor nuevo, **llama al resolver en vez de repetir su condición**. Cada bug importante de este repo fue un consumidor que re-derivó la lógica por su cuenta — y la política de `cursos`, que comprobaba `propietario_id` en línea, se quedó fuera del arreglo de la suspensión por exactamente eso.

## Base de datos

El esquema vive en `supabase/migrations/`. Ver las specs en `docs/superpowers/specs/`.

```bash
supabase migration new <nombre>   # crea el archivo SQL
bun run db:push                   # aplica lo pendiente al proyecto alojado
bun run test                      # todas las pruebas — deben quedar verdes
bun run test:rls                  # solo las que tocan la base
```

`bun run test` es el que hay que correr antes de terminar: `test:rls` se salta
`tests/*.test.ts`, que son las de lógica pura (`slug`) y no necesitan base.

- **No hay base local** (esta máquina no tiene Docker): las migraciones van al proyecto alojado. `bun run db:push` conecta directo a Postgres y registra cada migración en `supabase_migrations.schema_migrations`, así que `supabase db push` sigue siendo válido si alguien enlaza la CLI.
- **RLS activado en toda tabla nueva, en su misma migración**, nunca después. Y `grant` explícito: crear una tabla por SQL no la expone al API sola.
- Toda función `security definer` lleva `set search_path = ''` y referencia tablas con esquema explícito. `tests/rls/auditoria.test.ts` lo verifica en cada ejecución.
- **Nunca uses `user_metadata` para decidir permisos** — el propio usuario lo edita desde el navegador. Los roles van en `app_metadata`.
- **Toda tabla necesita política de escritura, no solo de lectura.** El cimiento dejó seis a medias y nadie podía escribir en ellas; `tests/rls/auditoria.test.ts` (A2b) lo vigila desde entonces.
- **RLS no lanza: filtra.** Un `insert`/`update` rechazado por política vuelve sin error y sin filas. Los módulos de `src/lib/supabase/` comprueban `data.length === 0` y lanzan — devolverlo en silencio haría creer que se guardó.
- Al leer relaciones anidadas, **nombra la clave foránea** (`perfiles!publicaciones_autor_id_fkey`). Varias tablas apuntan a `perfiles`, y sin el nombre PostgREST falla con "more than one relationship was found".

## El store ya no guarda datos de dominio

Zustand conserva **solo estado de interfaz**: `armazon` (lo que trajo el servidor al entrar) y `espaciosVistos` (qué espacios has leído en ESTE navegador). Nada más. Todo el dominio vive en Postgres y se lee por los módulos de `src/lib/supabase/`.

Si vuelves a necesitar guardar algo de dominio aquí, párate: casi siempre significa que falta una tabla o una consulta. Los mapas de "overrides" que hubo en este archivo eran cada uno un sitio donde la app podía discrepar de la base.

**El feed es el único que no viaja en el armazón**: crece sin techo, así que `useFeed` pagina **por fecha** (`creado_el < ultimaVista`). No lo cambies a páginas numeradas — con una publicación nueva de por medio, la última de una página reaparece en la siguiente. La publicación fijada va fuera de la paginación, o desaparecería en cuanto hubiera 20 más nuevas.

**Los puntos los otorga un trigger** sobre `progreso` (10 por lección). No los sumes desde la app: el trigger cubre también el borrado de lecciones, que es donde se descuadran.

**`setState` nunca síncrono dentro de un efecto.** El patrón del proyecto es una función `async` cuyo `.then()` fija el estado, aunque alguna rama no espere nada. Ver `useFeed`, `useEspacios` o `/callback`.

## Determinismo

- **IDs de entidades que viven en Postgres** (cursos, módulos, lecciones): `crypto.randomUUID()` en el navegador. Los contadores del store (`siguienteCursoId`, `siguienteModuloId`, `siguienteLeccionId`) se retiraron al migrar: eran deterministas para la demo, pero con datos reales dos personas editando a la vez generarían el mismo `curso-4` y una pisaría a la otra. Generarlos en el cliente —en vez de dejar que los ponga la base— permite que el editor monte el curso entero en memoria y lo guarde de una vez, sin identificadores provisionales.
- **IDs de lo que sigue en el store** (posts, invitaciones, eventos): contadores persistidos (`proximoInviteId`, `proximoPostId`, `proximoEventoId`). Nunca `array.length + 1`: colisiona tras eliminar. Migrarán a UUID cuando esas entidades pasen a la base.
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
