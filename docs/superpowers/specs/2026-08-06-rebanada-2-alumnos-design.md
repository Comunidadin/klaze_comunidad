# Rebanada 2 — Alumnos: invitar, acceder, gestionar y avanzar

Fecha: 2026-08-06
Estado: propuesto, pendiente de revisión
Sucede a la rebanada 1 (`2026-08-06-rebanada-1-cursos-design.md`)

## 1. Objetivo

Que el dueño **invite a un alumno real, ese alumno entre, vea sus cursos y su
progreso se guarde** — todo en la base, y funcionando entre dispositivos.

**Criterio de terminación.** Una secuencia que hoy es imposible:

1. El dueño invita a un correo desde `/admin/accesos`, eligiendo cursos.
2. Al alumno **le llega el correo** y entra con un solo clic. Sin contraseña.
3. Ve exactamente los cursos que se le asignaron, y ninguno más.
4. Marca una lección como vista, **abre la app en el móvil y sigue marcada**.
5. El dueño lo suspende y el alumno **pierde el acceso a los vídeos**, no solo
   la etiqueta.
6. El dueño lo reactiva y el alumno **recupera su progreso** intacto.

## 2. Lo que ya está resuelto

El cimiento dejó hecho más de lo que parece, y conviene no rehacerlo:

- La tabla `invitaciones` con **token aleatorio** e índice por correo.
- `public.invitacion_publica(token)`, que la pantalla de invitación lee **sin
  sesión**, devolviendo un conjunto fijo de columnas.
- El trigger **`z_aceptar_invitaciones`**, que al crearse una cuenta convierte
  sus invitaciones pendientes en inscripciones y las marca como aceptadas.
- Las políticas RLS de `inscripciones`, `progreso` e `invitaciones`.
- `privado.pertenece_a`, que exige inscripción **activa**: suspender ya corta
  el acceso a nivel de base, sin que ninguna pantalla tenga que acordarse.

El correo también está resuelto: el dominio **`pr.comunidaddelintercambio.com`**
está verificado en Resend y se ha comprobado un envío real. No hay bloqueo.

## 3. Cómo entra un alumno

**Un correo, un clic.** El enlace del correo hace tres cosas de golpe: crea la
cuenta, dispara `z_aceptar_invitaciones` —que le concede los cursos asignados— y
lo deja en `/invitacion/{token}` **ya con sesión**.

Se consigue con `generateLink({ type: 'invite' })`, que crea el usuario y
devuelve el enlace, apuntando `redirectTo` a la pantalla de invitación. Esa
pantalla deja de pedir nombre y contraseña: pasa a ser una bienvenida que
muestra la academia y los cursos incluidos, con un botón para entrar.

**El botón "copiar enlace"** en `/admin/accesos` genera ese mismo enlace para
mandarlo por otra vía. No es un camino distinto: es el mismo enlace, otro
mensajero. Existe porque los correos se pierden, se marcan como spam y se
borran sin querer, y un alumno bloqueado por eso no puede esperar.

### El agujero de las cuentas que ya existen

`z_aceptar_invitaciones` se ejecuta **al crearse una cuenta**. Hay un caso donde
no se crea ninguna: **invitar a alguien que ya tiene cuenta** — porque estudia
en otra academia (el modelo lo permite: `User.comunidadIds` es plural) o porque
se le invitó antes.

Ahí el trigger no salta, la persona entra y no ve nada. Sin error y sin pista:
el dueño jura que la invitó y ella jura que no tiene acceso.

Se cierra con `public.aceptar_mis_invitaciones()`, una función `security definer`
que el cliente llama **en cada inicio de sesión**: busca invitaciones pendientes
para el correo del JWT y crea las inscripciones. Es idempotente
(`on conflict do update`), así que llamarla de más no cuesta nada.

El trigger se queda —cubre el caso nuevo sin esperar a nada— y la función lo
respalda. Dos caminos al mismo sitio, a propósito: el trigger es más rápido, la
función es más completa.

## 4. Envío de correo

Un Route Handler (`POST /api/invitaciones`) es la **única pieza nueva que corre
en el servidor**, porque necesita la clave secreta para dos cosas que el
navegador no puede hacer: generar el enlace de acceso y enviar el correo.

Comprueba que quien llama es el dueño de esa comunidad antes de nada. RLS no
protege un Route Handler que use la clave secreta — ahí el permiso hay que
comprobarlo a mano, y es exactamente el tipo de sitio donde se olvida.

Remitente configurable por entorno, porque el día que haya dos academias cada
una querrá la suya:

```
RESEND_API_KEY=re_...
RESEND_FROM="Mentoría V7.0 <acceso@pr.comunidaddelintercambio.com>"
```

Ninguna con prefijo `NEXT_PUBLIC_`: las dos son secretos de servidor.

Si el envío falla, la invitación **se queda creada** y el enlace disponible para
copiar. Borrarla dejaría al dueño sin forma de recuperar al alumno.

## 5. Qué se migra

| Hoy (store, navegador) | Pasa a |
|---|---|
| `crearInvitaciones` | `invitaciones` + `invitacion_cursos` en Postgres |
| `aceptarInvitacion` | el trigger y `aceptar_mis_invitaciones` |
| `cambiarEstadoAlumno` | `update inscripciones.estado` |
| `toggleLeccionCompleta` | tabla `progreso` |
| `useInvitations`, `useInvitation` | leen de la base |
| `useMembers`, `useUsuarios` | leen `inscripciones` + `perfiles` |

`useGamification` lee puntos del perfil, que ya vienen de la base; sus rankings
seguirán incompletos hasta que el feed exista (rebanada 3).

### Decisiones tomadas

**Suspender no borra el progreso.** Al reactivar, el alumno vuelve donde lo
dejó. Borrarlo sería castigar dos veces por una sola decisión administrativa, y
es irreversible.

**Las invitaciones no caducan por sí solas.** El enlace de Supabase sí caduca
(24 h para invitaciones), pero la fila se queda pendiente y se puede reenviar.
Que caduque el enlace y no la invitación permite reenviar sin volver a
configurar los cursos.

**Un alumno suspendido conserva su cuenta.** Pierde el acceso a esa academia,
no la identidad — puede seguir estudiando en otra.

## 6. Cómo se prueba

Las 38 pruebas actuales deben seguir en verde: si suspender deja de cortar el
acceso, las de aislamiento saltan solas. Se añaden en
`tests/rls/invitar-alumnos.test.ts`:

1. Invitar a un correo **nuevo** y entrar crea la inscripción con los cursos
   asignados, y solo esos.
2. Invitar a un correo **que ya tiene cuenta** también le da acceso —el caso que
   el trigger no cubre— vía `aceptar_mis_invitaciones`.
3. Llamar dos veces a `aceptar_mis_invitaciones` no duplica inscripciones.
4. Suspender revoca el acceso a las **lecciones**, no solo cambia el estado.
5. Reactivar devuelve el acceso **y el progreso sigue ahí**.
6. Un alumno no puede leer el progreso de otro.
7. Un alumno no puede crear invitaciones en su propia comunidad.
8. `POST /api/invitaciones` rechaza a quien no es dueño de esa comunidad.

La 8 importa más de lo que parece: es el único sitio del proyecto donde el
permiso no lo aplica la base.

## 7. Fuera de alcance

- Feed, comentarios, eventos y ranking — rebanada 3.
- Subida de archivos y vídeo protegido.
- Cobros y registro público (fuera del producto).
- Reenvío automático de invitaciones no abiertas: hace falta saber si se abrió,
  y eso es analítica de correo, otro subsistema.
