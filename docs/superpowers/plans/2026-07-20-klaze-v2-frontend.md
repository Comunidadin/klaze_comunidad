# Klaze V2 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend completo de Klaze V2 — plataforma multi-creador de cursos + comunidad estilo Skool — con datos mock, sesión simulada y flujo de invitación por correo funcional de punta a punta, sin backend.

**Architecture:** Next.js App Router con 4 route groups por rol (`(auth)`, `(miembro)`, `(creador)`, `(superadmin)`). Los componentes consumen datos SOLO a través de hooks (`src/lib/hooks/`) que combinan mocks estáticos (`src/lib/mocks/`) con estado mutable persistido en Zustand+localStorage. Al llegar el backend se reescriben los hooks sin tocar UI.

**Tech Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Zustand (persist) + Framer Motion + embed de Vimeo. Gestor de paquetes: `bun`.

## Global Constraints

- Toda la UI, copy, nombres de variables de dominio visibles y commits en **español** (código/identificadores técnicos en inglés está bien).
- Spec de referencia: `docs/superpowers/specs/2026-07-20-klaze-v2-frontend-design.md`.
- **Cero backend**: nada de fetch a APIs, nada de variables de entorno de servicios. Vimeo solo por iframe embed.
- Los componentes de página **nunca importan de `src/lib/mocks/` directamente** — siempre a través de hooks de `src/lib/hooks/`.
- Modo oscuro obligatorio en toda pantalla nueva (tokens CSS, clase `dark`).
- Paleta: neutros cálidos + índigo primario + acento lima. Fuentes: Space Grotesk (display) + Inter (UI) vía `next/font/google`.
- Gestor: `bun` / `bunx`. Verificación estándar de cada tarea: `bun run build` sin errores y revisión visual con `bun run dev`.
- Commits frecuentes con prefijos `feat:`/`fix:`/`docs:` en español, con la línea `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Al implementar pantallas, usar la skill `frontend-design:frontend-design` para dirección visual (evitar look genérico shadcn).

---

## Fase 1 — Fundación

### Task 1: Scaffold + tokens de diseño

**Files:**
- Create: proyecto Next.js completo en la raíz del repo (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`)
- Create: `components.json` (shadcn), `src/lib/utils.ts`, `src/components/ui/*` (shadcn base)

**Interfaces:**
- Produces: tokens CSS (`--background`, `--foreground`, `--primary` índigo, `--accent` lima, `--card`, `--muted`, `--border`, `--radius`), fuentes `--font-display` (Space Grotesk) y `--font-sans` (Inter), clase `dark` funcional.

- [ ] **Step 1: Scaffold del proyecto**

```bash
cd "/Users/joffrellerena/Desktop/[Claude Code V2]/[Klaze V2]"
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --yes
bunx shadcn@latest init -y -b neutral
bunx shadcn@latest add button card input label badge avatar tabs dialog dropdown-menu select table textarea tooltip progress separator sheet switch sonner skeleton
bun add zustand framer-motion lucide-react
```

Nota: `create-next-app` en directorio no vacío puede quejarse por `docs/`; si lo hace, scaffoldear en carpeta temporal `.scaffold/`, mover contenido a la raíz (sin sobrescribir `docs/` ni `.git/`) y borrar `.scaffold/`.

- [ ] **Step 2: Fuentes y layout root**

En `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Klaze — Tu academia y comunidad en un solo lugar",
  description: "Plataforma de cursos en video y comunidades para creadores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Tokens Klaze en `globals.css`**

Sobrescribir los tokens de shadcn con la paleta Klaze (formato oklch, Tailwind v4 `@theme inline`). Valores base:

```css
:root {
  --background: oklch(0.985 0.004 85);      /* blanco roto cálido */
  --foreground: oklch(0.22 0.02 275);
  --card: oklch(1 0 0);
  --primary: oklch(0.45 0.19 275);           /* índigo profundo */
  --primary-foreground: oklch(0.98 0.01 275);
  --accent: oklch(0.85 0.21 128);            /* lima eléctrico */
  --accent-foreground: oklch(0.25 0.05 128);
  --muted: oklch(0.955 0.006 85);
  --muted-foreground: oklch(0.5 0.02 275);
  --border: oklch(0.91 0.008 85);
  --radius: 0.75rem;
}
.dark {
  --background: oklch(0.17 0.015 275);
  --foreground: oklch(0.95 0.008 85);
  --card: oklch(0.21 0.018 275);
  --primary: oklch(0.62 0.17 275);
  --primary-foreground: oklch(0.15 0.02 275);
  --accent: oklch(0.82 0.2 128);
  --accent-foreground: oklch(0.2 0.05 128);
  --muted: oklch(0.24 0.02 275);
  --muted-foreground: oklch(0.65 0.015 275);
  --border: oklch(0.28 0.02 275);
}
```

Añadir utilidades: `.font-display { font-family: var(--font-display); }` y números tabulares `.tabular-nums`.

- [ ] **Step 4: Página placeholder raíz**

`src/app/page.tsx` redirige a `/login` con `redirect("/login")` de `next/navigation` (la landing pública está fuera de alcance; la raíz siempre manda al login).

- [ ] **Step 5: Verificar build**

```bash
bun run build
```
Expected: build exitoso sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js + tokens de diseño Klaze V2"
```

### Task 2: Tipos de dominio y datos mock

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/mocks/users.ts`, `src/lib/mocks/communities.ts`, `src/lib/mocks/courses.ts`, `src/lib/mocks/posts.ts`, `src/lib/mocks/events.ts`, `src/lib/mocks/plans.ts`, `src/lib/mocks/index.ts`

**Interfaces:**
- Produces: todos los tipos y arrays mock que consumen los hooks de Task 3. Exporta desde `src/lib/mocks/index.ts`: `mockUsers`, `mockCommunities`, `mockCourses`, `mockPosts`, `mockEvents`, `mockPlans`.

- [ ] **Step 1: Escribir `src/lib/types.ts` completo**

```ts
export type UserRole = "alumno" | "creador" | "superadmin";

export interface User {
  id: string;
  email: string;
  nombre: string;
  avatarUrl: string;        // pravatar/dicebear determinístico
  bio: string;
  rol: UserRole;
  comunidadIds: string[];
  puntos: number;
  nivel: number;            // 1-9, derivado de puntos al sembrar
  creadoEl: string;         // ISO date
}

export interface Community {
  id: string;
  slug: string;             // "academia-klaze"
  nombre: string;
  descripcion: string;
  logoUrl: string;
  colorAcento: string;      // hex, personalización por comunidad
  ownerId: string;
  plan: "starter" | "pro" | "scale";
  estado: "activa" | "suspendida";
  nombresNiveles: string[]; // 9 nombres personalizables
  categorias: string[];     // ["Anuncios","General","Wins","Preguntas"]
  creadoEl: string;
}

export interface Course {
  id: string;
  comunidadId: string;
  slug: string;
  titulo: string;
  descripcion: string;
  portadaUrl: string;       // Unsplash
  precioReferencial: number; // USD, solo informativo
  nivelRequerido: number | null; // null = sin candado por nivel
  modulos: CourseModule[];
  publicado: boolean;
}

export interface CourseModule {
  id: string;
  titulo: string;
  orden: number;
  lecciones: Lesson[];
}

export interface Lesson {
  id: string;
  titulo: string;
  orden: number;
  tipo: "video" | "texto";
  vimeoId: string | null;   // solo tipo video
  duracionMin: number;
  contenido: string;        // descripción o cuerpo de texto
  recursos: { nombre: string; url: string }[];
}

export interface Enrollment {
  id: string;
  userId: string;
  comunidadId: string;
  cursoIds: string[] | "todos";
  estado: "invitado" | "activo" | "suspendido";
}

export interface Invitation {
  token: string;
  email: string;
  comunidadId: string;
  cursoIds: string[] | "todos";
  estado: "pendiente" | "aceptada";
  creadaEl: string;
}

export interface Post {
  id: string;
  comunidadId: string;
  autorId: string;
  categoria: string;
  titulo: string;
  cuerpo: string;
  fijado: boolean;
  likes: string[];          // userIds
  comentarios: PostComment[];
  creadoEl: string;
}

export interface PostComment {
  id: string;
  autorId: string;
  cuerpo: string;
  likes: string[];
  respuestas: PostComment[]; // solo 1 nivel de anidación extra (2 niveles total)
  creadoEl: string;
}

export interface CommunityEvent {
  id: string;
  comunidadId: string;
  titulo: string;
  descripcion: string;
  fechaInicio: string;      // ISO datetime
  duracionMin: number;
  urlSala: string;          // link mock de Zoom/Meet
}

export interface Plan {
  id: "starter" | "pro" | "scale";
  nombre: string;
  precioMes: number;
  limites: { comunidades: number; alumnos: number; cursos: number };
  destacado: boolean;
}

// Progreso vive solo en el store de sesión (localStorage), no en mocks:
export interface LessonProgress {
  userId: string;
  leccionId: string;
  completadaEl: string;
}
```

- [ ] **Step 2: Sembrar mocks**

Reglas concretas (código estático + helpers determinísticos, sin `Math.random`):

- `users.ts`: 3 usuarios semilla — `u-alumno` (`alumno@klaze.app`, rol alumno), `u-creador` (`creador@klaze.app`, rol creador, owner de la comunidad principal), `u-admin` (`admin@klaze.app`, rol superadmin) — más `u-creador2` (owner de la secundaria) y 24 miembros generados con un helper:

```ts
const NOMBRES = ["Valentina Ríos","Mateo Herrera","Camila Torres","Santiago Vega", /* …24 nombres */];
export const mockUsers: User[] = [
  ...seeds,
  ...NOMBRES.map((nombre, i) => ({
    id: `u-m${i + 1}`,
    email: `${nombre.split(" ")[0].toLowerCase()}${i + 1}@mail.com`,
    nombre,
    avatarUrl: `https://i.pravatar.cc/150?u=u-m${i + 1}`,
    bio: BIOS[i % BIOS.length],
    rol: "alumno" as const,
    comunidadIds: ["com-principal"],
    puntos: (i * 37) % 420,
    nivel: nivelPorPuntos((i * 37) % 420),
    creadoEl: fechaDeterministica(i),
  })),
];
```

- `communities.ts`: `com-principal` ("Academia Klaze", acento índigo por defecto, plan pro) y `com-esp` ("Inglés con Marta", acento `#F97316` naranja, plan starter, ~6 miembros propios). Niveles con nombres: ["Novato","Explorador","Aprendiz","Constructor","Práctico","Avanzado","Experto","Mentor","Leyenda"].
- `courses.ts`: comunidad principal con 3 cursos: (1) "Lanzamiento Digital Pro" — 4 módulos / 15 lecciones video con IDs reales públicos de Vimeo (usar IDs de canales demo públicos, p. ej. los staff picks 76979871, 148751763, 259411563, repetidos está bien) + 1 lección de texto + recursos PDF mock; (2) "Ventas por WhatsApp" — 2 módulos / 6 lecciones; (3) "Mentoría Élite" — `nivelRequerido: 3`, 1 módulo / 4 lecciones. Comunidad secundaria: 1 curso pequeño.
- `posts.ts`: 20 posts en la principal repartidos en las 4 categorías, 1 fijado ("📌 Bienvenido a Academia Klaze — empieza aquí"), con likes (arrays de userIds) y 2-5 comentarios en varios, algunos con respuestas anidadas. 3 posts en la secundaria.
- `events.ts`: 4 eventos futuros en la principal (fechas relativas a hoy generadas con helper `enDias(n)` que suma días a una fecha base constante `2026-07-20`), 1 en la secundaria.
- `plans.ts`: Starter $39, Pro $99 (destacado), Scale $249 con límites crecientes.
- Enrollments semilla en `communities.ts` o archivo propio: `u-alumno` activo en principal con cursos 1 y 2; los 24 miembros activos con "todos".

- [ ] **Step 3: Verificar tipos**

```bash
bun run build
```
Expected: compila; los mocks satisfacen los tipos sin `as any`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: tipos de dominio y datos mock (2 comunidades, 4 cursos, 23 posts)"
```

### Task 3: Store de sesión + hooks de datos + utilidad Vimeo

**Files:**
- Create: `src/lib/store.ts`
- Create: `src/lib/hooks/use-session.ts`, `use-community.ts`, `use-courses.ts`, `use-feed.ts`, `use-members.ts`, `use-invitations.ts`, `use-events.ts`, `use-gamification.ts`, `src/lib/hooks/index.ts`
- Create: `src/lib/vimeo.ts`
- Create: `src/lib/levels.ts`

**Interfaces:**
- Consumes: tipos y mocks de Task 2.
- Produces (firmas que usan TODAS las pantallas):

```ts
// store.ts — Zustand persist, key "klaze-v2"
interface KlazeState {
  currentUserId: string | null;
  usuariosCreados: User[];               // alumnos que aceptaron invitación
  invitaciones: Invitation[];
  enrollmentsExtra: Enrollment[];        // generados por invitaciones aceptadas
  progreso: LessonProgress[];
  postsCreados: Post[];
  likesDados: { postId: string; userId: string }[];
  comentariosCreados: { postId: string; comentario: PostComment; parentId: string | null }[];
  cursosEditados: Course[];              // overrides de cursos creados/editados en admin
  login: (email: string) => boolean;     // acepta cualquier password
  logout: () => void;
  crearInvitaciones: (emails: string[], comunidadId: string, cursoIds: string[] | "todos") => Invitation[];
  aceptarInvitacion: (token: string, nombre: string) => User | null;
  toggleLeccionCompleta: (leccionId: string) => void;
  crearPost: (post: Omit<Post, "id" | "creadoEl" | "likes" | "comentarios">) => void;
  toggleLike: (postId: string) => void;
  comentar: (postId: string, cuerpo: string, parentId: string | null) => void;
  guardarCurso: (curso: Course) => void;
}

// hooks (todos combinan mocks + store):
useSession(): { user: User | null; login; logout; }
useCommunity(slug: string): { community: Community; isOwner: boolean } | null
useCourses(comunidadId: string): { cursos: CourseConAcceso[] }   // CourseConAcceso = Course & { acceso: "si" | "candado-nivel" | "sin-acceso"; progresoPct: number }
useLesson(cursoId: string, leccionId: string): { leccion: Lesson; completada: boolean; toggle: () => void }
useFeed(comunidadId: string, categoria?: string): { posts: PostConAutor[] }
useMembers(comunidadId: string): { miembros: (User & { estado: Enrollment["estado"] })[] }
useInvitations(comunidadId: string): { invitaciones: Invitation[]; crear; }
useEvents(comunidadId: string): { eventos: CommunityEvent[] }
useGamification(comunidadId: string): { ranking: RankingEntry[]; miNivel: number; puntosParaSiguiente: number }

// vimeo.ts
extractVimeoId(input: string): string | null  // acepta "123", "vimeo.com/123", "https://vimeo.com/123?x=1", "player.vimeo.com/video/123"
vimeoEmbedUrl(id: string): string             // https://player.vimeo.com/video/{id}

// levels.ts
nivelPorPuntos(puntos: number): number        // umbrales: [0,20,65,155,315,515,815,1215,1715] → nivel 1..9
puntosParaNivel(nivel: number): number
```

- [ ] **Step 1: Implementar `levels.ts` y `vimeo.ts`** con las firmas de arriba, código completo.

- [ ] **Step 2: Implementar `store.ts`** con `zustand/middleware` `persist`. `login(email)` busca en `mockUsers` + `usuariosCreados` (case-insensitive); si no existe retorna `false`. `aceptarInvitacion` crea `User` alumno con id `u-inv-${token}`, marca invitación aceptada, agrega enrollment y hace login automático. Tokens de invitación: `inv-` + contador incremental persistido (`inv-1`, `inv-2`... — determinístico, sin random).

- [ ] **Step 3: Implementar los hooks** combinando mocks + store según firmas. `useCourses` calcula `acceso` cruzando enrollment del usuario actual + `nivelRequerido` vs nivel del usuario, y `progresoPct` con `progreso` del store. `useFeed` mergea `mockPosts` + `postsCreados` + likes/comentarios del store, ordena fijado primero y luego por fecha desc.

- [ ] **Step 4: Verificar**

```bash
bun run build
```
Expected: compila sin errores.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: store de sesión simulada, hooks de datos y utilidad Vimeo"
```

### Task 4: Componentes compartidos y shells

**Files:**
- Create: `src/components/shared/logo.tsx` (wordmark KLAZE con font-display + monograma "K" en índigo)
- Create: `src/components/shared/theme-toggle.tsx` (next-themes; `bun add next-themes`, ThemeProvider en root layout)
- Create: `src/components/shared/user-switcher.tsx` (pill flotante inferior-derecha: cambia entre los 3 usuarios semilla — solo demo)
- Create: `src/components/shared/empty-state.tsx` (`{ icono, titulo, descripcion, accion? }`)
- Create: `src/components/shared/level-badge.tsx` (badge hexagonal con número de nivel, acento lima)
- Create: `src/components/shells/member-shell.tsx` (header con logo comunidad + tabs Inicio·Cursos·Calendario·Miembros·Ranking + avatar menú)
- Create: `src/components/shells/admin-shell.tsx` (sidebar colapsable con secciones del admin; se reutiliza en superadmin con items distintos vía prop `items`)
- Create: `src/app/(miembro)/layout.tsx`, `src/app/(creador)/layout.tsx`, `src/app/(superadmin)/layout.tsx` — cada uno aplica su shell y **guard de rol**: si `useSession().user` es null → `redirect("/login")`; si el rol no corresponde → redirect a su home.

**Interfaces:**
- Consumes: `useSession`, `useCommunity` (Task 3).
- Produces: `<MemberShell communitySlug={...}>`, `<AdminShell items={NavItem[]} titulo={...}>`, `<EmptyState/>`, `<LevelBadge nivel={n}/>`, `<UserSwitcher/>` montado en los 3 layouts.

- [ ] **Step 1:** Implementar componentes con código completo y dark mode.
- [ ] **Step 2:** Guards de rol como client components (`"use client"`, `useEffect` + `router.replace` porque la sesión vive en localStorage).
- [ ] **Step 3:** `bun run build` → OK. Verificación visual: `bun run dev`, navegar a `/c/academia-klaze/inicio` sin sesión redirige a `/login`.
- [ ] **Step 4:** Commit `feat: shells de navegación, guards de rol y componentes compartidos`.

---

## Fase 2 — Auth simulado

### Task 5: Login, registro y recuperar

**Files:**
- Create: `src/app/(auth)/layout.tsx` (split-screen: panel izquierdo branding índigo con testimonial, derecho formulario)
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/registro/page.tsx`, `src/app/(auth)/recuperar/page.tsx`

**Interfaces:**
- Consumes: `useSession().login`.
- Produces: tras login exitoso redirige por rol: alumno → `/c/academia-klaze/inicio`, creador → `/admin`, superadmin → `/plataforma`.

- [ ] **Step 1:** Login: correo + contraseña (cualquier valor), error visible "No encontramos una cuenta con ese correo" si `login()` retorna false. Hint de demo bajo el form: chips clicables con los 3 correos semilla que autocompletan.
- [ ] **Step 2:** Registro de creador: nombre, correo, nombre de su comunidad → crea User rol creador + Community en el store (agregar acción `registrarCreador(nombre, email, nombreComunidad)` al store, slug generado con `slugify`) → entra a `/admin`.
- [ ] **Step 3:** Recuperar: pide correo → estado "📧 Te enviamos un enlace" (solo UI, sin lógica).
- [ ] **Step 4:** `bun run build` + verificación visual de los 3 flujos. Commit `feat: pantallas de login, registro de creador y recuperar contraseña`.

### Task 6: Invitación por token

**Files:**
- Create: `src/app/(auth)/invitacion/[token]/page.tsx`

**Interfaces:**
- Consumes: `store.invitaciones`, `store.aceptarInvitacion(token, nombre)`.
- Produces: página que Task 12 (Accesos) enlaza vía "copiar link".

- [ ] **Step 1:** Estados de la página: (a) token válido pendiente → logo+color de la comunidad, "Fuiste invitado a {curso(s) | toda la comunidad}", inputs nombre + contraseña, botón "Aceptar invitación y entrar"; (b) token inexistente → error amigable "Esta invitación no existe o expiró"; (c) token ya aceptado → "Esta invitación ya fue usada" con link a login.
- [ ] **Step 2:** Al aceptar: `aceptarInvitacion` → redirect a `/c/{slug}/cursos` con toast de bienvenida (sonner).
- [ ] **Step 3:** Prueba manual completa: en devtools llamar `crearInvitaciones` no — mejor: sembrar 1 invitación pendiente mock (`inv-demo`) en el estado inicial del store para poder probar `/invitacion/inv-demo` antes de que exista la pantalla de Accesos.
- [ ] **Step 4:** `bun run build` + visual. Commit `feat: flujo de invitación por token con creación de cuenta`.

---

## Fase 3 — Área de miembros

### Task 7: Classroom — grid de cursos y detalle

**Files:**
- Create: `src/app/(miembro)/c/[comunidad]/cursos/page.tsx`
- Create: `src/app/(miembro)/c/[comunidad]/cursos/[curso]/page.tsx`
- Create: `src/components/course/course-card.tsx` (portada, título, progreso perimetral SVG animado, candado con "Se desbloquea en nivel N" o "Sin acceso")

**Interfaces:**
- Consumes: `useCourses(comunidadId)` (`acceso`, `progresoPct`).
- Produces: `<CourseCard curso={CourseConAcceso}/>` reutilizado en admin (Task 11).

- [ ] **Step 1:** Grid responsivo (1/2/3 cols) con `CourseCard`; cursos bloqueados con overlay + candado; estado vacío con `EmptyState`.
- [ ] **Step 2:** Detalle: hero con portada, progreso global, acordeón de módulos → lecciones con check de completada, duración, icono video/texto; CTA "Continuar donde quedaste" (primera lección no completada).
- [ ] **Step 3:** `bun run build` + visual (probar candado por nivel con curso "Mentoría Élite"). Commit `feat: classroom con grid de cursos y detalle con módulos`.

### Task 8: Player de lección

**Files:**
- Create: `src/app/(miembro)/c/[comunidad]/cursos/[curso]/leccion/[id]/page.tsx`
- Create: `src/components/course/vimeo-player.tsx` (iframe responsivo 16:9, `vimeoEmbedUrl`)
- Create: `src/components/course/lesson-sidebar.tsx` (lista módulos/lecciones, actual resaltada, checks)

**Interfaces:**
- Consumes: `useLesson`, `extractVimeoId`, `vimeoEmbedUrl`.
- Produces: `<VimeoPlayer vimeoId={string}/>` reutilizado en preview del editor admin (Task 11).

- [ ] **Step 1:** Layout 2 columnas (player+contenido | sidebar; sidebar como Sheet en móvil). Lección tipo texto renderiza `contenido` con tipografía prose.
- [ ] **Step 2:** Botón "Marcar como completada" (toggle, acento lima, micro-animación de check con Framer Motion) + navegación anterior/siguiente. Al completar la última lección del curso → confetti (implementar `src/components/shared/confetti.tsx` con framer-motion, ~40 partículas CSS determinísticas).
- [ ] **Step 3:** Recursos descargables (lista con icono) + comentarios de lección (UI local no persistida está bien: lista + textarea, sembrar 2 comentarios mock por lección del curso 1).
- [ ] **Step 4:** `bun run build` + visual (video Vimeo reproduce). Commit `feat: player de lección con Vimeo, progreso y comentarios`.

### Task 9: Calendario, miembros y perfil

**Files:**
- Create: `src/app/(miembro)/c/[comunidad]/calendario/page.tsx`
- Create: `src/app/(miembro)/c/[comunidad]/miembros/page.tsx`
- Create: `src/app/(miembro)/perfil/page.tsx`
- Create: `src/components/community/member-card.tsx`, `src/components/community/event-card.tsx`

**Interfaces:**
- Consumes: `useEvents`, `useMembers`, `useSession`, `useGamification`.

- [ ] **Step 1:** Calendario: lista mensual agrupada por día (no grid de calendario — YAGNI), `EventCard` con fecha grande, hora, duración, botón "Agregar a mi calendario" (genera archivo .ics con Blob + download) y "Entrar a la sala" (abre urlSala).
- [ ] **Step 2:** Miembros: buscador por nombre (filtrado client-side), grid de `MemberCard` (avatar, nivel con `LevelBadge`, bio corta); click abre Dialog con perfil (bio completa, puntos, fecha de ingreso).
- [ ] **Step 3:** Perfil propio: editar nombre/bio (persistir en store: acción `actualizarPerfil`), avatar, tarjeta de nivel con barra "te faltan X puntos para {nombre nivel siguiente}", toggle de tema, botón cerrar sesión.
- [ ] **Step 4:** `bun run build` + visual. Commit `feat: calendario de eventos, directorio de miembros y perfil`.

---

## Fase 4 — Comunidad

### Task 10: Feed, crear post y detalle con comentarios

**Files:**
- Create: `src/app/(miembro)/c/[comunidad]/inicio/page.tsx`
- Create: `src/components/community/post-card.tsx`, `post-composer.tsx`, `comment-thread.tsx`, `category-tabs.tsx`

**Interfaces:**
- Consumes: `useFeed`, `store.crearPost/toggleLike/comentar`.
- Produces: `<PostCard/>` reutilizado en moderación admin (Task 13).

- [ ] **Step 1:** Feed: tabs de categorías (Todas + 4), post fijado arriba con estilo distintivo (borde índigo + 📌), composer colapsado ("¿Qué quieres compartir?") que expande a título+cuerpo+categoría.
- [ ] **Step 2:** `PostCard`: autor con `LevelBadge`, tiempo relativo ("hace 2 días" — helper `tiempoRelativo(iso)` propio, sin librería), like animado (contador con spring), comentarios expandibles inline con `CommentThread` (2 niveles, responder solo a comentarios raíz).
- [ ] **Step 3:** Crear post/like/comentar persisten vía store y aparecen inmediatamente (probar con usuario alumno). Estado vacío por categoría.
- [ ] **Step 4:** `bun run build` + visual. Commit `feat: feed de comunidad con posts, likes y comentarios anidados`.

### Task 11: Gamificación y ranking

**Files:**
- Create: `src/app/(miembro)/c/[comunidad]/ranking/page.tsx`
- Modify: `src/lib/hooks/use-gamification.ts` (completar ranking por periodo)

**Interfaces:**
- Consumes: `useGamification` → `ranking: { user: User; puntos: number; posicion: number; delta: "up" | "down" | "same" }[]` por periodo `"7d" | "30d" | "total"` (7d/30d: derivar determinísticamente como porcentaje fijo del total, p. ej. 15% y 45% redondeado — es mock).

- [ ] **Step 1:** Página ranking: tabs 7 días / 30 días / Total, top 3 destacados con podio, mi posición resaltada sticky, contador animado de puntos (framer-motion `animate`).
- [ ] **Step 2:** Tarjeta lateral "Cómo ganar puntos" (1 like recibido = 1 punto) + lista de los 9 niveles con sus nombres y umbrales, nivel actual resaltado.
- [ ] **Step 3:** `bun run build` + visual. Commit `feat: ranking con periodos y sistema de niveles`.

---

## Fase 5 — Admin del creador

### Task 12: Shell admin, dashboard, alumnos y accesos

**Files:**
- Create: `src/app/(creador)/admin/page.tsx` (dashboard)
- Create: `src/app/(creador)/admin/alumnos/page.tsx`
- Create: `src/app/(creador)/admin/accesos/page.tsx`
- Create: `src/components/admin/stat-card.tsx` (métrica con número tabular + spark delta)

**Interfaces:**
- Consumes: `useMembers`, `useInvitations`, `useCourses`, `AdminShell` con items: Dashboard, Cursos, Alumnos, Accesos, Comunidad, Eventos, Reportes, Configuración.
- Produces: `<StatCard titulo valor delta/>` reutilizado en reportes y superadmin.

- [ ] **Step 1:** Dashboard: 4 StatCards (alumnos activos, cursos publicados, posts esta semana, invitaciones pendientes) + tabla "Últimos accesos otorgados" + accesos rápidos.
- [ ] **Step 2:** Alumnos: tabla (avatar, nombre, correo, estado badge, progreso promedio %, fecha ingreso) con buscador y filtro por estado; acción suspender/reactivar (acción de store `cambiarEstadoAlumno`).
- [ ] **Step 3:** **Accesos** (pantalla clave): textarea "Correos (uno por línea o separados por coma)" con validación de formato por correo (regex, muestra inválidos en rojo), selector de cursos (checkboxes + "Toda la comunidad"), botón "Enviar invitaciones" → toast "📧 X invitaciones enviadas" → tabla de invitaciones (correo, cursos, estado Pendiente/Aceptada, botón "Copiar link" con `navigator.clipboard` + tooltip "¡Copiado!").
- [ ] **Step 4:** Prueba E2E manual del flujo central: crear invitación como creador → copiar link → abrir en la misma sesión → aceptar → verificar que el alumno entra a sus cursos y el admin la muestra Aceptada/Activo.
- [ ] **Step 5:** `bun run build` + visual. Commit `feat: admin dashboard, alumnos y flujo de accesos por correo`.

### Task 13: Cursos admin + editor con Vimeo

**Files:**
- Create: `src/app/(creador)/admin/cursos/page.tsx` (lista + Dialog crear con título/descripción/precio/portada por URL)
- Create: `src/app/(creador)/admin/cursos/[curso]/page.tsx` (editor)
- Create: `src/components/admin/lesson-editor.tsx`, `src/components/admin/vimeo-field.tsx`

**Interfaces:**
- Consumes: `store.guardarCurso`, `extractVimeoId`, `<VimeoPlayer/>` (Task 8).
- Produces: editor completo de estructura de curso.

- [ ] **Step 1:** Lista de cursos con `CourseCard` variante admin (badge publicado/borrador, alumnos con acceso) + crear curso.
- [ ] **Step 2:** Editor: columna izquierda con módulos/lecciones reordenables (botones subir/bajar — drag & drop nativo HTML5 opcional, botones son suficiente base), agregar/renombrar/eliminar módulo y lección; columna derecha `LessonEditor` de la lección seleccionada.
- [ ] **Step 3:** `VimeoField`: input "Pega la URL o ID de Vimeo" → `extractVimeoId` en onChange → si válido, preview `<VimeoPlayer/>` inmediato + badge "✓ Video vinculado"; si inválido, mensaje "No parece un enlace de Vimeo válido"; estado vacío con instrucciones "Sube tu video a Vimeo y pega aquí el enlace". Campos: título, tipo video/texto, contenido, duración, recursos (nombre+URL, agregar/quitar).
- [ ] **Step 4:** Guardar persiste vía `guardarCurso` (override en store); verificar que el cambio se ve como alumno.
- [ ] **Step 5:** `bun run build` + visual. Commit `feat: gestión de cursos y editor de lecciones con vínculo Vimeo`.

### Task 14: Comunidad admin, eventos, reportes y configuración

**Files:**
- Create: `src/app/(creador)/admin/comunidad/page.tsx` (tabs: Posts / Categorías / Niveles — moderación con eliminar/fijar post [acciones store `eliminarPost`, `fijarPost`], CRUD de categorías, editar nombres de los 9 niveles)
- Create: `src/app/(creador)/admin/eventos/page.tsx` (lista + Dialog crear/editar evento, acción store `guardarEvento`)
- Create: `src/app/(creador)/admin/reportes/page.tsx`
- Create: `src/app/(creador)/admin/configuracion/page.tsx` (nombre, logo URL, color de acento con input color — persistir override de comunidad en store `guardarComunidad`; ver cambio reflejado en shell del miembro)
- Create: `src/components/admin/bar-chart.tsx` (barras CSS puras con animación, sin librería de charts)

**Interfaces:**
- Consumes: `useFeed`, `useEvents`, `useMembers`, `useGamification`, `StatCard`, `BarChart`.

- [ ] **Step 1:** Comunidad (moderación/categorías/niveles) con confirmación al eliminar (Dialog).
- [ ] **Step 2:** Eventos CRUD.
- [ ] **Step 3:** Reportes: `BarChart` "Lecciones completadas por semana" (derivado del progreso), top 5 alumnos más activos, top 5 lecciones más vistas (mock determinístico), % promedio de avance por curso.
- [ ] **Step 4:** Configuración con preview en vivo del color de acento.
- [ ] **Step 5:** `bun run build` + visual. Commit `feat: moderación, eventos, reportes y configuración del admin`.

---

## Fase 6 — Super-admin y pulido

### Task 15: Panel plataforma

**Files:**
- Create: `src/app/(superadmin)/plataforma/page.tsx` (dashboard: comunidades activas, creadores, alumnos totales, MRR simulado = suma de precioMes por comunidad según plan; StatCards + BarChart crecimiento mensual mock)
- Create: `src/app/(superadmin)/plataforma/comunidades/page.tsx` (tabla: nombre, dueño, plan badge, miembros, estado; acción suspender/activar → store `cambiarEstadoComunidad`; comunidad suspendida muestra pantalla de bloqueo a sus miembros — agregar check en `member-shell`)
- Create: `src/app/(superadmin)/plataforma/creadores/page.tsx` (tabla de creadores con sus comunidades)
- Create: `src/app/(superadmin)/plataforma/planes/page.tsx` (3 tarjetas de plan editables: precio y límites → store `guardarPlan`)

**Interfaces:**
- Consumes: `mockPlans` vía hook nuevo `usePlatform()` (comunidades + creadores + planes + métricas agregadas).

- [ ] **Step 1:** Implementar `usePlatform()` + las 4 páginas con `AdminShell` (items: Dashboard, Comunidades, Creadores, Planes).
- [ ] **Step 2:** Verificar suspensión: suspender comunidad → login como alumno → pantalla "Esta comunidad está temporalmente suspendida".
- [ ] **Step 3:** `bun run build` + visual. Commit `feat: panel super-admin de plataforma`.

### Task 16: Pulido final y README

**Files:**
- Modify: pantallas existentes (pasada de QA)
- Create: `README.md`

- [ ] **Step 1:** Pasada completa de QA visual en dark mode de las ~28 pantallas; corregir contrastes/tokens rotos.
- [ ] **Step 2:** Verificar todos los estados vacíos y skeletons (agregar `loading.tsx` con skeletons en rutas principales de miembro y admin).
- [ ] **Step 3:** Microinteracciones pendientes: transición de página sutil (template.tsx con framer-motion fade/slide 150ms), hover states consistentes.
- [ ] **Step 4:** README en español: qué es Klaze V2, usuarios semilla, cómo correr (`bun install && bun run dev`), mapa de rutas, arquitectura de mocks/hooks y cómo se conectará backend después.
- [ ] **Step 5:** `bun run build` final + `bun run lint`. Commit `docs: README y pulido final de la demo`.

---

## Self-Review (ejecutado)

- **Cobertura del spec:** auth 4 pantallas (T5-6) ✓; miembros 7 (T7-9) ✓; comunidad+gamificación (T10-11) ✓; admin 9 (T12-14: dashboard, cursos, editor, alumnos, accesos, comunidad, eventos, reportes, configuración) ✓; superadmin 4 (T15) ✓; flujo invitación E2E (T3+T6+T12) ✓; Vimeo embed+campo (T8+T13) ✓; estados vacíos/skeletons/validaciones (transversal + T16) ✓; identidad y dark mode (T1 + Global Constraints) ✓; personalización por comunidad (T14 configuración + colorAcento en tipos) ✓.
- **Tipos consistentes:** `CourseConAcceso`, `extractVimeoId`, `LevelBadge`, `StatCard`, `VimeoPlayer`, acciones del store — nombres únicos definidos una vez y referenciados igual en tareas posteriores.
- **Sin TDD:** el spec excluye tests automatizados; cada tarea cierra con `bun run build` + verificación visual definida.
