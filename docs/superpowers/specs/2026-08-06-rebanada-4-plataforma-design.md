# Rebanada 4 — `/plataforma`: el área del superadmin sobre datos reales

**Fecha:** 2026-08-06
**Estado:** aprobado, pendiente de plan

## Qué construye

`/plataforma` es lo único que sigue funcionando con datos semilla. Esta rebanada
lo pasa a Postgres, le da al superadmin la capacidad de **dar de alta una
academia desde la pantalla** (hoy exige la terminal y la clave secreta), y
arregla un fallo de permisos que la revisión sacó a la luz.

Al terminar, el store de Zustand queda con **solo estado de interfaz**, que es
lo que CLAUDE.md dice que debe contener.

## El fallo que arregla

`privado.pertenece_a` comprueba el estado de la **inscripción**, no el de la
**academia**. `privado.es_propietario_de` no comprueba ningún estado. Por tanto:

> Suspender una academia desde `/plataforma/comunidades` no revoca nada. El
> creador y todos sus alumnos siguen entrando igual. El botón solo cambia una
> insignia.

Es el mismo fallo que ya se corrigió con los alumnos —y la razón de que
CLAUDE.md tenga la regla "suspender DEBE revocar acceso real, no solo cambiar un
badge"—, repetido un nivel más arriba.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Alta de academia | Desde la pantalla | Sin ella, cada venta obliga a abrir la terminal. |
| Acceso del creador nuevo | Contraseña temporal en pantalla | El correo ya ha fallado tres veces; el alta no puede depender de que llegue. |
| MRR y gráfico de crecimiento | Se eliminan | Nadie cobra todavía. Un número falso en un panel acaba creyéndose. |
| Límites de plan (alumnos, cursos) | Informativos, no se hacen cumplir | No hay ni dos academias. Se añade cuando duela. |
| Lecturas | RLS desde el navegador | Igual que el resto de la app. |
| Escrituras que crean cuentas | Route Handler con clave secreta | La API de administración no existe en el navegador. |

## Arquitectura

Lo mismo que las tres rebanadas anteriores: **las políticas de la base son el
control de acceso**, y el navegador consulta directo. El único código de
servidor es el que necesita la clave secreta.

```
src/lib/supabase/plataforma.ts   →  src/lib/hooks/use-platform.ts  →  /plataforma/**
src/lib/academia.ts              →  POST /api/academias  y  scripts/crear-academia.ts
```

`src/lib/academia.ts` es nuevo y existe para que el guion de terminal y la
pantalla no diverjan: hoy la lógica de alta vive solo dentro del guion, y
copiarla al handler garantizaría que dentro de tres meses hagan cosas distintas.

## Componentes

### 1. `src/lib/supabase/plataforma.ts` (nuevo)

Tres funciones, ninguna con estado:

- **`leerPlataforma(supabase)`** → `{ academias, creadores, planes, metricas }`.
  Una consulta anidada sobre `comunidades` que trae el dueño
  (`perfiles!comunidades_propietario_id_fkey`), el plan (`planes`) y el recuento
  de `inscripciones`. El nombre de la clave foránea es obligatorio: `comunidades`
  y `perfiles` tienen más de un camino entre sí, y sin él PostgREST falla con
  "more than one relationship was found".
- **`cambiarEstadoComunidad(supabase, comunidadId, estado)`** — `update` sobre
  `comunidades.estado`.
- **`guardarPlan(supabase, plan)`** — `update` sobre `planes`.

Las dos de escritura hacen `.select("id")` y lanzan si vuelve vacío. **RLS no
lanza: filtra.** Sin esa comprobación, un creador que llame a la función vería
"guardado" sin que cambiara nada.

### 2. `src/lib/academia.ts` (nuevo) y `POST /api/academias` (nuevo)

`crearAcademia(admin, opciones)` recibe un cliente ya construido, para que el
guion y el handler compartan implementación sin compartir cómo obtienen la
clave. Devuelve `{ comunidadId, usuarioId, yaExistia, passwordTemporal }`.

Es **idempotente por slug**: repetir el alta no duplica la academia. Si ya
existía, `yaExistia` es `true` y no se genera contraseña nueva.

El handler:

1. Lee el JWT de la cabecera `Authorization: Bearer`.
2. **Comprueba a mano que quien llama es superadmin**, leyendo
   `app_metadata.rol` — la misma fuente que `privado.es_superadmin()`. Nunca
   `user_metadata`: lo edita el propio usuario desde el navegador.
3. Crea la cuenta con `email_confirm: true` y una contraseña generada con
   `crypto.randomUUID()`, con `app_metadata.rol = 'creador'`.
4. Crea la comunidad con los 9 nombres de nivel por defecto.
5. Devuelve la contraseña **una sola vez**. No se guarda en ningún sitio.

Aquí RLS no protege nada: la clave secreta se salta todas las políticas. Es
exactamente el sitio donde se olvida comprobar el permiso, así que la primera
prueba que se escribe es la que verifica que rechaza a quien no es superadmin.

### 3. Migración: la suspensión revoca de verdad

`privado.pertenece_a` y `privado.es_propietario_de` pasan a exigir que la
academia esté activa:

```sql
create or replace function privado.pertenece_a(p_comunidad uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.comunidades c on c.id = i.comunidad_id
    where i.usuario_id = auth.uid()
      and i.comunidad_id = p_comunidad
      and i.estado = 'activo'
      and c.estado = 'activa'
  );
$$;
```

Lo mismo para `es_propietario_de`. **El superadmin queda fuera de la
restricción**: `es_superadmin()` no consulta ninguna academia, así que sigue
viendo y reactivando una suspendida. Si no fuera así, suspender sería
irreversible.

**La fila de `comunidades` se sigue leyendo.** Es tentador cortar también su
política de lectura, pero entonces la app no podría distinguir "tu academia está
suspendida" de "esa academia no existe", y le enseñaría al creador un
"Comunidad no encontrada" — el mismo mensaje sin salida que ya apareció una vez
en este proyecto. Lo que se corta es el **contenido**: cursos, lecciones,
publicaciones, eventos e inscripciones, todos guardados por `pertenece_a` o
`es_propietario_de`.

Con la fila visible y su `estado` legible, los layouts de `(creador)` y
`(miembro)` pueden mostrar una pantalla que diga qué pasa y a quién escribir.
Esa pantalla es parte del trabajo, no un añadido opcional: sin ella la
suspensión produce una app rota en vez de una app cerrada.

### 4. `use-platform.ts` (reescrito) y las cuatro pantallas

El hook pasa a leer de `plataforma.ts` con el patrón del proyecto: una función
`async` cuyo `.then()` fija el estado, **nunca `setState` síncrono dentro del
efecto**. Devuelve la misma forma que hoy menos `metricas.mrr` y
`metricas.crecimientoMensual`, así que las pantallas cambian poco:

- `/plataforma` — se le quitan la `StatCard` de MRR y el gráfico. Quedan tres
  números reales.
- `/plataforma/comunidades` — el botón de suspender/activar llama a
  `cambiarEstadoComunidad` de `plataforma.ts`. Gana un botón **"Dar de alta"**
  que abre un formulario (correo, nombre, slug, plan) y, al terminar, muestra la
  contraseña temporal con un botón de copiar y un aviso de que no se volverá a
  ver.
- `/plataforma/creadores` — solo lectura, ya lo era.
- `/plataforma/planes` — `guardarPlan` de `plataforma.ts`.

### 5. Limpieza del store

Se eliminan de `src/lib/store.ts`: `usuariosCreados`, `comunidadesCreadas`,
`enrollmentsExtra`, `perfilOverrides`, `comunidadOverrides`, `planOverrides`,
las acciones `cambiarEstadoComunidad` y `guardarPlan`, y los resolvers
`resolverComunidad`, `resolverPlan` y `aplicarPerfilOverride`. También
`src/lib/hooks/use-users.ts`, que solo servía a `/plataforma`.

Tras esto el store contiene `armazon`, `espaciosVistos`, la sesión y los
contadores de las entidades que aún no han migrado.

Los mocks que se queden sin ningún consumidor (`communities`, `plans`,
`enrollments`, y `users` si no queda nadie) se borran. Un mock que nadie importa
es una trampa: el siguiente que busque "de dónde salen las comunidades" lo
encontrará antes que la consulta real. Los que sigan teniendo consumidores se
dejan.

## Errores

| Situación | Qué pasa |
|---|---|
| Escritura rechazada por RLS | La función lanza; la pantalla muestra `toast.error`. |
| Alta con un slug que ya existe | Devuelve la academia existente con `yaExistia: true`; la pantalla lo dice en vez de fingir que creó una. |
| Alta con un correo que ya tiene cuenta | Se reutiliza la cuenta y no se genera contraseña; la pantalla avisa de que esa persona ya entra con la suya. |
| Quien llama a `/api/academias` no es superadmin | 403, sin crear nada. |
| Faltan variables de servidor | 500 con el nombre de la que falta. |
| Un creador o alumno entra con su academia suspendida | Pantalla que lo explica, no un error. Ver la migración. |

## Pruebas

En `tests/rls/`, con el arnés existente (`escenario.ts`):

**`plataforma.test.ts`**
- El superadmin lee todas las academias, con dueño, plan y recuento.
- Un creador solo ve la suya.
- Un alumno no puede cambiar el estado de una academia ni editar un plan.
- El superadmin edita un plan y el cambio se lee.

**`suspension.test.ts`**
- Con la academia suspendida, su creador pierde acceso a sus propios cursos.
- Con la academia suspendida, un alumno activo pierde acceso.
- Con la academia suspendida, ambos **siguen leyendo la fila de `comunidades`**
  y su `estado` — es lo que permite explicarles qué pasa.
- El superadmin sigue viéndola y puede reactivarla.
- Tras reactivar, ambos vuelven a entrar.

**`api-academias.test.ts`**
- Sin sesión: 401.
- Con sesión de creador o de alumno: 403, y no se creó nada.
- Con sesión de superadmin: 200, la academia existe y la contraseña temporal
  sirve para entrar.
- Repetir con el mismo slug devuelve `yaExistia: true` y no duplica.

Las pruebas de API comprueban `r.ok` antes de dar por buena la respuesta: un
servidor caído devolviendo 500 haría pasar una prueba escrita a la ligera.

## Fuera de alcance

- Hacer cumplir los límites de plan.
- Cobros, facturación y MRR real.
- Borrar academias. Suspender basta y es reversible.
- Editar el perfil de un creador desde `/plataforma`.
- Rotar las credenciales expuestas — es tarea del usuario, no de esta rebanada.
