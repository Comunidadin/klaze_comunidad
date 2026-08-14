# Feed completo, búsqueda y multi-academia

Tres rebanadas aprobadas en conversación el 14-08-2026, en este orden:

1. **Formato + imágenes en publicaciones** — el feed queda completo.
2. **Búsqueda** — clases, publicaciones y miembros de la academia activa.
3. **Multi-academia** — conmutador de academia y puntos por academia.

Se despliegan por separado. Cada una deja `build`, `lint` y `bun run test`
limpios antes de su despliegue.

## Rebanada 1 — Formato + imágenes

### Formato (Markdown ligero, sin HTML crudo)

El cuerpo de una publicación y los comentarios se pintan hoy como texto plano:
las normas del creador con `## Título` enseñan las almohadillas.

- `src/lib/markdown.ts`: un **parser puro** a un AST de datos (probable con
  `bun test` sin DOM) que entiende: `## ` y `### ` (títulos), `**negrita**`,
  `*cursiva*`, `- ` (listas), `[texto](url)` (solo `http/https`), párrafos y
  saltos de línea. Nada más — sin tablas, sin imágenes por sintaxis, sin HTML.
- `src/components/shared/markdown.tsx`: componente que pinta el AST con
  elementos React construidos a mano — **nunca `dangerouslySetInnerHTML`**, la
  inyección es imposible por construcción.
- Lo usan `post-card.tsx` (cuerpo) y los comentarios. El recorte de «Ver más»
  sigue cortando por caracteres sobre el texto crudo; el parser es tolerante a
  sintaxis cortada (nunca lanza).

### Imágenes en publicaciones

- Migración: `publicaciones.imagen_url text` (opcional) + política de
  `storage.objects` para la carpeta `publicaciones/{usuario_id}/…` — misma
  forma que la de avatares: cada cual escribe solo en la suya, lectura libre.
- El composer gana un botón de imagen: se lee el archivo, se **reduce en el
  navegador** (lado mayor ≤ 1600 px, WebP) y se sube. Sin encuadre: una foto de
  un post no se recorta. Vista previa con botón de quitar antes de publicar.
- `crearPost` acepta `imagenUrl`; el feed la trae y `PostCard` la enseña bajo
  el cuerpo (ancho completo, esquinas redondeadas, `max-h` con `object-cover`).

## Rebanada 2 — Búsqueda

Un buscador en la barra del área de alumno (icono de lupa + atajo ⌘K/Ctrl-K),
en un Dialog con un campo de texto y resultados agrupados mientras se escribe
(rebote de ~300 ms, mínimo 2 caracteres):

- **Clases**: `lecciones` con `!inner` hasta `cursos` filtrando por la
  comunidad activa; RLS ya esconde borradores y clases con goteo cerrado.
- **Publicaciones**: `titulo.ilike` o `cuerpo.ilike` sobre la comunidad.
- **Miembros**: `perfiles.nombre ilike` — RLS (`comparte_comunidad_con`) ya
  limita a quienes comparten academia.

Sin infraestructura nueva: tres consultas por las políticas existentes, así que
solo aparece lo que esa persona ya puede ver. Los caracteres especiales de
`ilike` (`%`, `_`) se escapan. Cada resultado navega a su pantalla (clase →
lección; publicación → su espacio; miembro → directorio de miembros).

## Rebanada 3 — Multi-academia

### El problema

- `cargarArmazon` elige academia con `.limit(1)`: quien está en dos ve una
  arbitraria y no puede cambiar.
- Los candados por nivel (`privado.curso_disponible`) leen `perfiles.puntos`,
  que es **global**: puntos ganados en una academia abren cursos en otra.

### Puntos por academia, derivados

El ranking ya cuenta puntos por academia desde `progreso` (10 × clase, cruzando
hasta `cursos.comunidad_id`) — no usa el contador global. Se generaliza ese
criterio:

- `privado.curso_disponible` pasa a **contar** el progreso del usuario dentro
  de la comunidad del curso, en vez de leer `perfiles.puntos`.
- El armazón calcula los puntos de la academia activa en el cliente: ya carga
  todo el progreso propio y todas las clases de esa academia; puntos = 10 × la
  intersección. La pantalla de alumnos del creador usa `ranking_de_comunidad`,
  que ya es por academia.
- `perfiles.puntos`, su trigger `al_cambiar_progreso` y la función
  `ajustar_puntos` **se retiran**: eran la única copia materializada y toda
  copia se descuadra. No hay datos que migrar — el derivado ya es la verdad.

### Conmutador de academia

- El armazón gana `misAcademias`: las academias donde la persona está inscrita
  (activas) más las que posee — id, slug, nombre y logo.
- El store persiste `academiaActivaId`. `cargarArmazon` recibe la preferida y
  la usa si sigue en la lista; si no: la propia, y si no, la primera inscrita.
- En el menú del avatar (MemberShell) aparece «Cambiar de academia» cuando hay
  más de una: elegir una fija la preferencia, recarga el armazón y navega a
  `/c/{slug}`.
- Al entrar con más de una academia y ninguna preferencia guardada, una
  pantalla `/academias` («¿A cuál academia entras?») con una tarjeta por
  academia. Con una sola, todo sigue igual que hoy.
- El rol no cambia: `(miembro)` ya admite cualquier rol logueado.

### Pruebas

- Parser de Markdown: puras, casos de sintaxis válida, cortada y hostil
  (`javascript:` en enlaces se descarta).
- RLS: nadie escribe en la carpeta de publicaciones de otro; `imagen_url`
  viaja con las políticas existentes de `publicaciones`.
- Nivel por academia: un alumno con progreso en la academia A no desbloquea
  por nivel un curso de la academia B.
- La auditoría (A1/A2/A3) sigue verde tras retirar el contador.

## Fuera de alcance

- Notificaciones por correo (siguiente rebanada natural).
- Dominios personalizados (esperando el dominio ancla).
- Editor de imágenes/galerías (una imagen por publicación).
- Búsqueda con índices (`tsvector`): con `ilike` sobra a este tamaño; si un
  día es lento, el índice `pg_trgm` se añade sin tocar la interfaz.
