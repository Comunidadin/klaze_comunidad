# La app del alumno: PWA, continuar, campanita, checklist y encuestas

Aprobado en conversación el 14-08-2026. Seis piezas, todas del área del
alumno, en cuatro rebanadas desplegables por separado.

## R1 — Carga con marca, PWA y barra inferior móvil

### Carga con marca (el spinner azul de la recarga)

Al recargar `/c/{academia}/...`, el guard de `(miembro)` enseñaba el
`FullScreenLoader` genérico con el spinner cian de Klaze — el `<style>` con la
paleta vive en el layout de `/c/[comunidad]`, que el guard aún no pinta. El
guard pasa a usar `CargaConMarca` (la misma pantalla del `/callback`): lee el
slug de la propia ruta, enseña logo + nombre, y el spinner se tiñe con el
`colorAcento` de la marca (inline, no por token — el token aún no existe en
ese momento).

### PWA por academia

- Route handler `GET /c/[comunidad]/manifest.webmanifest`: manifest generado
  de `marca_publica` — `name`/`short_name` de la academia, `icons` (favicon o
  logo), `start_url: /c/{slug}/cursos`, `display: standalone`,
  `theme_color`/`background_color` del acento. Cache corta (60 s), y para un
  slug inexistente 404.
- El layout de `/c/[comunidad]` lo declara en metadata (`manifest`) junto a
  `appleWebApp` (título propio) — iOS ignora el manifest pero respeta el
  icono y el título de Apple.
- Sin service worker en esta rebanada: instalable y a pantalla completa
  bastan; offline es otra función.

### Barra inferior móvil

En pantallas chicas (`md:` hacia abajo), la navegación pasa a una barra fija
abajo con las cinco pestañas como icono + etiqueta, pestaña activa en
`--primary`, `safe-area-inset-bottom` respetado. La fila superior conserva
logo, lupa, nivel y avatar. En escritorio, nada cambia.

## R2 — Continúa donde quedaste + checklist

### Continúa donde quedaste

- El store persiste `ultimaClase: Record<comunidadId, { leccionId,
  cursoSlug, titulo }>` — preferencia de ESTE navegador, como
  `espaciosVistos`. La pantalla de clase la registra al montarse.
- La pantalla de Módulos enseña arriba una tarjeta «Continúa donde quedaste»
  con la clase y su botón. Sin registro, invita a la primera clase del primer
  módulo publicado; sin cursos, no aparece.

### Checklist de bienvenida

Tarjeta «Empieza aquí» en Módulos, con tres pasos que se marcan solos:

1. Completa tu perfil — avatar o bio no vacíos (armazón).
2. Preséntate — existe al menos una publicación tuya en la academia
   (consulta por RLS al montar).
3. Tu primera clase — `progreso.length > 0` (armazón).

Descartable (persistido por academia); desaparece sola al completar los tres.
No se enseña al dueño de la academia.

## R3 — Campanita de notificaciones

Sin tablas nuevas: se deriva con las políticas existentes desde
`ultimaRevisionNotificaciones` (persistida por academia; primera vez = fecha
de entrada a la academia).

- **Respuestas**: comentarios de otros sobre MIS publicaciones, y respuestas
  de otros a MIS comentarios, posteriores a la marca.
- **Anuncios**: publicaciones de otros en espacios de solo lectura.
- **Clases desbloqueadas**: cursos con goteo cuya fecha de apertura
  (`fechaDeApertura`, la misma del candado) cayó entre la marca y ahora.

Campana en la barra del área con contador (tope «9+»); al abrir, lista con
enlaces (publicación → su espacio; curso → su pantalla) y la marca se
actualiza a ahora. Un query al montar y al abrir — sin polling.

## R4 — Encuestas en el feed

- Tablas nuevas, con RLS y grants en la misma migración:
  - `encuesta_opciones (id, publicacion_id fk cascade, texto, orden)` —
    lectura para quien pertenece; escritura solo junto al post propio
    (autor de la publicación).
  - `encuesta_votos (publicacion_id fk cascade, usuario_id, opcion_id,
    primary key (publicacion_id, usuario_id))` — un voto por persona y
    encuesta; upsert para cambiarlo; solo el propio; lectura para quien
    pertenece (los totales son públicos dentro de la academia).
- Composer: modo «Encuesta» — pregunta (el título) + 2 a 6 opciones.
- `PostCard`: pinta las opciones como botones; tras votar, barras con
  porcentaje y total, tu voto marcado; puedes cambiarlo.
- El feed trae opciones y votos anidados en la misma consulta.
- Pruebas RLS: nadie vota a nombre de otro; un alumno de otra academia ni ve
  ni vota; votar dos veces reemplaza (no duplica); las opciones solo las
  crea el autor del post.

## Fuera de alcance

- Service worker / offline / push del navegador.
- Notificaciones por correo (rebanada aparte, ya priorizada).
- Editar una encuesta ya publicada (se elimina y se rehace).
