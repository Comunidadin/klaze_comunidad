# Plan: feed completo, búsqueda y multi-academia

> **For agentic workers:** ejecución inline en esta sesión, tarea por tarea.
> Spec: `docs/superpowers/specs/2026-08-14-feed-completo-busqueda-multiacademia-design.md`

**Goal:** Markdown e imágenes en el feed, buscador del área de alumno, y
multi-academia (conmutador + puntos por academia).

**Orden:** T1 → T2 (despliegue) → T3 (despliegue) → T4 → T5 (despliegue).
Cada despliegue con `build` + `lint` + `bun run test` limpios antes.

## Global

- Copy en español, vocabulario de interfaz: módulo/submódulo/clase.
- RLS en toda tabla nueva en su misma migración; grant explícito.
- Los módulos de `src/lib/supabase/` comprueban `data.length === 0` y lanzan.
- Nunca `dangerouslySetInnerHTML`.

---

### T1 — Markdown ligero (parser puro + componente)

- Create: `src/lib/markdown.ts` — `parseMarkdown(texto: string): Bloque[]`
  con `Bloque = {tipo:"titulo",nivel:2|3,inline:Inline[]} | {tipo:"lista",items:Inline[][]} | {tipo:"parrafo",lineas:Inline[][]}`
  e `Inline = {tipo:"texto"|"negrita"|"cursiva",texto:string} | {tipo:"enlace",texto:string,href:string}`.
  Enlaces: solo `http://`/`https://`; cualquier otro esquema queda como texto.
  Nunca lanza; entrada vacía → `[]`.
- Create: `src/components/shared/markdown.tsx` — `<Markdown texto={...} />`
  pinta los bloques con clases del tema (`font-semibold` títulos, `list-disc`
  listas, `text-primary underline` enlaces con `rel="noopener noreferrer"`
  y `target="_blank"`).
- Modify: `src/components/community/post-card.tsx` — el cuerpo pasa de
  `{post.cuerpo}` a `<Markdown texto={cuerpoVisible} />` (el recorte de
  «Ver más» se mantiene sobre el texto crudo).
- Modify: comentarios (`comment-thread.tsx` pinta el texto del comentario) —
  mismo componente.
- Test: `tests/markdown.test.ts` — títulos, negrita/cursiva, listas, enlaces
  http y `javascript:` (descartado), sintaxis cortada, texto plano intacto.
- Verify: `bun test tests/markdown.test.ts` + `build` + `lint`. Commit.

### T2 — Imágenes en publicaciones

- Migración `imagen_en_publicaciones`:
  `alter table public.publicaciones add column imagen_url text;`
  + política storage `publico: cada cual gestiona sus imagenes de posts`
  (`foldername[1]='publicaciones' and foldername[2]=auth.uid()`, for all).
- Modify: `src/lib/supabase/almacenamiento.ts` — `DestinoImagen` gana
  `{ tipo: "publicacion"; usuarioId: string }` → ruta
  `publicaciones/{usuarioId}/{uuid}.webp`; helper `reducirImagen(archivo):
  Promise<Blob>` (lado mayor ≤1600, WebP 0.85, canvas).
- Modify: `src/lib/supabase/feed.ts` — `crearPost` acepta `imagenUrl?`;
  selects del feed y `leerFijado` traen `imagen_url`; `PostConAutor` gana
  `imagenUrl?`.
- Modify: `post-composer.tsx` — botón de imagen (input file oculto), preview
  con quitar, sube al elegir y pasa la URL al publicar.
- Modify: `post-card.tsx` — `<img>` bajo el cuerpo si hay imagen.
- Test: RLS — un usuario no escribe en `publicaciones/{otro}/…` (extender
  `tests/rls/almacenamiento` o feed.test.ts).
- Verify: `db:push`, suite completa, build, lint. Commit + **deploy**.

### T3 — Búsqueda

- Create: `src/lib/hooks/use-busqueda.ts` — `useBusqueda(comunidadId, q)`
  con rebote de 300 ms y mínimo 2 caracteres; escapa `%`/`_`; tres consultas
  paralelas (lecciones via `modulos!inner(cursos!inner(...))`, publicaciones
  `or(titulo.ilike,cuerpo.ilike)`, perfiles `nombre ilike`); devuelve
  `{clases, publicaciones, miembros, buscando}`.
- Create: `src/components/shared/buscador.tsx` — Dialog con Input y
  resultados agrupados; navegación al elegir; se abre con la lupa del
  MemberShell y con ⌘K/Ctrl-K.
- Modify: `member-shell.tsx` — botón lupa + listener de teclado.
- Verify: suite completa (las consultas pasan por RLS existente), build,
  lint, smoke manual. Commit + **deploy**.

### T4 — Puntos por academia (la base)

- Migración `puntos_por_academia`:
  1. `privado.curso_disponible`: la rama de nivel pasa a
     `privado.nivel_por_puntos(10 * count(progreso propio en la comunidad
     del curso))`.
  2. `drop trigger al_cambiar_progreso on public.progreso;`
     `drop function public.ajustar_puntos();`
     `alter table public.perfiles drop column puntos;`
- Modify: `src/lib/supabase/consultas.ts` — `perfil.puntos` se calcula:
  `10 × |progresoFilas ∩ lecciones de la academia activa|` (ambos ya
  cargados). Quitar `puntos` del select de perfiles.
- Modify: todo lector de `perfiles.puntos` (grep): alumnos del creador →
  `leerRanking`; perfil/uso del nivel → del armazón (ya derivado).
- Test: `tests/rls/goteo.test.ts` (o nuevo) — curso con `nivel_requerido`
  en B; alumno con progreso de sobra en A no lo desbloquea; con progreso en
  B sí. Auditoría verde.
- Verify: `db:push`, suite completa, build, lint. Commit (sin deploy aún).

### T5 — Conmutador de academia

- Modify: `consultas.ts` — consulta `misAcademias` (inscripciones activas +
  propias; id/slug/nombre/logo); `cargarArmazon(supabase, academiaPreferida?)`
  elige preferida → propia → primera. El armazón la incluye.
- Modify: `store.ts` — `academiaActivaId: string | null` persistido +
  acción para fijarla.
- Modify: `member-shell.tsx` — sección «Cambiar de academia» en el
  DropdownMenu del avatar cuando `misAcademias.length > 1`; elegir fija la
  preferencia, recarga armazón, navega a `/c/{slug}`.
- Create: `src/app/(miembro)/academias/page.tsx` — tarjetas de academia;
  los redirects post-login de alumno pasan por aquí cuando hay más de una y
  no hay preferencia (ajustar el consumidor de `homePorRol`).
- Verify: suite completa, build, lint, smoke manual con dos academias.
  Commit + **deploy**.
