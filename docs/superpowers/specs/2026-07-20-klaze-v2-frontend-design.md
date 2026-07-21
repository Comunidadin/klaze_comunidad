# KLAZE V2 — Frontend completo (plataforma de gestión, solo UI)

**Fecha:** 2026-07-20
**Autor:** Joffre Llerena (vía Claude Code)
**Estado:** Aprobado — listo para plan de implementación
**Carpeta:** `/Users/joffrellerena/Desktop/[Claude Code V2]/[Klaze V2]/` (repo nuevo, branch main)

## Contexto

KLAZE V2 es una plataforma de gestión de cursos en video y comunidades, estilo Skool / Cademi / Hotmart Club. Es **multi-creador**: cada creador tiene su comunidad con cursos, feed, calendario y gamificación; el dueño de Klaze administra la plataforma desde un panel super-admin.

Este spec cubre **todo el frontend con datos mock, sin backend**. La venta ocurre fuera de la plataforma: el creador otorga acceso agregando el correo del alumno, quien recibe una invitación y crea su contraseña. Los videos se alojan en Vimeo y se integran por embed (el creador pega la URL/ID del video).

Proyecto independiente del KLAZE V1 (`[ClaudeCode]/[APP][KLAZE]`); se empieza desde cero con identidad visual nueva.

Idioma de toda la UI y la copy: **español**.

## Decisiones

| Tema | Decisión |
|------|----------|
| Punto de partida | Proyecto nuevo desde cero en `[Klaze V2]` |
| Modelo | Multi-creador (comunidades independientes por creador) |
| Módulos | Auth simulado, área de miembros, comunidad estilo Skool, admin del creador, super-admin |
| Ventas | Externa; acceso otorgado por correo desde el admin (sin checkout) |
| Auth | Flujo completo simulado: login, registro, recuperar, invitación por token |
| Video | Embed de Vimeo; el creador pega URL/ID en el editor de lección |
| Branding | Identidad V2 nueva (índigo + acento lima, modo oscuro) |
| Datos | Mocks tipados + sesión simulada persistida (Zustand + localStorage) |

## Arquitectura

### Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui, gestor `bun`
- Zustand con persistencia en `localStorage`: usuario actual, invitaciones creadas/aceptadas, progreso de lecciones, posts/likes/comentarios creados en la demo
- Framer Motion para animaciones y microinteracciones
- Player: iframe embed responsivo de Vimeo con controles nativos

### Rutas

```
src/app/
├── (auth)/
│   ├── login/                     # Correo + contraseña
│   ├── registro/                  # Registro de creador (crea su comunidad)
│   ├── recuperar/                 # Reset + confirmación "correo enviado"
│   └── invitacion/[token]/        # Alumno invitado crea su contraseña
├── (miembro)/
│   ├── c/[comunidad]/
│   │   ├── inicio/                # Feed de la comunidad
│   │   ├── cursos/                # Classroom (grid, bloqueados con candado)
│   │   ├── cursos/[curso]/        # Módulos, lecciones, progreso
│   │   ├── cursos/[curso]/leccion/[id]/   # Player Vimeo + lista lateral
│   │   ├── calendario/            # Eventos/lives del mes
│   │   ├── miembros/              # Directorio + perfiles
│   │   └── ranking/               # Ranking semanal/mensual/total
│   └── perfil/                    # Mi perfil, puntos/nivel, cuenta
├── (creador)/
│   └── admin/                     # Dashboard, cursos, editor, alumnos,
│                                  # accesos, comunidad, eventos, reportes, config
└── (superadmin)/
    └── plataforma/                # Dashboard global, comunidades, creadores, planes
```

Navegación del miembro: barra superior estilo Skool (Inicio · Cursos · Calendario · Miembros · Ranking). Admin y super-admin: sidebar.

### Capa de datos

- Tipos en `src/lib/types.ts` imitando el futuro esquema Supabase: `User`, `Community`, `Course`, `Module`, `Lesson`, `Enrollment`, `Invitation`, `Post`, `Comment`, `Event`, `Level`, `PointsEntry`, `Plan`
- Mocks en `src/lib/mocks/` (un archivo por entidad)
- Los componentes **nunca** importan mocks directamente: consumen hooks (`useCourses()`, `useFeed()`, `useMembers()`, `useInvitations()`...) que combinan mocks + estado Zustand. Al llegar el backend se reescriben los hooks sin tocar UI.

### Sesión simulada

- "Iniciar sesión" guarda el usuario en Zustand persistido; cualquier contraseña es válida
- Usuarios semilla: `alumno@klaze.app`, `creador@klaze.app`, `admin@klaze.app` (super-admin)
- Conmutador rápido de usuario en el footer para demos

## Pantallas (~28)

### Auth (4)

1. Login
2. Registro de creador (crea comunidad)
3. Recuperar contraseña (+ estado "correo enviado")
4. Invitación `/invitacion/[token]`: logo de la comunidad, "Fuiste invitado a [curso]", crear contraseña, entra directo

### Área de miembros (7)

1. Feed de la comunidad (inicio)
2. Cursos: grid con acceso/bloqueado por nivel o sin acceso
3. Detalle de curso: módulos, lecciones, barra de progreso
4. Player de lección: embed Vimeo, lista lateral, marcar completada, descripción, recursos descargables, comentarios de lección
5. Calendario de eventos + detalle con "agregar a mi calendario"
6. Directorio de miembros con buscador + perfil de miembro
7. Mi perfil: avatar, bio, puntos/nivel, configuración

### Comunidad estilo Skool (dentro del feed)

- Categorías: Anuncios, General, Wins, Preguntas; post fijado; crear post con editor simple
- Posts con likes y comentarios anidados (2 niveles)
- Gamificación: puntos por likes recibidos; niveles 1-9 con nombres personalizables; ranking semanal/mensual/total; barra "te faltan X puntos para nivel Y"
- Cursos desbloqueables por nivel (candado "se desbloquea en nivel N")

### Admin del creador (9) — `/admin`

1. Dashboard: alumnos activos, cursos, posts de la semana, últimos accesos
2. Cursos: lista + crear/editar (portada, descripción, precio referencial)
3. Editor de curso: módulos/lecciones drag & drop, campo video Vimeo con preview del embed, recursos adjuntos, lecciones de texto
4. Alumnos: tabla con buscador, estado (activo/invitado/suspendido), progreso
5. **Accesos**: agregar correo(s) → elegir curso(s) o toda la comunidad → enviar invitación → estado *Invitado* con botón "copiar link de invitación" (simula el correo) → al aceptar pasa a *Activo*
6. Comunidad: moderación de posts, categorías, configurar niveles/puntos
7. Eventos: crear/editar
8. Reportes: progreso, alumnos más activos, videos más vistos
9. Configuración: nombre/logo/color de la comunidad, datos del creador

### Super-admin (4) — `/plataforma`

1. Dashboard global: comunidades activas, creadores, alumnos totales, MRR simulado
2. Comunidades: lista con estado/plan/dueño, suspender/activar
3. Creadores: gestión de cuentas
4. Planes de Klaze (Starter/Pro/Scale) con precios

## Flujo de invitación (caso de uso central)

1. Creador → Admin → Accesos: pega correos, elige cursos, "Enviar invitaciones"
2. Confirmación "📧 Invitación enviada"; alumno queda *Invitado*; fila con "copiar link de invitación"
3. Abrir `/invitacion/[token]`: pantalla brandeada, crear contraseña
4. Al aceptar: sesión cambia al alumno nuevo, entra a sus cursos; en el admin pasa a *Activo*. Todo persistido en localStorage — coherente entre vistas.

## Integración Vimeo (mock)

- Campo "Video de Vimeo" en editor de lección: acepta `vimeo.com/123456789`, URL completa o ID; extrae ID y muestra preview inmediato
- Estado vacío con instrucciones ("Sube tu video a Vimeo y pega aquí el enlace")
- Mocks usan IDs reales de videos públicos de Vimeo para que el player funcione en la demo

## Datos mock

- 2 comunidades: principal muy poblada + secundaria pequeña con otro color de acento (demuestra multi-creador y personalización)
- Comunidad principal: 3 cursos (uno completo con 4 módulos / ~15 lecciones, uno mediano, uno bloqueado por nivel), ~25 miembros, ~20 posts en 4 categorías con comentarios, 4 eventos, ranking poblado

## Estados y errores

- Estado vacío diseñado en cada lista (sin posts, sin lecciones, sin alumnos)
- Skeletons de carga breves
- Validación de formularios: correo inválido, requeridos, token de invitación inexistente/usado (pantalla de error amigable)

## Identidad visual V2

- Paleta: neutros cálidos (blanco roto, gris piedra) + **índigo profundo** primario + **acento lima** para éxito/progreso/gamificación
- Tipografía: display geométrica para títulos y wordmark (tipo Space Grotesk) + sans legible para UI (tipo Inter); números tabulares en métricas
- Modo oscuro completo con tokens desde el inicio
- Firma propia: tarjetas de curso con progreso perimetral, badges hexagonales de nivel, tablas admin densas pero respiradas
- Personalización por comunidad: logo + color de acento
- Microinteracciones: transiciones sutiles, confetti al completar curso, contador animado de puntos
- Se afinará con la skill de diseño frontend en implementación

## Fuera de alcance

- Backend real (Supabase, Stripe, API de Vimeo, envío real de correos)
- Checkout / pagos dentro de la app
- Subida directa de video (solo pegar link de Vimeo)
- Chat/mensajería directa entre miembros
- Notificaciones push/correo reales (solo UI de notificaciones in-app con mocks)
- i18n (solo español)
- Tests automatizados de UI
- SEO dinámico

## Fases de implementación (para el plan)

1. Fundación: scaffold, tokens de diseño, tipos, mocks, sesión simulada, layouts
2. Auth: 4 pantallas + flujo de invitación
3. Área de miembros: cursos, player, calendario, miembros, perfil
4. Comunidad: feed, posts, gamificación, ranking
5. Admin del creador: 9 pantallas
6. Super-admin: 4 pantallas + pulido final
