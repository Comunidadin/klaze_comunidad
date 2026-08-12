# Goteo de contenido: los módulos se abren cuando toca

**Fecha:** 12 de agosto de 2026
**Estado:** diseño aprobado, pendiente de plan de implementación

## Por qué

Quien compra Mentoría V7.0 recibe hoy los dos módulos —24 clases— el primer día.
Puede verlo todo en un fin de semana y pedir el reembolso. Para un producto de
mentoría eso es una fuga de ingresos directa, y además rompe el ritmo: nadie
vuelve a una comunidad de la que ya se llevó todo.

El goteo convierte una venta única en una permanencia. Es la razón por la que se
eligió por delante de certificados, notificaciones y dominio propio.

## Vocabulario

Este documento usa el de la interfaz, no el del código. Recordatorio:

| En el código | En la interfaz |
|---|---|
| `curso` / `cursos` | **módulo** |
| `modulo` / `modulos` | **submódulo** |
| `leccion` / `lecciones` | **clase** |

**El goteo actúa sobre el módulo**, o sea sobre la tabla `cursos`.

## Decisiones tomadas

| Pregunta | Respuesta | Consecuencia asumida |
|---|---|---|
| ¿Desde cuándo cuenta? | Los dos modos, y lo elige el creador por módulo: **a los N días** o **en una fecha fija** | Dos reglas conviviendo en el mismo resolver |
| ¿Qué pieza se libera? | **El módulo entero** | Con dos módulos son dos escalones; para más entregas se parten en más módulos |
| ¿Desde qué instante corre el reloj de «N días»? | Desde que el alumno **entró a la academia** (`inscripciones.creado_el`) | Un módulo comprado después llega abierto. Para ese caso se vende con **fecha fija** |
| ¿A quién afecta al encenderlo? | **A todos, sin excepciones** | Puede cerrar un módulo que un alumno ya tenía abierto. Se mitiga con un aviso que enseña el número antes de guardar |

## Hallazgos que condicionan el diseño

Tres cosas encontradas al explorar, todas de la misma familia —una regla que
existe solo en el navegador— y que explican por qué el goteo se construye como
se construye.

**1. El candado por nivel es decorado.** `cursos.nivel_requerido` se aplica solo
en `use-courses.ts`. `privado.cubre_curso` no mira los niveles, así que la base
le entrega el módulo, sus submódulos y sus clases a un alumno que no llega al
nivel. Contradice la regla del propio proyecto: suspender debe revocar acceso
real, no cambiar un badge. **Se arregla en este mismo trabajo.**

**2. Las clases de un submódulo en borrador salen de la base.** La política
`lecciones: via su modulo` comprueba `cubre_curso(m.curso_id)` pero **no**
`m.publicado`. La migración `20260807024857_modulo_en_borrador_no_sale_de_la_base`
arregló `modulos` y se dejó `lecciones` fuera. Consecuencia para el goteo: la
cascada no existe, esconder el submódulo no esconde sus clases, así que hay que
tocar las dos políticas. **Se arregla en la misma migración**, porque es la misma
línea y el mismo repaso.

**3. Los umbrales de nivel viven solo en TypeScript** (`src/lib/levels.ts`,
`NIVEL_UMBRALES`). Para aplicar el candado en Postgres hay que llevárselos allí,
y entonces existen en dos sitios. Se resuelve con una prueba que los compara.

## Enfoque elegido

**Un resolver nuevo aplicado a las políticas de `modulos` y `lecciones`**, y no
dentro de `cubre_curso`.

`cubre_curso` decide si el módulo **existe** para ti. Metiendo ahí el goteo, un
módulo pendiente desaparecería de la lista sin candado, sin fecha y sin
explicación, arrastrando su ficha y su fila del ranking — y `cubre_curso_de`
alimenta el directorio de miembros, así que la gente aparecería y desaparecería
del directorio según la fecha. Es el callejón sin salida que ya apareció con las
academias suspendidas: la app no puede distinguir «todavía no» de «no existe».

La división correcta ya existe en este proyecto: `inscrito_en` deja ver la fila,
`pertenece_a` deja ver el contenido. El goteo hace lo mismo un nivel más abajo.

---

# 1. Modelo de datos

`cursos` gana tres columnas:

```sql
alter table public.cursos
  add column goteo_modo  text not null default 'ninguno'
    check (goteo_modo in ('ninguno','dias','fecha')),
  add column goteo_dias  integer,
  add column goteo_desde timestamptz,
  add constraint cursos_goteo_coherente check (
    (goteo_modo = 'ninguno' and goteo_dias is null and goteo_desde is null) or
    (goteo_modo = 'dias'    and goteo_dias is not null and goteo_dias > 0
                            and goteo_desde is null) or
    (goteo_modo = 'fecha'   and goteo_desde is not null and goteo_dias is null)
  );
```

**Discriminador explícito**, no «si `goteo_dias` no es nulo, entonces es por
días». Misma decisión que `canales_venta.tipo`: un nulo con significado es lo que
hace que dentro de tres meses nadie recuerde por qué esa columna es opcional. Y
con la restricción, un modo a medias no se puede guardar ni saltándose la
pantalla.

`goteo_desde` es `timestamptz`: el creador elige **fecha y hora**. Con solo fecha
habría que inventar una hora y una zona, y «el 15 de septiembre» significaría
cosas distintas en Quito y en Madrid.

**No se toca `inscripcion_cursos`.** El reloj sale de `inscripciones.creado_el`.

Tres columnas y no una tabla aparte: son tres campos de configuración, siempre
exactamente uno por módulo, y una tabla `goteo_cursos` sería una junta más en la
consulta más caliente de la app —la que arma el armazón—.

# 2. El resolver y las políticas

## `privado.nivel_por_puntos(p_puntos integer) returns integer`

Los umbrales de `NIVEL_UMBRALES`, en SQL:

```sql
create function privado.nivel_por_puntos(p_puntos integer) returns integer
language sql immutable set search_path = '' as $$
  select greatest(1, (
    select count(*)::integer
    from unnest(array[0,20,65,155,315,515,815,1215,1715]) u
    where p_puntos >= u
  ));
$$;
```

`greatest(1, …)` porque `ajustar_puntos` resta al borrar una lección y un alumno
puede acabar bajo cero; TypeScript devolvería 1 y esto tiene que devolver lo
mismo.

## `privado.curso_disponible(p_curso uuid) returns boolean`

Responde a una única pregunta —«¿este módulo está abierto para mí ahora
mismo?»— y comprueba los dos candados: la fecha del goteo y el nivel.

**Una función y no dos**, aunque sean dos reglas distintas: tienen el mismo
efecto y el mismo sitio de llamada. Separarlas obligaría a cada consumidor futuro
a acordarse de invocar las dos, que es exactamente cómo se quedó `lecciones` sin
comprobar `publicado`.

```sql
create function privado.curso_disponible(p_curso uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    (case c.goteo_modo
       when 'fecha' then c.goteo_desde <= now()
       when 'dias'  then exists (
         select 1 from public.inscripciones i
         where i.usuario_id = (select auth.uid())
           and i.comunidad_id = c.comunidad_id
           and i.estado = 'activo'
           and i.creado_el + make_interval(days => c.goteo_dias) <= now())
       else true
     end)
    and
    (c.nivel_requerido is null
     or privado.nivel_por_puntos(
          coalesce((select p.puntos from public.perfiles p
                    where p.id = (select auth.uid())), 0)
        ) >= c.nivel_requerido)
  from public.cursos c
  where c.id = p_curso;
$$;
```

Un `p_curso` inexistente devuelve `null`, que una política trata como falso — el
resultado correcto.

## Las dos políticas

Solo cambia su rama de miembro. La del dueño queda intacta: es lo que le deja
preparar el módulo antes de que abra.

| Política | Cambio |
|---|---|
| `modulos: via su curso` | `+ and privado.curso_disponible(curso_id)` |
| `lecciones: via su modulo` | `+ and m.publicado and privado.curso_disponible(m.curso_id)` |

Ese `m.publicado` es el arreglo del hallazgo 2.

**`cursos` no se toca.** La fila del módulo sigue visible con el plazo pendiente,
y eso es el punto entero del diseño: sin ella no hay cuenta atrás, hay un módulo
que desapareció.

# 3. Pantalla del creador

**Se configura en el editor del módulo** (`/admin/cursos/[curso]`), junto al
título, la descripción y el precio, porque es un ajuste de ese módulo. Un bloque
«Cuándo se abre» con tres opciones:

- **Al comprar** (por defecto — nada cambia para lo que ya existe)
- **A los … días de entrar a la academia**
- **El …** (fecha y hora)

**Y se ve entero desde la lista.** En `/admin/cursos`, cada fila lleva su nota
junto a «Publicado / Borrador»: *«Se abre a los 7 días»*, *«Se abre el 15 sep,
9:00»*. Sin eso habría que abrir los módulos uno a uno para reconstruir el
calendario recién montado, que es cuando se cuelan los huecos y los solapes.

## El aviso antes de guardar

La regla se aplica a todos sin excepciones, así que la pantalla enseña el número
antes de que sea tarde:

> **Esto cierra «Fundamentos» a 3 de tus 4 alumnos ahora mismo.** Volverán a
> verlo cuando cumplan 7 días desde que entraron. El más reciente entró hace 5
> días.

Sale de una consulta que el dueño ya puede hacer —sus inscripciones activas que
aún no cumplen el plazo **y** que tienen acceso a ese módulo (`todos_los_cursos`
o fila en `inscripcion_cursos`)—, así que no hace falta nada nuevo en el
servidor. El aviso solo aparece cuando de verdad cierra algo.

## Fuera de alcance, dicho en voz alta

No hay «programar todo el temario de una vez» (tipo *un módulo por semana
empezando el lunes*). Con ocho módulos son ocho ediciones. Un asistente de
calendario trae sus propias decisiones —qué pasa al insertar un módulo en medio,
al reordenar, al cambiar la cadencia a mitad— y conviene decidirlas viendo
primero cómo se usa lo simple.

# 4. Pantalla del alumno

`AccesoCurso` pasa de `"si" | "candado-nivel" | "sin-acceso"` a incluir
`"candado-fecha"`.

La tarjeta bloqueada ya existe y **el estado nuevo la hereda sin tocarla**:
`CourseCard` deriva `const bloqueado = curso.acceso !== "si"` y devuelve una
versión sin enlace cuando es cierto. Así que basta con darle el texto de la
fecha; el desenfoque, la opacidad y el no-navegar ya están.

**La tarjeta dice cuándo se abre, en palabras**: *«Se abre el martes 19 de
agosto»*, *«Se abre mañana»*, *«Se abre en 3 horas»*. Un candado sin fecha es una
puerta cerrada sin cartel, y la fecha es lo que hace que el goteo retenga en vez
de frustrar. No es enlace mientras esté cerrado.

**Entrada por URL directa.** Quien tenga la clase en un marcador caerá en
`/cursos/[curso]/modulo/[id]` con la base devolviendo cero filas, y hoy eso
pintaría una lista vacía sin explicación. Se le da su propio estado con el mismo
texto de la tarjeta. Es el mismo error que las academias suspendidas: «vacío» y
«todavía no» se parecen en la pantalla y no se parecen en nada para quien lo
vive.

**Un dato nuevo en el armazón.** Con modo `fecha` basta `goteo_desde`, que viaja
en el módulo. Con modo `dias` hace falta saber cuándo entró ese alumno, y el
armazón no lo trae. `cargarArmazon` —que ya consulta `inscripciones`— pasa a
traerse también su `creado_el`.

**El cálculo, en un archivo puro:** `src/lib/goteo.ts`, con una función que
recibe la configuración del módulo y la fecha de entrada y devuelve el instante
de apertura, o `null` si ya está abierto. Sin base de datos y sin React, como
`slug.ts`.

**Todo esto es solo para pintar.** Quien decide es Postgres. Si el reloj del
alumno va adelantado y su tarjeta dice que ya abrió, al entrar no habrá nada — y
eso es correcto. La pantalla nunca es el candado.

# 5. Casos límite

## Resueltos por lo que ya hay

`cubre_curso` sigue delante de todo, así que un **alumno suspendido**, una
**academia suspendida**, un **módulo despublicado** y un **alumno sin acceso a
ese módulo** ven exactamente lo mismo que hoy. El goteo se suma, no sustituye.

Apagar el goteo **reabre al instante**, y el progreso sigue intacto: nunca se
borra nada, solo se deja de mostrar.

## Decididos aquí

**El dueño siempre lo ve todo.** Es lo que le deja preparar el módulo antes de
que abra. El precio es que su «Ver como alumno» miente: verá abierto lo que su
alumno tiene cerrado. Se asume y se dice en la pantalla; la alternativa —que no
pueda ver su propio contenido hasta la fecha— es peor.

**Quien se da de baja y vuelve trae su reloj viejo.** `aceptar_invitaciones_de`
reactiva la inscripción sin tocar `creado_el`, así que quien compró en enero, se
fue en marzo y vuelve en agosto recibe todo abierto. Es consecuencia directa de
contar desde la entrada a la academia, y es la respuesta correcta: ya había
pagado ese tiempo.

**Puntos negativos** → nivel 1, igual que TypeScript.

# 6. Pruebas

## Sin base de datos — `tests/goteo.test.ts`

El cálculo puro: plazo cumplido justo ahora, cambio de mes, fecha ya pasada, modo
`ninguno`, `goteo_dias` grande sobre una inscripción antigua.

## Contra la base — `tests/rls/goteo.test.ts`

| Qué se comprueba | Por qué |
|---|---|
| Un alumno con el plazo pendiente **no saca los submódulos ni las clases, ni pidiéndolos por id** | Es la prueba que el candado por nivel nunca tuvo. Roja aquí = el goteo es decorado |
| Cumplido el plazo, sí las saca | Una regla que además rompe el caso bueno es una avería |
| Modo `fecha`: antes no, después sí | Los dos modos son caminos distintos dentro del resolver |
| **La fila del módulo sigue visible con el plazo pendiente** | Contraintuitivo y a propósito: sin ella no hay cuenta atrás |
| El dueño lo ve siempre | Si se rompe, un creador no puede preparar su temario |
| El candado por nivel **también** corta en la base | El arreglo incluido en este trabajo |
| Las clases de un submódulo en borrador ya no salen | El hallazgo 2 |

## Coherencia entre los dos mundos

`privado.nivel_por_puntos` comparada contra `NIVEL_UMBRALES` de TypeScript sobre
un rango de puntos. Los umbrales van a existir en dos sitios; esta prueba impide
que se separen sin que nadie se entere.

# 7. Verificación

1. `bun run lint` y `bun run build`, por código de salida.
2. `bun run test` completa, con `bun run dev` levantado.
3. A mano, tras desplegar:
   - Poner «Fundamentos» a 7 días. Comprobar que el aviso enseña el número de
     alumnos afectados **antes** de guardar.
   - Entrar como alumno: la tarjeta con candado y fecha, y la clase por URL
     directa dando el estado de «todavía no».
   - Pedir la clase por su id con la sesión del alumno y comprobar que la base
     devuelve cero filas.
   - Apagar el goteo y comprobar que reabre con el progreso donde estaba.

# 8. Fuera de alcance

- Programar el temario entero de una vez (asistente de calendario).
- Goteo por clase o por submódulo — hoy la granularidad es el módulo.
- Avisar por correo cuando algo se abre. Encaja con las notificaciones, que son
  un trabajo aparte y el siguiente candidato natural.
- Reloj por módulo (`inscripcion_cursos.creado_el`). Descartado a propósito; si
  algún día hace falta para vender un segundo producto con goteo propio, es una
  columna y una rama más en el resolver.
