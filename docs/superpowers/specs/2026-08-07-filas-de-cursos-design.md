# Portada de la academia en filas, y pantalla propia por módulo

**Fecha:** 2026-08-07
**Estado:** aprobado

## Qué construye

La portada del área de miembros pasa a ser **una fila horizontal por curso**, con
las portadas de sus módulos deslizándose dentro. Cada módulo gana **pantalla y
dirección propias**.

Es la estructura que el usuario ya usa en Hotmart Club y que quiere replicar.

## Por qué no basta con lo que hay

Hoy `/c/{slug}/cursos` lista lo mismo de tres formas seguidas: una fila de
atajos (`CourseTiles`), un banner por curso bajo *"Accede ahora"*
(`CourseBanner`), y otro bloque igual bajo *"Amplía tu acceso"*. Con dos cursos
se tolera; con diez —los que el usuario tiene— es una página que no termina.

Y los módulos se abren **en el sitio**: pulsar uno despliega sus lecciones
debajo. En una cuadrícula pasa; con filas horizontales se rompe. Desplazas una
fila, pulsas, y aparece una lista que empuja hacia abajo todo lo demás: pierdes
dónde estabas y al cerrar la página ha cambiado de forma.

## Decisiones

| Decisión | Elegido | Por qué |
|---|---|---|
| Qué es una fila | Un curso | Lo confirmó el usuario. No toca el modelo de datos ni el de acceso. |
| Al pulsar una tarjeta | Va a la pantalla del módulo | Vuelve con el botón atrás, cada módulo tiene enlace que se puede mandar, y hay sitio para la lista completa. |
| Cursos sin acceso | Se muestran, atenuados y con candado | Enseñar lo que hay detrás vende. Ocultarlos no. |
| Curso sin módulos | Fila con "Contenido en camino" | Si desaparece, el creador cree que se rompió algo. |
| Base de datos | No se toca | Todo es presentación: el progreso ya viaja en el armazón y los módulos ya tienen orden y portada. |

## Arquitectura

```
/c/{slug}/cursos                       → filas, una por curso
/c/{slug}/cursos/{curso}/modulo/{id}   → NUEVA: lecciones de ese módulo
/c/{slug}/cursos/{curso}/leccion/{id}  → sin cambios
```

Las pestañas de *Comunidad*, *Calendario*, *Miembros* y *Ranking* siguen
colgando de cada curso y no se tocan.

## Componentes

### `FilaCurso` (nuevo)

Título del curso a la izquierda, flechas a la derecha, tarjetas deslizándose.

Las flechas **solo se pintan si hay algo que desplazar**, y se apagan al llegar
a un extremo: una flecha que no hace nada enseña a ignorar las flechas. El
estado sale de medir el contenedor (`scrollLeft`, `scrollWidth`, `clientWidth`)
y se recalcula al desplazar y al cambiar el tamaño de la ventana.

En móvil no hay flechas —se arrastra— y las tarjetas se enganchan al soltar
(`snap-x snap-mandatory`) para que ninguna quede cortada a la mitad.

La barra de desplazamiento se oculta, pero **el contenedor sigue siendo
desplazable con el teclado**: es un `overflow-x-auto` real, no un transform.

### `ModuloCard` (se modifica)

Ya tiene numeral, barra de progreso y marca de completo. Cambia en dos cosas:

- Deja de ser un `<button>` con `onSeleccionar` y pasa a ser un `<Link>` a la
  pantalla del módulo.
- Gana estado **bloqueado**: atenuada, con candado, y sin enlace. Un curso que
  no cubre tu acceso no debe poder abrirse ni por URL escrita a mano — de eso
  ya se encarga RLS, pero la tarjeta tampoco debe invitar.

### `HeroContinuar` (nuevo)

La franja de arriba. Busca la **última lección empezada y no terminada**; si no
hay ninguna, la primera sin ver del primer curso con acceso. Muestra su portada
de fondo, el nombre del curso y del módulo, y un botón *Continuar*.

Si no hay absolutamente nada con acceso, no se pinta: una franja que dice
"empieza" sin nada que empezar es peor que ninguna franja.

### Pantalla del módulo (nueva)

Portada, título, numeral, progreso, botón *Continuar* —a la primera lección sin
ver, o a la primera si están todas vistas— y la lista de lecciones con duración
y marca de vista.

`Continuar` es el botón más usado de esta pantalla: quien vuelve no quiere
elegir en una lista, quiere seguir.

### Lo que se borra

`CourseTiles` y `CourseBanner` se quedan sin consumidores. Se borran en el mismo
cambio: un componente que nadie usa es el que el siguiente encuentra antes que
el bueno.

## Datos

Nada nuevo. `useCourses` ya devuelve los cursos con `tieneAcceso` y su
progreso, y `armazon.progreso` son los identificadores de las lecciones vistas
de esa persona —RLS ya garantiza que solo llegan las suyas—. El progreso por
módulo se deriva contando, que es lo que ya hace `ProgresoModulo`.

## Errores y casos límite

| Situación | Qué se ve |
|---|---|
| Curso sin módulos | La fila aparece con "Contenido en camino". |
| Módulo sin lecciones | Tarjeta sin barra de progreso; su pantalla dice que aún no hay lecciones. |
| Curso sin acceso | Tarjetas atenuadas con candado, sin enlace. |
| Módulo abierto por URL sin acceso | La pantalla no encuentra el módulo y ofrece volver a los cursos. RLS ya lo había filtrado. |
| Nada empezado | El hero dice "Empieza por aquí" y apunta a la primera lección. |
| Sin ningún curso con acceso | No hay hero. |

## Pruebas

Esto es presentación, así que las pruebas de aislamiento no aplican: no hay
consulta nueva ni política nueva. La verificación es `build` + `lint` + recorrido
manual, que es lo que dice `CLAUDE.md` para este tipo de cambio.

El recorrido: entrar como alumno con acceso parcial y comprobar que las filas
salen, que las flechas se apagan en los extremos, que una tarjeta lleva a su
módulo, que *Continuar* cae en la lección correcta, y que un curso sin acceso
se ve pero no se abre.

## Fuera de alcance

- Reordenar cursos desde el admin. El orden es el que ya tienen.
- Agrupar módulos en etapas dentro de un curso.
- Los esqueletos de carga desajustados, que van aparte.
