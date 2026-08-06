# Rebanada 3 — La vida social: feed, comentarios, eventos y ranking

Fecha: 2026-08-06
Estado: propuesto, pendiente de revisión
Sucede a la rebanada 2 (`2026-08-06-rebanada-2-alumnos-design.md`)

## 1. Objetivo

Que la parte social de la academia deje de ser decorado: **publicaciones que
persisten, comentarios que llegan a quien deben, eventos reales y un ranking que
premia algo que de verdad ocurre**.

**Criterio de terminación:**

1. Un alumno publica en el espacio de su curso; otro alumno lo ve, comenta y da
   me gusta. Todo sobrevive a una recarga y se ve igual desde otro dispositivo.
2. El feed carga por páginas: con 60 publicaciones, entran las primeras y hay
   un "cargar más" que trae las siguientes **sin repetir ninguna**.
3. Un alumno pregunta bajo una lección y el dueño le responde ahí mismo.
4. El dueño crea un evento y aparece en el calendario del curso.
5. Completar una lección **suma puntos**; desmarcarla los resta.
6. El ranking de 7 días refleja lo hecho en los últimos 7 días de verdad.
7. Nada de lo anterior es visible desde otra empresa.

## 2. Dos funciones que hoy fingen

La exploración encontró dos pantallas que aparentan funcionar y no funcionan.
Conviene nombrarlo, porque explica por qué esta rebanada añade tablas en vez de
solo migrar.

**Los comentarios de lección no existen.** Se generan a partir de un cálculo
sobre el identificador de la lección, aparecen **solo en el curso 1**, y no se
guardan: escribir uno y recargar lo borra. El esquema no tiene dónde ponerlos —
`comentarios` cuelga de `publicaciones`, no de `lecciones`.

**El ranking tampoco.** Nada otorga puntos: están escritos a mano en los datos
semilla y nunca cambian. Los rankings de 7 y 30 días se derivan multiplicando el
total por un porcentaje fijo. Con datos reales, todos los alumnos empiezan en
cero y el podio se queda vacío para siempre.

Decisión tomada: **se construyen los dos de verdad.** Los comentarios de lección
estrenan tabla; los puntos se ganan completando lecciones.

## 3. Puntos y ranking

**Los puntos los otorga la base, no la app.** Un trigger sobre `progreso`
mantiene `perfiles.puntos`: sumar al insertar, restar al borrar.

Va en la base y no en el código de la app por el mismo motivo que los resolvers
del cimiento: si dependiera de que cada pantalla se acuerde de sumar, tarde o
temprano una no lo hará. Además cubre gratis el caso de borrar una lección — sus
filas de progreso caen por cascada y los puntos se ajustan solos.

```sql
create function public.ajustar_puntos() returns trigger ...
create trigger al_marcar_leccion after insert or delete on public.progreso ...
```

**Constante:** 10 puntos por lección. Un número redondo y fácil de explicar; el
valor exacto da igual mientras sea el mismo para todos.

**Los periodos salen de fechas reales.** `progreso.completada_el` ya existe, así
que el ranking de 7 y 30 días deja de ser una proporción inventada.

**El ranking necesita función propia.** Un alumno debe ver la posición de sus
compañeros, pero no puede leer su progreso — esa tabla es privada. Se añade:

```sql
public.ranking_de_comunidad(p_comunidad uuid, p_desde timestamptz)
returns table (usuario_id uuid, puntos integer)
```

`security definer`, y solo responde a miembros activos de esa comunidad o a su
dueño. Devuelve **totales por persona, nunca el detalle** de qué lección vio
cada uno: lo justo para ordenar un podio.

## 4. El feed carga por páginas

Es lo único que se reservó desde el principio para esta rebanada. Publicaciones
y comentarios crecen sin techo, así que no caben en el armazón: cada pantalla
pide lo suyo.

**Se pagina por fecha, no por número de página.** Con páginas numeradas, si
alguien publica mientras lees, la publicación que estaba en la posición 20 pasa
a la 21 y la vuelves a ver al pedir la página siguiente. Paginando por
`creado_el < ultima_vista` eso no puede pasar.

- 20 publicaciones por carga, ordenadas por fecha descendente.
- La publicación **fijada** va siempre primero y fuera de la paginación: si
  entrara en el orden por fecha, desaparecería en cuanto hubiera 20
  publicaciones más nuevas, que es justo lo contrario de fijar.
- Los comentarios llegan con su publicación. Están acotados por naturaleza
  (docenas, no miles) y separarlos duplicaría las idas y vueltas.

`useFeed` cambia de forma: gana `cargando`, `hayMas` y `cargarMas()`. Es el
primer hook que rompe la firma síncrona, y es deliberado — aquí el estado de
carga sí es información que la pantalla necesita.

## 5. Comentarios de lección

Tabla nueva, colgando de la lección:

```sql
create table public.comentarios_leccion (
  id uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  padre_id uuid references public.comentarios_leccion(id) on delete cascade,
  autor_id uuid not null references public.perfiles(id) on delete cascade,
  cuerpo text not null,
  creado_el timestamptz not null default now()
);
```

Permisos calcados de los del feed: los lee quien tiene acceso al curso de esa
lección (vía `privado.cubre_curso`), los escribe cada cual a su nombre, y los
borra su autor o el dueño de la academia.

Tabla aparte y no un `leccion_id` opcional en `comentarios`: una columna que a
veces apunta a una publicación y a veces a una lección obliga a comprobar cuál
de las dos en cada consulta y en cada política. Dos tablas con la misma forma
son más aburridas y no se equivocan.

## 6. Espacios y eventos

Sin sorpresas: `secciones`, `espacios` y `eventos` ya son tablas desde el
cimiento y ya tienen políticas. Solo faltaba usarlas.

Un curso nuevo vuelve a nacer con sus espacios por defecto — algo que la
rebanada 1 desactivó a propósito porque no había dónde guardarlos.

## 7. Qué se retira del store

Al terminar, Zustand se queda **solo con estado de interfaz**: tema, espacios
vistos y borradores de formulario. Todo lo demás sale.

| Sale | Reemplazo |
|---|---|
| `crearPost`, `toggleLike`, `comentar`, `eliminarPost`, `fijarPost` | tablas del feed |
| `guardarEvento`, `eliminarEvento`, `siguienteEventoId` | tabla `eventos` |
| `guardarSecciones`, `siguienteEspacioId` | tablas `secciones` / `espacios` |
| `actualizarPerfil`, `perfilOverrides` | tabla `perfiles` |
| `guardarComunidad`, `guardarNombresNiveles`, `comunidadOverrides` | tabla `comunidades` |
| `postsCreados`, `likesDados`, `comentariosCreados`, `postsEliminados`, `postFijadoPorComunidad`, `eventosEditados`, `eventosEliminados`, `proximoPostId` | — |

**Código muerto de la rebanada 2, también fuera:** `cambiarEstadoAlumno`,
`estadoOverrides` y `resolverEstadoEnrollment`. Se conservaron diciendo que
`/admin/reportes` los necesitaba; después se migró reportes y nadie volvió a
retirarlos. No los usa nadie.

Y la última violación de `mocks → hooks → páginas`: `perfil/page.tsx`.

## 8. Cómo se prueba

Las 63 pruebas actuales siguen en verde. Se añaden en
`tests/rls/feed.test.ts` (ampliando el existente) y `tests/rls/ranking.test.ts`:

1. Un alumno publica y otro de su curso lo ve; uno de otra empresa no.
2. Nadie publica, comenta ni da me gusta a nombre de otro.
3. El autor borra su publicación; el dueño también; un tercero no.
4. La paginación no repite ni se salta publicaciones **cuando se inserta una
   nueva entre página y página** — el fallo exacto que evita paginar por fecha.
5. La publicación fijada sale primero aunque no sea la más reciente.
6. Un comentario de lección lo ve quien tiene acceso al curso, y nadie más.
7. Completar una lección suma 10 puntos; desmarcarla los resta.
8. Borrar una lección ajusta los puntos de quienes la habían completado.
9. `ranking_de_comunidad` con `p_desde` de hace 7 días excluye lo más antiguo.
10. Un alumno de otra empresa recibe vacío de `ranking_de_comunidad`.

La 4 y la 8 son las que valen: la primera comprueba el fallo que motivó paginar
por fecha, y la segunda que los puntos no se descuadran cuando el contenido
cambia.

## 9. Fuera de alcance

**El área de superadmin (`/plataforma`)** sigue con datos falsos. No es vida
social: es la pantalla desde la que se dan de alta otras empresas, solo la usa
el superadmin y no bloquea a ningún alumno. Queda como rebanada 4, junto con
`usePlatform`, `planOverrides`, `cambiarEstadoComunidad` y `guardarPlan`.

Tampoco entran: subida de archivos, vídeo protegido por dominio, ni tiempo real
(que alguien vea aparecer una publicación sin recargar). Lo último es tentador y
Supabase lo ofrece, pero cambia el modelo de carga entero y no hace falta para
que la comunidad funcione.
