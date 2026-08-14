# Plan: la app del alumno

> **For agentic workers:** ejecución inline, rebanada por rebanada.
> Spec: `docs/superpowers/specs/2026-08-14-app-del-alumno-design.md`

**Orden:** R1 (deploy) → R2 (deploy) → R3 (deploy) → R4 (deploy).
Cada despliegue con `build` + `lint` limpios; R4 además con `bun run test`
completo por su migración.

### R1a — Carga con marca en el guard de miembro
- Modify: `carga-con-marca.tsx` — el spinner acepta el acento
  (`style={{ borderTopColor: marca.colorAcento }}` si existe).
- Modify: `(miembro)/layout.tsx` — en vez de `FullScreenLoader`, si la ruta
  es `/c/{slug}/...` renderiza `<CargaConMarca slug={slug} />`.

### R1b — Manifest PWA por academia
- Create: `src/app/(miembro)/c/[comunidad]/manifest.webmanifest/route.ts` —
  GET server: `leerMarcaServidor(slug)`; 404 sin fila; JSON manifest
  (name, short_name, icons con favicon/logo, start_url, display standalone,
  theme_color = colorAcento, background_color), `Cache-Control: max-age=60`.
- Modify: `(miembro)/c/[comunidad]/layout.tsx` `generateMetadata` — añade
  `manifest` y `appleWebApp: { title, capable: true }`.

### R1c — Barra inferior móvil
- Modify: `member-shell.tsx` — nav superior `hidden md:flex`; nueva
  `<nav>` inferior `md:hidden fixed inset-x-0 bottom-0` con los 5 NAV como
  icono+etiqueta (lucide: BookOpen, MessagesSquare, Calendar, Users,
  Trophy), activo en `text-primary`, `pb-[env(safe-area-inset-bottom)]`;
  `<main>` con `pb-24 md:pb-8`.
- Verify build+lint, commit, **deploy**, smoke móvil manual.

### R2a — Continúa donde quedaste
- Modify: `store.ts` — `ultimaClase: Record<string, {leccionId, cursoSlug,
  titulo}>` persistido + `registrarUltimaClase(comunidadId, datos)`.
- Modify: `_leccion-detalle.tsx` — al montar con lección válida, registra.
- Modify: `_cursos-grid.tsx` — tarjeta arriba: última clase o la primera del
  primer curso publicado.

### R2b — Checklist
- Create: `src/components/course/checklist-bienvenida.tsx` — 3 pasos
  (perfil desde armazón; publicación propia con un `select id limit 1` por
  RLS; progreso desde armazón), descartable.
- Modify: `store.ts` — `checklistOculto: Record<comunidadId, true>`.
- Modify: `_cursos-grid.tsx` — bajo la tarjeta de continuar; no al dueño.
- Verify build+lint, commit, **deploy**.

### R3 — Campanita
- Create: `src/lib/hooks/use-notificaciones.ts` — queries desde la marca
  (comentarios a mis posts; respuestas a mis comentarios; posts en espacios
  candado; aperturas de goteo con `fechaDeApertura`); devuelve lista tipada
  y `marcarVisto()`.
- Modify: `store.ts` — `notificacionesVistas: Record<comunidadId, string>`.
- Create: `src/components/shared/campanita.tsx` — botón + Dropdown/Popover
  con la lista y enlaces.
- Modify: `member-shell.tsx` — campana junto a la lupa.
- Verify build+lint, commit, **deploy**.

### R4 — Encuestas
- Migración `encuestas_en_el_feed` (tablas + RLS + grants del spec).
- Modify: `feed.ts` — CAMPOS anida `encuesta_opciones (id, texto, orden,
  encuesta_votos(usuario_id))`; `PostConAutor` gana `encuesta?`; funciones
  `votarEncuesta(postId, opcionId)` (upsert propio) y `crearPost` acepta
  `opciones?: string[]` (inserta post + opciones).
- Modify: `post-composer.tsx` — conmutador Publicación/Encuesta; 2–6
  opciones dinámicas.
- Modify: `post-card.tsx` — render de encuesta (botones → barras con % y
  total, voto propio marcado, cambiar voto).
- Test: `tests/rls/encuestas.test.ts` — 4 casos del spec.
- Verify `db:push` + suite completa + build + lint, commit, **deploy**.
