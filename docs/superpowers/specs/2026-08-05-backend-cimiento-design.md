# Cimiento del backend — base de datos, cuentas y aislamiento entre empresas

Fecha: 2026-08-05
Estado: propuesto, pendiente de revisión
Proyecto 1 de 4 (ver "Qué queda fuera" al final)

## 1. Alcance

Klaze es un producto **multi-empresa con alta manual**: varias empresas tendrán
su academia, y el superadmin las da de alta a mano. De ahí salen tres
consecuencias que fijan todo el diseño:

- El aislamiento entre empresas hace falta **desde la primera tabla**.
- **No hay cobros.** Los planes `starter/pro/scale` se quedan como límites
  administrativos, no como suscripciones.
- **No hay registro público.** El alta pública de creadores (`/registro`, acción
  `registrarCreador` del store) contradice el alcance y se retira.

Los alumnos entran con **enlace por correo, sin contraseña**. Eso fusiona
invitación e inicio de sesión: invitar es mandar un enlace que deja dentro.

Se empieza **sin datos que importar**.

### Enfoque elegido

Las reglas de acceso viven en la base de datos (RLS), pegadas al dato, y la app
consulta directamente con la clave publicable. Se descartó una capa de API
propia: exigía ~45 puntos de entrada (18 lecturas + 27 escrituras) donde cada
comprobación olvidada es un agujero silencioso.

Unas pocas operaciones privilegiadas sí corren en el servidor, porque requieren
la clave secreta: alta de empresas, envío de invitaciones. Son un puñado.

## 2. Modelo de datos

17 tablas en el esquema `public`, nombres en español y `snake_case`. Claves
primarias `uuid` generadas por la base; los `slug` se conservan porque son los
que aparecen en las URLs y no deben cambiar.

| Tabla | Origen en `types.ts` | Notas |
|---|---|---|
| `perfiles` | `User` | Extiende `auth.users` (1:1 por `id`). No duplica el correo. |
| `comunidades` | `Community` | `propietario_id`, `plan_id`, `estado`, `marca_auth` (jsonb) |
| `planes` | `Plan` | Solo escribe el superadmin |
| `cursos` | `Course` | `comunidad_id`, `slug` único por comunidad, `publicado` |
| `modulos` | `CourseModule` | `curso_id`, `orden` |
| `lecciones` | `Lesson` | `modulo_id`, `recursos` (jsonb) |
| `secciones` | `CommunitySection` | `curso_id` — ver decisión 2.3 |
| `espacios` | `CommunitySpace` | `seccion_id`, `solo_lectura` |
| `inscripciones` | `Enrollment` | `usuario_id`, `comunidad_id`, `estado` |
| `inscripcion_cursos` | `Enrollment.cursoIds` | ver decisión 2.2 |
| `invitaciones` | `Invitation` | `token` aleatorio — ver decisión 2.4 |
| `invitacion_cursos` | `Invitation.cursoIds` | Gemela de `inscripcion_cursos`, por el mismo motivo (2.2) |
| `publicaciones` | `Post` | `curso_id`, `espacio_id`, `fijado` |
| `comentarios` | `PostComment` | `publicacion_id`, `padre_id` (auto-referencia) |
| `me_gusta` | `Post.likes` | ver decisión 2.1 |
| `eventos` | `CommunityEvent` | `curso_id` |
| `progreso` | `LessonProgress` | PK compuesta (`usuario_id`, `leccion_id`) |

### 2.1 Lo anidado se desdobla

Módulos, lecciones y comentarios dejan de ser listas dentro de otro objeto.
Motivo concreto: cada uno necesita reglas propias. "Un alumno edita su comentario
pero no el ajeno" no se puede expresar sobre una lista guardada dentro de la
publicación de otra persona.

Los `me gusta` pasan a tabla con PK compuesta (`publicacion_id`, `usuario_id`).
Además de permitir la regla "nadie inserta un me gusta a nombre de otro", corrige
una pérdida real de datos: hoy dos personas que dan me gusta simultáneamente se
pisan la escritura y uno de los dos desaparece.

Excepción deliberada: `lecciones.recursos` (nombre + enlace) sigue siendo `jsonb`.
Nunca se consulta por separado ni tiene permisos propios.

### 2.2 El acceso a cursos deja de ser una unión de tipos

`Enrollment.cursoIds: string[] | "todos"` se parte en dos:

- `inscripciones.todos_los_cursos boolean`
- `inscripcion_cursos (inscripcion_id, curso_id)` con clave foránea

La clave foránea es la ganancia: al borrar un curso, desaparece de los accesos
por cascada. Con un array de identificadores quedaría una referencia fantasma.

### 2.3 Se resuelve la duplicación de espacios

`types.ts` documenta que `Community.secciones` y `Course.secciones` coexisten: el
área de miembros lee los del curso, y `/admin/comunidad` sigue editando los de la
comunidad, que ya no ve nadie.

**Decisión: los espacios pertenecen al curso** (`secciones.curso_id`). Es lo que
el área de miembros ya hace. `/admin/comunidad` pasa a editar esos. No se migra
la variante de comunidad: arrastrarla significaría meter el error en datos
reales.

### 2.4 Los tokens de invitación pasan a ser aleatorios

Hoy son `inv-1`, `inv-2`, `inv-3`… (contador `proximoInviteId` del store).
Cualquiera puede probar `inv-4` y leer a qué correo se invitó y a qué empresa.
Con datos reales eso es una fuga de datos personales.

Pasan a `encode(gen_random_bytes(32), 'hex')` — 64 caracteres seguros en una URL,
sin depender de la versión de Postgres — con índice único. El token
es el secreto que protege la pantalla de invitación (ver §5).

## 3. De dónde sale la autoridad

**Principio: la autoridad sale de una relación comprobable, no de una etiqueta.**

Hoy cada usuario lleva escrito un rol y ese texto concede permisos. En este
diseño el permiso se deduce de hechos: *esta comunidad tiene tu id como
propietaria*, *existe una inscripción activa tuya*. El campo `rol` se conserva
pero degradado a lo que realmente es: **preferencia de navegación** — decide a
qué pantalla te lleva `homePorRol` al entrar. Deja de conceder nada.

### 3.1 La marca de superadmin va en `app_metadata`

Supabase expone dos bolsas de metadatos por cuenta. `user_metadata` es
**editable por el propio usuario** desde el navegador; `app_metadata` solo la
escribe el servidor. La marca de superadmin va en `app_metadata`.

Usar `user_metadata` para autorización permitiría a cualquiera ascenderse a
superadmin desde la consola del navegador. Es un fallo sin síntomas hasta que
alguien lo encuentra.

Consecuencia operativa: los claims del JWT no se refrescan al instante. Quitarle
el superadmin a alguien no surte efecto hasta que su token se renueve. Aceptable
para un rol que tendrá una persona.

### 3.2 Las cuatro comprobaciones centrales, en `privado`

`CLAUDE.md` dice: *"Cada bug importante que encontró la revisión de este repo fue
un consumidor que re-derivó esta lógica por su cuenta."* Los cuatro resolvers
centrales pasan a ser funciones `security definer` en un esquema **`privado`**,
no expuesto al API. Son cuatro, más una quinta que exige la política de
`perfiles`:

```sql
create schema privado;
revoke all on schema privado from anon, authenticated;

-- Gemelo SQL de resolverEstadoEnrollment.
-- "Suspender DEBE revocar acceso real, no solo cambiar un badge"
-- pasa de advertencia en un documento a condición de la base.
create function privado.pertenece_a(p_comunidad uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.inscripciones
    where usuario_id = auth.uid()
      and comunidad_id = p_comunidad
      and estado = 'activo'
  );
$$;

-- Gemelo SQL de enrollmentCubreCurso.
create function privado.cubre_curso(p_curso uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.cursos c on c.comunidad_id = i.comunidad_id
    left join public.inscripcion_cursos ic
      on ic.inscripcion_id = i.id and ic.curso_id = c.id
    where i.usuario_id = auth.uid()
      and c.id = p_curso
      and i.estado = 'activo'
      and (i.todos_los_cursos or ic.curso_id is not null)
  );
$$;

create function privado.es_propietario_de(p_comunidad uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.comunidades
    where id = p_comunidad and propietario_id = auth.uid()
  );
$$;

create function privado.es_superadmin() returns boolean
language sql security definer stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') = 'superadmin';
$$;

-- Quinta función, sin equivalente en el código actual: la necesita la
-- política de `perfiles` para que el directorio de miembros muestre a los
-- compañeros de comunidad sin abrir la tabla de perfiles entera.
create function privado.comparte_comunidad_con(p_usuario uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.inscripciones mias
    join public.inscripciones suyas
      on suyas.comunidad_id = mias.comunidad_id
    where mias.usuario_id = auth.uid()
      and suyas.usuario_id = p_usuario
      and mias.estado = 'activo'
      and suyas.estado = 'activo'
  );
$$;
```

Van en `privado` por dos razones. Una es la recursión: si la política de
`comunidades` consulta `inscripciones` y la de `inscripciones` consulta
`comunidades`, Postgres entra en bucle; `security definer` corta el ciclo porque
la función no vuelve a evaluar RLS. La otra es de seguridad: una función
`security definer` en un esquema expuesto es invocable directamente desde el API.

`set search_path = ''` no es adorno: sin él, una función `security definer` es
vulnerable a que alguien anteponga un esquema propio y le cambie el significado.

## 4. Políticas por tabla

RLS activado en **todas** las tablas del esquema `public`, sin excepción. Nota de
Supabase: crear una tabla por SQL no la expone sola al API — hay que conceder
acceso explícito a `anon`/`authenticated`, y siempre junto con RLS.

Convención de lectura de la tabla: "propietario" = dueño de la comunidad;
"miembro" = inscripción activa; el superadmin ve y escribe todo, y se omite por
brevedad en cada fila.

| Tabla | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `perfiles` | El propio, y quienes comparten comunidad | Solo el propio (`id = auth.uid()`) |
| `comunidades` | Propietario o miembro | Propietario (solo campos de identidad). Alta y `estado`: superadmin |
| `planes` | Cualquiera autenticado | Superadmin |
| `cursos` | Propietario: todos. Miembro: solo `publicado` | Propietario |
| `modulos`, `lecciones` | Propietario, o miembro con `cubre_curso` | Propietario |
| `secciones`, `espacios` | Igual que `lecciones` | Propietario |
| `inscripciones` | La propia; propietario las de su comunidad | Propietario |
| `inscripcion_cursos` | Vía la inscripción | Propietario |
| `invitaciones` | Propietario | Propietario (crear), servidor (marcar aceptada) |
| `publicaciones` | Miembro con `cubre_curso` | Autor (crear/editar). Propietario: borrar y fijar |
| `comentarios` | Igual que su publicación | Autor. Propietario: borrar |
| `me_gusta` | Igual que su publicación | Solo el propio (`usuario_id = auth.uid()`) |
| `eventos` | Miembro con `cubre_curso` | Propietario |
| `progreso` | Solo el propio | Solo el propio |

Dos trampas de Postgres que el plan debe respetar:

- **UPDATE necesita política de SELECT.** Un UPDATE primero lee la fila. Sin
  política de SELECT devuelve 0 filas sin error: no falla, simplemente no hace
  nada. Toda tabla con UPDATE lleva su SELECT.
- **Las vistas se saltan RLS por defecto.** Si el plan introduce alguna, va con
  `security_invoker = true`.

## 5. Acceso sin sesión

Dos pantallas necesitan datos antes de que exista la cuenta. Ninguna de las dos
justifica abrir `comunidades` a lectura anónima; ambas se resuelven con una
función estrecha que devuelve solo lo necesario.

**Login con marca de empresa** (`useMarcaAuth`). `public.marca_publica(p_slug text)`
devuelve `nombre`, `logo_url`, `color_acento` y `marca_auth` de una comunidad
activa. Todo eso es material de marca, público por naturaleza. No expone
propietario, plan ni nada más.

**Pantalla de invitación** (`/invitacion/[token]`). `public.invitacion_publica(p_token text)`
devuelve, **solo si la invitación existe y está pendiente**: el correo invitado,
la marca de la comunidad y los títulos de los cursos incluidos. Si el token no
existe, está aceptada, o la comunidad está suspendida, devuelve vacío — sin
distinguir entre los casos, para no confirmar qué tokens existen.

Ambas son `security definer` pero viven en `public` porque tienen que ser
invocables por `anon`. Es la excepción consciente a la regla de §3.2, y por eso
devuelven un conjunto fijo de columnas en vez de filas de tabla.

El correo invitado es dato personal, y lo protege el token. Por eso §2.4 no es
opcional: con tokens secuenciales, esta función se convierte en un listado de
correos.

## 6. Cómo entra la gente

**Registro público desactivado** en el panel de Supabase (`disable_signup`). Hoy
está abierto: cualquiera con la URL del proyecto puede crearse una cuenta.

**Invitar a un alumno.** El propietario elige correo y cursos. Un Route Handler
del servidor (única pieza que usa la clave secreta) crea la fila en
`invitaciones` con token aleatorio y manda el correo con el enlace.

**Primer acceso.** Un trigger `after insert on auth.users`:

1. Crea la fila en `perfiles`.
2. Busca invitaciones pendientes con ese correo.
3. Por cada una, crea la `inscripcion` (y sus `inscripcion_cursos`) y marca la
   invitación como aceptada.

Que sea un trigger y no código de la app es deliberado: es la única forma de que
no exista un estado intermedio donde alguien tiene cuenta pero no acceso, o dos
pestañas creen dos inscripciones.

**Accesos siguientes.** Enlace por correo. No hay contraseñas que recuperar.

**Alta de una empresa.** Route Handler con clave secreta, solo superadmin: crea
la cuenta del propietario, la comunidad y su plan, en una transacción.

## 7. Cómo se prueba que el aislamiento funciona

El proyecto no tiene tests automatizados por decisión del spec original.
**Esta es la excepción, y no es negociable.** Una política mal escrita no rompe
nada visible: filtra datos en silencio. Sin una prueba que lo intente, "las
empresas están aisladas" es una creencia.

Comando nuevo: `bun run test:rls`. Siembra dos empresas con dos propietarios y
dos alumnos, inicia sesión como cada uno y afirma:

1. El alumno de A no ve ningún curso, publicación, evento ni miembro de B.
2. El propietario de A no ve inscripciones ni invitaciones de B.
3. El alumno de A **no ve los cursos en borrador** de A.
4. Un alumno **suspendido** de A deja de ver el contenido de A.
5. Un alumno con acceso a un solo curso no ve las lecciones de otro curso de la
   misma comunidad.
6. Nadie puede insertar un `me gusta` ni un comentario a nombre de otro.
7. Nadie puede modificar su propio `app_metadata` para volverse superadmin.
8. `invitacion_publica` con un token inventado no distingue su respuesta de la de
   un token aceptado.

Cada afirmación se corresponde con un fallo concreto y plausible, no con una
categoría abstracta. El criterio de terminación del proyecto 1 es que las ocho
pasen.

Antes de dar por cerrado el esquema se ejecutan además los *advisors* de Supabase
(la CLI instalada es 2.75.0 y `db advisors` requiere 2.81.3+, así que hay que
actualizarla o usar el panel).

## 8. Migración de la app

**Las firmas de los 18 hooks no cambian.** `useCourses(comunidadId)` sigue
devolviendo lo mismo; cambia por dentro. Esa es la razón de que la regla
`mocks → hooks → páginas` del proyecto haya valido la pena: hay un solo punto por
entidad donde cortar.

Antes de empezar hay que corregir las **4 violaciones** de esa regla que quedan,
porque son los únicos sitios sin punto de corte:
`admin/reportes/page.tsx`, `admin/cursos/page.tsx`, `perfil/page.tsx` y
`shared/user-switcher.tsx` importan mocks directamente.

**Qué sobrevive del store.** Zustand se queda para estado de interfaz: tema,
`espaciosVistos`, borradores de formulario. Pierde todo lo que es dato de
dominio. Los contadores deterministas (`proximoInviteId`, `siguienteCursoId`…)
desaparecen: los identificadores los genera la base.

**`useHydrated` cambia de significado** pero no desaparece: hoy indica "el store
leyó de localStorage"; pasará a indicar "sé si hay sesión". Los cuatro layouts de
grupo siguen siendo los guardianes de rol y siguen gateando en él.

`user-switcher.tsx` (cambiar de usuario sin contraseña) se retira: es una
herramienta de demo y con cuentas reales es una puerta trasera.

Lectura y escritura se migran en dos fases (proyectos 2 y 3), no a la vez.

## 9. Qué queda fuera

De este proyecto 1:

- **Proyecto 2** — los hooks leen de la base.
- **Proyecto 3** — las 27 acciones escriben en la base.
- **Proyecto 4** — archivos (avatares, logos, portadas) y vídeo protegido.

Y fuera del producto por ahora: cobros, registro público de empresas, e importar
datos de otra plataforma.

**Dónde se aloja no lo decide este documento.** El esquema y las políticas son
los mismos en Supabase gestionado que en Supabase autoalojado en un servidor
propio. Se empieza en el gestionado; mover no obliga a rehacer nada de aquí.
