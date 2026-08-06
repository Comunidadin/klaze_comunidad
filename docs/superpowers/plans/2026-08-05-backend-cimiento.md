# Cimiento del backend — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans` para ejecutar tarea por tarea.
> Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** llevar Klaze de datos falsos en `localStorage` a una base Postgres
real en Supabase, con cuentas de verdad y aislamiento entre empresas garantizado
por la propia base.

**Arquitectura:** las reglas de acceso viven como políticas RLS pegadas a cada
tabla; la app consulta directamente con la clave publicable. Las comprobaciones
compartidas son funciones `security definer` en un esquema `privado` no expuesto.
Solo el alta de empresas y el envío de invitaciones corren en el servidor.

**Stack:** Supabase (Postgres 15+), CLI de Supabase, `@supabase/supabase-js`,
`@supabase/ssr`, `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-05-backend-cimiento-design.md`

## Restricciones globales

- **No hay Docker en esta máquina.** No existe base local: todas las migraciones
  se aplican al proyecto alojado con `supabase db push --linked`. No usar
  `supabase start`, `db reset` ni `migration up`.
- **Proyecto:** ref `rwqfktltjuztmgggzlqt`, URL `https://rwqfktltjuztmgggzlqt.supabase.co`.
- **Nombres en español, `snake_case`.** Tablas en plural (`comunidades`),
  columnas en singular (`comunidad_id`). Sin `ñ` ni tildes en identificadores SQL.
- **RLS activado en TODAS las tablas de `public`.** Sin excepción, y en la misma
  migración que crea la tabla — nunca en una posterior.
- **Toda función `security definer` lleva `set search_path = ''`** y referencia
  las tablas con esquema explícito (`public.cursos`, no `cursos`). Sin esto la
  función es vulnerable a secuestro de esquema.
- **Toda tabla con política de UPDATE lleva también política de SELECT.** En
  Postgres un UPDATE lee la fila primero; sin SELECT devuelve 0 filas sin error.
- **La clave secreta nunca va en una variable `NEXT_PUBLIC_`.** Solo las pruebas
  la usan, desde `SUPABASE_SECRET_KEY` en `.env.local` (ignorado por git).
- **Verificación:** `bun run build`, `bun run lint` y `bun run test:rls` limpios
  antes de cada commit.

### Prerrequisito humano (bloquea la Tarea 1)

El usuario debe: (1) **rotar la clave secreta** en Project Settings → API Keys
—la actual quedó expuesta en un chat— y (2) pegar la nueva en `.env.local` como
`SUPABASE_SECRET_KEY=sb_secret_...`. Sin ella no se pueden crear usuarios de
prueba y ninguna tarea posterior se puede verificar.

---

### Tarea 1: Andamiaje, enlace al proyecto y arnés de pruebas

Deja el proyecto enlazado y `bun run test:rls` funcionando contra la base real,
todavía sin tablas propias.

**Archivos:**
- Crear: `supabase/config.toml` (lo genera `supabase init`)
- Crear: `tests/rls/ayudas.ts`
- Crear: `tests/rls/conexion.test.ts`
- Modificar: `package.json` (script `test:rls`)
- Modificar: `.gitignore`

- [ ] **Paso 1: Actualizar la CLI**

La instalada es 2.75.0. `supabase db advisors` (Tarea 8) exige 2.81.3+.

```bash
brew upgrade supabase
supabase --version    # debe ser >= 2.81.3
```

- [ ] **Paso 2: Iniciar y enlazar el proyecto**

```bash
cd "/Users/joffrellerena/Desktop/[Claude Code V2]/[Klaze V2]"
supabase init          # responder "no" a generar settings de VS Code/IntelliJ
supabase login         # abre el navegador
supabase link --project-ref rwqfktltjuztmgggzlqt
```

Pedirá la contraseña de la base de datos (la que se guardó al crear el proyecto).

- [ ] **Paso 3: Ignorar los temporales de la CLI**

Añadir al final de `.gitignore`:

```
# Supabase CLI (temporales; las migraciones SÍ se versionan)
supabase/.temp
supabase/.branches
```

- [ ] **Paso 4: Escribir el arnés de pruebas**

Crear `tests/rls/ayudas.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLICABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRETA = process.env.SUPABASE_SECRET_KEY!;

if (!URL || !PUBLICABLE || !SECRETA) {
  throw new Error(
    "Faltan variables. Necesitas NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY en .env.local"
  );
}

/** Cliente con clave secreta: se salta RLS. Solo para montar el escenario. */
export const admin = createClient(URL, SECRETA, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Crea un usuario confirmado y devuelve un cliente ya autenticado como él.
 *
 * Usa contraseña aunque la app use enlace por correo: la API de administración
 * la admite, y es la única forma de obtener una sesión en una prueba sin
 * leer un buzón.
 */
export async function comoUsuario(
  email: string
): Promise<{ id: string; cliente: SupabaseClient }> {
  const password = "prueba-" + email;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`No se pudo crear ${email}: ${error.message}`);

  const cliente = createClient(URL, PUBLICABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: errorSesion } = await cliente.auth.signInWithPassword({
    email,
    password,
  });
  if (errorSesion) throw new Error(`No se pudo entrar como ${email}: ${errorSesion.message}`);

  return { id: data.user.id, cliente };
}

/** Cliente anónimo, sin sesión. Para las pruebas de acceso sin login. */
export function comoAnonimo(): SupabaseClient {
  return createClient(URL, PUBLICABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Borra los usuarios creados por una prueba. Llamar siempre en el cierre. */
export async function limpiarUsuarios(ids: string[]) {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}
```

- [ ] **Paso 5: Escribir la prueba de conexión**

Crear `tests/rls/conexion.test.ts`:

```ts
import { expect, test, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";

const creados: string[] = [];
afterAll(() => limpiarUsuarios(creados));

test("la clave secreta puede crear y autenticar un usuario", async () => {
  const { id, cliente } = await comoUsuario("conexion@prueba.klaze");
  creados.push(id);

  const { data } = await cliente.auth.getUser();
  expect(data.user?.email).toBe("conexion@prueba.klaze");
});

test("un anonimo no ve tablas que no existen todavia", async () => {
  const { error } = await admin.from("comunidades").select("*");
  expect(error?.code).toBe("PGRST205"); // tabla no encontrada
});
```

- [ ] **Paso 6: Añadir el script**

En `package.json`, dentro de `scripts`:

```json
"test:rls": "bun test tests/rls"
```

- [ ] **Paso 7: Ejecutar**

```bash
bun run test:rls
```

Esperado: las dos pruebas PASAN. La segunda pasa *porque* la tabla aún no existe
— confirma que estamos apuntando a una base vacía, no a otra.

- [ ] **Paso 8: Commit**

```bash
git add supabase/ tests/ package.json .gitignore
git commit -m "test(rls): arnes de pruebas de aislamiento y enlace al proyecto"
```

---

### Tarea 2: Perfiles, planes y comunidades

**Interfaces:**
- Produce: tablas `public.perfiles`, `public.planes`, `public.comunidades`;
  trigger `on_auth_user_created`.

**Archivos:**
- Crear: `supabase/migrations/<ts>_base_perfiles_planes_comunidades.sql`
- Crear: `tests/rls/base.test.ts`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/base.test.ts`:

```ts
import { expect, test, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";

const creados: string[] = [];
afterAll(async () => {
  await admin.from("comunidades").delete().eq("slug", "empresa-a");
  await limpiarUsuarios(creados);
});

test("crear una cuenta crea su perfil automaticamente", async () => {
  const { id, cliente } = await comoUsuario("perfil@prueba.klaze");
  creados.push(id);

  const { data } = await cliente.from("perfiles").select("*").eq("id", id).single();
  expect(data?.id).toBe(id);
  expect(data?.rol).toBe("alumno");
});

test("nadie puede editar el perfil de otro", async () => {
  const a = await comoUsuario("a@prueba.klaze");
  const b = await comoUsuario("b@prueba.klaze");
  creados.push(a.id, b.id);

  const { data } = await b.cliente
    .from("perfiles").update({ nombre: "secuestrado" }).eq("id", a.id).select();
  expect(data).toEqual([]); // 0 filas: RLS lo bloqueo
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
bun run test:rls
```

Esperado: FALLA con `PGRST205` (no existe `public.perfiles`).

- [ ] **Paso 3: Crear la migración**

```bash
supabase migration new base_perfiles_planes_comunidades
```

Contenido del archivo generado:

```sql
-- Perfiles: extiende auth.users 1:1. No duplica el correo (vive en auth.users).
create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null default '',
  avatar_url  text not null default '',
  bio         text not null default '',
  rol         text not null default 'alumno'
                check (rol in ('alumno','creador','superadmin')),
  puntos      integer not null default 0,
  creado_el   timestamptz not null default now()
);
alter table public.perfiles enable row level security;

create table public.planes (
  id            text primary key check (id in ('starter','pro','scale')),
  nombre        text not null,
  precio_mes    numeric(10,2) not null default 0,
  max_alumnos   integer not null,
  max_cursos    integer not null,
  destacado     boolean not null default false
);
alter table public.planes enable row level security;

create table public.comunidades (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  nombre         text not null,
  descripcion    text not null default '',
  logo_url       text not null default '',
  color_acento   text not null default '#0073B0',
  propietario_id uuid not null references public.perfiles(id) on delete restrict,
  plan_id        text not null references public.planes(id),
  estado         text not null default 'activa' check (estado in ('activa','suspendida')),
  nombres_niveles text[] not null default '{}',
  marca_auth     jsonb not null default '{}'::jsonb,
  creado_el      timestamptz not null default now()
);
alter table public.comunidades enable row level security;
create index on public.comunidades (propietario_id);

-- Al crearse una cuenta, su perfil. Es un trigger y no codigo de la app para
-- que no exista un instante con cuenta pero sin perfil.
create function public.crear_perfil_al_registrarse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- Politicas. Se afinan en la Tarea 4, cuando existan las inscripciones.
create policy "perfiles: leer el propio"
  on public.perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy "perfiles: editar el propio"
  on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "planes: leer autenticado"
  on public.planes for select to authenticated using (true);

create policy "comunidades: leer la propia"
  on public.comunidades for select to authenticated
  using (propietario_id = (select auth.uid()));

-- Exponer al API. Crear una tabla por SQL no la expone sola.
grant select on public.planes to authenticated;
grant select, update on public.perfiles to authenticated;
grant select on public.comunidades to authenticated;

insert into public.planes (id, nombre, precio_mes, max_alumnos, max_cursos, destacado) values
  ('starter','Starter', 29, 100,  3, false),
  ('pro',    'Pro',     79, 1000, 15, true),
  ('scale',  'Scale',  199, 10000, 100, false);
```

- [ ] **Paso 4: Aplicar y ejecutar**

```bash
supabase db push --linked
bun run test:rls
```

Esperado: las dos pruebas de `base.test.ts` PASAN.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations tests/rls/base.test.ts
git commit -m "feat(db): perfiles, planes y comunidades con RLS y perfil automatico"
```

---

### Tarea 3: Cursos, módulos, lecciones y espacios

**Interfaces:**
- Consume: `public.comunidades`.
- Produce: `public.cursos`, `public.modulos`, `public.lecciones`,
  `public.secciones`, `public.espacios`.

**Archivos:**
- Crear: `supabase/migrations/<ts>_contenido.sql`

- [ ] **Paso 1: Crear la migración**

```bash
supabase migration new contenido
```

```sql
create table public.cursos (
  id             uuid primary key default gen_random_uuid(),
  comunidad_id   uuid not null references public.comunidades(id) on delete cascade,
  slug           text not null,
  titulo         text not null,
  descripcion    text not null default '',
  portada_url    text not null default '',
  precio_referencial numeric(10,2) not null default 0,
  nivel_requerido integer,
  publicado      boolean not null default false,
  creado_el      timestamptz not null default now(),
  unique (comunidad_id, slug)
);
alter table public.cursos enable row level security;

create table public.modulos (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  titulo      text not null,
  orden       integer not null,
  portada_url text
);
alter table public.modulos enable row level security;
create index on public.modulos (curso_id);

create table public.lecciones (
  id           uuid primary key default gen_random_uuid(),
  modulo_id    uuid not null references public.modulos(id) on delete cascade,
  titulo       text not null,
  orden        integer not null,
  tipo         text not null check (tipo in ('video','texto')),
  vimeo_id     text,
  duracion_min integer not null default 0,
  contenido    text not null default '',
  -- Lista de {nombre, url}. Se queda como jsonb: nunca se consulta por
  -- separado ni tiene permisos propios.
  recursos     jsonb not null default '[]'::jsonb
);
alter table public.lecciones enable row level security;
create index on public.lecciones (modulo_id);

-- Los espacios cuelgan del CURSO, no de la comunidad (decision 2.3 del spec).
create table public.secciones (
  id       uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  titulo   text not null,
  orden    integer not null
);
alter table public.secciones enable row level security;
create index on public.secciones (curso_id);

create table public.espacios (
  id           uuid primary key default gen_random_uuid(),
  seccion_id   uuid not null references public.secciones(id) on delete cascade,
  slug         text not null,
  nombre       text not null,
  icono        text not null default '',
  orden        integer not null,
  solo_lectura boolean not null default false
);
alter table public.espacios enable row level security;
create index on public.espacios (seccion_id);

-- Solo el propietario, de momento. El acceso de miembros llega en la Tarea 4,
-- cuando exista `privado.cubre_curso`.
create policy "cursos: propietario ve todo"
  on public.cursos for all to authenticated
  using (exists (select 1 from public.comunidades c
                 where c.id = cursos.comunidad_id
                   and c.propietario_id = (select auth.uid())))
  with check (exists (select 1 from public.comunidades c
                      where c.id = cursos.comunidad_id
                        and c.propietario_id = (select auth.uid())));

grant select, insert, update, delete on
  public.cursos, public.modulos, public.lecciones,
  public.secciones, public.espacios to authenticated;
```

- [ ] **Paso 2: Aplicar**

```bash
supabase db push --linked
bun run test:rls
```

Esperado: las pruebas anteriores siguen PASANDO (no hay nuevas todavía; las
lecturas de contenido se prueban en la Tarea 4, que es cuando existe un miembro
que pueda intentarlas).

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): cursos, modulos, lecciones y espacios por curso"
```

---

### Tarea 4: Inscripciones, funciones de `privado` y aislamiento

El corazón del proyecto. Aquí pasan las pruebas 1, 3, 4 y 5 de la spec.

**Interfaces:**
- Produce: `public.inscripciones`, `public.inscripcion_cursos`,
  `privado.pertenece_a(uuid)`, `privado.cubre_curso(uuid)`,
  `privado.es_propietario_de(uuid)`, `privado.es_superadmin()`,
  `privado.comparte_comunidad_con(uuid)`.

**Archivos:**
- Crear: `supabase/migrations/<ts>_inscripciones_y_aislamiento.sql`
- Crear: `tests/rls/escenario.ts`
- Crear: `tests/rls/aislamiento.test.ts`

- [ ] **Paso 1: Escribir el montador de escenario**

Crear `tests/rls/escenario.ts`:

```ts
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Escenario {
  duenoA: { id: string; cliente: SupabaseClient };
  alumnoA: { id: string; cliente: SupabaseClient };
  duenoB: { id: string; cliente: SupabaseClient };
  alumnoB: { id: string; cliente: SupabaseClient };
  comunidadA: string;
  comunidadB: string;
  cursoAPublicado: string;
  cursoABorrador: string;
  cursoASinAcceso: string;
  cursoB: string;
}

/**
 * Dos empresas completas y aisladas. El alumno A tiene acceso SOLO a
 * `cursoAPublicado` — ni al borrador ni a `cursoASinAcceso` — para que las
 * pruebas puedan distinguir "no ve otra empresa" de "no ve lo que no compro".
 */
export async function montarEscenario(sufijo: string): Promise<Escenario> {
  const duenoA = await comoUsuario(`duenoA-${sufijo}@prueba.klaze`);
  const alumnoA = await comoUsuario(`alumnoA-${sufijo}@prueba.klaze`);
  const duenoB = await comoUsuario(`duenoB-${sufijo}@prueba.klaze`);
  const alumnoB = await comoUsuario(`alumnoB-${sufijo}@prueba.klaze`);

  const comunidad = async (slug: string, propietario: string) => {
    const { data, error } = await admin.from("comunidades")
      .insert({ slug, nombre: slug, propietario_id: propietario, plan_id: "pro" })
      .select("id").single();
    if (error) throw new Error(`comunidad ${slug}: ${error.message}`);
    return data.id as string;
  };

  const curso = async (comunidadId: string, slug: string, publicado: boolean) => {
    const { data, error } = await admin.from("cursos")
      .insert({ comunidad_id: comunidadId, slug, titulo: slug, publicado })
      .select("id").single();
    if (error) throw new Error(`curso ${slug}: ${error.message}`);
    return data.id as string;
  };

  const comunidadA = await comunidad(`empresa-a-${sufijo}`, duenoA.id);
  const comunidadB = await comunidad(`empresa-b-${sufijo}`, duenoB.id);

  const cursoAPublicado = await curso(comunidadA, `a-pub-${sufijo}`, true);
  const cursoABorrador  = await curso(comunidadA, `a-bor-${sufijo}`, false);
  const cursoASinAcceso = await curso(comunidadA, `a-sin-${sufijo}`, true);
  const cursoB          = await curso(comunidadB, `b-pub-${sufijo}`, true);

  const inscribir = async (
    usuario: string, comunidadId: string, cursos: string[], estado = "activo"
  ) => {
    const { data, error } = await admin.from("inscripciones")
      .insert({ usuario_id: usuario, comunidad_id: comunidadId, estado,
                todos_los_cursos: false })
      .select("id").single();
    if (error) throw new Error(`inscripcion: ${error.message}`);
    for (const c of cursos) {
      await admin.from("inscripcion_cursos")
        .insert({ inscripcion_id: data.id, curso_id: c });
    }
    return data.id as string;
  };

  await inscribir(alumnoA.id, comunidadA, [cursoAPublicado, cursoABorrador]);
  await inscribir(alumnoB.id, comunidadB, [cursoB]);

  return { duenoA, alumnoA, duenoB, alumnoB, comunidadA, comunidadB,
           cursoAPublicado, cursoABorrador, cursoASinAcceso, cursoB };
}

export async function desmontar(e: Escenario) {
  await admin.from("comunidades").delete().in("id", [e.comunidadA, e.comunidadB]);
  await limpiarUsuarios([e.duenoA.id, e.alumnoA.id, e.duenoB.id, e.alumnoB.id]);
}
```

- [ ] **Paso 2: Escribir las pruebas que fallan**

Crear `tests/rls/aislamiento.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

let e: Escenario;
beforeAll(async () => { e = await montarEscenario("aisl"); });
afterAll(async () => { await desmontar(e); });

test("1. el alumno de A no ve ningun curso de B", async () => {
  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  const ids = (data ?? []).map((c) => c.id);
  expect(ids).not.toContain(e.cursoB);
});

test("2. el dueno de A no ve inscripciones de B", async () => {
  const { data } = await e.duenoA.cliente
    .from("inscripciones").select("comunidad_id");
  const comunidades = new Set((data ?? []).map((i) => i.comunidad_id));
  expect(comunidades.has(e.comunidadB)).toBe(false);
});

test("3. el alumno de A no ve los borradores de A", async () => {
  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  const ids = (data ?? []).map((c) => c.id);
  expect(ids).toContain(e.cursoAPublicado);
  expect(ids).not.toContain(e.cursoABorrador);
});

test("4. suspender revoca el acceso de verdad", async () => {
  await admin.from("inscripciones")
    .update({ estado: "suspendido" }).eq("usuario_id", e.alumnoA.id);

  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  expect(data ?? []).toEqual([]);

  await admin.from("inscripciones")
    .update({ estado: "activo" }).eq("usuario_id", e.alumnoA.id);
});

test("5. no ve las lecciones de un curso que no cubre su acceso", async () => {
  const { data: mod } = await admin.from("modulos")
    .insert({ curso_id: e.cursoASinAcceso, titulo: "m", orden: 1 })
    .select("id").single();
  await admin.from("lecciones").insert({
    modulo_id: mod!.id, titulo: "secreta", orden: 1, tipo: "texto",
  });

  const { data } = await e.alumnoA.cliente.from("lecciones").select("titulo");
  expect((data ?? []).map((l) => l.titulo)).not.toContain("secreta");
});
```

- [ ] **Paso 3: Ejecutar y ver que falla**

```bash
bun run test:rls
```

Esperado: FALLA — no existe `public.inscripciones`.

- [ ] **Paso 4: Crear la migración**

```bash
supabase migration new inscripciones_y_aislamiento
```

```sql
create table public.inscripciones (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.perfiles(id) on delete cascade,
  comunidad_id     uuid not null references public.comunidades(id) on delete cascade,
  estado           text not null default 'invitado'
                     check (estado in ('invitado','activo','suspendido')),
  todos_los_cursos boolean not null default false,
  creado_el        timestamptz not null default now(),
  unique (usuario_id, comunidad_id)
);
alter table public.inscripciones enable row level security;
create index on public.inscripciones (comunidad_id);

create table public.inscripcion_cursos (
  inscripcion_id uuid not null references public.inscripciones(id) on delete cascade,
  curso_id       uuid not null references public.cursos(id) on delete cascade,
  primary key (inscripcion_id, curso_id)
);
alter table public.inscripcion_cursos enable row level security;

-- Esquema privado: no expuesto al API. Las funciones van aqui por dos motivos:
-- cortan la recursion entre politicas (una funcion security definer no vuelve
-- a evaluar RLS) y no son invocables desde fuera.
create schema privado;
revoke all on schema privado from anon, authenticated;
grant usage on schema privado to postgres;

create function privado.es_superadmin() returns boolean
language sql security definer stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') = 'superadmin';
$$;

create function privado.es_propietario_de(p_comunidad uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.comunidades
    where id = p_comunidad and propietario_id = auth.uid()
  );
$$;

-- Gemelo SQL de resolverEstadoEnrollment: suspendido no pasa de aqui.
create function privado.pertenece_a(p_comunidad uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.inscripciones
    where usuario_id = auth.uid()
      and comunidad_id = p_comunidad
      and estado = 'activo'
  );
$$;

-- Gemelo SQL de enrollmentCubreCurso + cursosVisiblesParaMiembro.
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
      and c.publicado
      and (i.todos_los_cursos or ic.curso_id is not null)
  );
$$;

create function privado.comparte_comunidad_con(p_usuario uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.inscripciones mias
    join public.inscripciones suyas on suyas.comunidad_id = mias.comunidad_id
    where mias.usuario_id = auth.uid()
      and suyas.usuario_id = p_usuario
      and mias.estado = 'activo'
      and suyas.estado = 'activo'
  );
$$;

grant execute on all functions in schema privado to authenticated;

-- Politicas de inscripciones
create policy "inscripciones: la propia o las de mi comunidad"
  on public.inscripciones for select to authenticated
  using (usuario_id = (select auth.uid())
         or privado.es_propietario_de(comunidad_id)
         or privado.es_superadmin());

create policy "inscripciones: las gestiona el propietario"
  on public.inscripciones for all to authenticated
  using (privado.es_propietario_de(comunidad_id) or privado.es_superadmin())
  with check (privado.es_propietario_de(comunidad_id) or privado.es_superadmin());

create policy "inscripcion_cursos: via su inscripcion"
  on public.inscripcion_cursos for select to authenticated
  using (exists (select 1 from public.inscripciones i
                 where i.id = inscripcion_id
                   and (i.usuario_id = (select auth.uid())
                        or privado.es_propietario_de(i.comunidad_id))));

-- Ahora si: acceso de miembros al contenido.
create policy "comunidades: los miembros la ven"
  on public.comunidades for select to authenticated
  using (privado.pertenece_a(id) or privado.es_superadmin());

create policy "cursos: el miembro ve los que cubre su acceso"
  on public.cursos for select to authenticated
  using (privado.cubre_curso(id) or privado.es_superadmin());

create policy "modulos: via su curso"
  on public.modulos for select to authenticated
  using (privado.cubre_curso(curso_id)
         or exists (select 1 from public.cursos c
                    where c.id = curso_id and privado.es_propietario_de(c.comunidad_id)));

create policy "lecciones: via su modulo"
  on public.lecciones for select to authenticated
  using (exists (select 1 from public.modulos m
                 where m.id = modulo_id
                   and (privado.cubre_curso(m.curso_id)
                        or exists (select 1 from public.cursos c
                                   where c.id = m.curso_id
                                     and privado.es_propietario_de(c.comunidad_id)))));

create policy "secciones: via su curso"
  on public.secciones for select to authenticated
  using (privado.cubre_curso(curso_id)
         or exists (select 1 from public.cursos c
                    where c.id = curso_id and privado.es_propietario_de(c.comunidad_id)));

create policy "espacios: via su seccion"
  on public.espacios for select to authenticated
  using (exists (select 1 from public.secciones s
                 where s.id = seccion_id
                   and (privado.cubre_curso(s.curso_id)
                        or exists (select 1 from public.cursos c
                                   where c.id = s.curso_id
                                     and privado.es_propietario_de(c.comunidad_id)))));

-- Perfiles: ahora se pueden ver los companeros de comunidad.
create policy "perfiles: los companeros de comunidad"
  on public.perfiles for select to authenticated
  using (privado.comparte_comunidad_con(id) or privado.es_superadmin());

grant select, insert, update, delete on
  public.inscripciones, public.inscripcion_cursos to authenticated;
```

- [ ] **Paso 5: Aplicar y ejecutar**

```bash
supabase db push --linked
bun run test:rls
```

Esperado: las 5 pruebas de `aislamiento.test.ts` PASAN.

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations tests/rls
git commit -m "feat(db): inscripciones y aislamiento entre empresas via RLS"
```

---

### Tarea 5: Feed, eventos y progreso

**Interfaces:**
- Produce: `public.publicaciones`, `public.comentarios`, `public.me_gusta`,
  `public.eventos`, `public.progreso`.

**Archivos:**
- Crear: `supabase/migrations/<ts>_feed_eventos_progreso.sql`
- Crear: `tests/rls/feed.test.ts`

- [ ] **Paso 1: Escribir las pruebas que fallan**

Crear `tests/rls/feed.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

let e: Escenario;
let publicacionA: string;

beforeAll(async () => {
  e = await montarEscenario("feed");
  const { data: sec } = await admin.from("secciones")
    .insert({ curso_id: e.cursoAPublicado, titulo: "General", orden: 1 })
    .select("id").single();
  const { data: esp } = await admin.from("espacios")
    .insert({ seccion_id: sec!.id, slug: "general", nombre: "General", orden: 1 })
    .select("id").single();
  const { data: pub } = await admin.from("publicaciones").insert({
    curso_id: e.cursoAPublicado, espacio_id: esp!.id,
    autor_id: e.alumnoA.id, titulo: "hola", cuerpo: "de A",
  }).select("id").single();
  publicacionA = pub!.id;
});
afterAll(async () => { await desmontar(e); });

test("6a. el alumno de B no ve publicaciones de A", async () => {
  const { data } = await e.alumnoB.cliente.from("publicaciones").select("id");
  expect((data ?? []).map((p) => p.id)).not.toContain(publicacionA);
});

test("6b. nadie da me gusta a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente.from("me_gusta")
    .insert({ publicacion_id: publicacionA, usuario_id: e.alumnoB.id });
  expect(error).not.toBeNull(); // RLS rechaza el with check
});

test("6c. nadie comenta a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente.from("comentarios")
    .insert({ publicacion_id: publicacionA, autor_id: e.duenoA.id, cuerpo: "x" });
  expect(error).not.toBeNull();
});

test("6d. el progreso es privado", async () => {
  const { data: mod } = await admin.from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "m", orden: 1 })
    .select("id").single();
  const { data: lec } = await admin.from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "l", orden: 1, tipo: "texto" })
    .select("id").single();
  await admin.from("progreso")
    .insert({ usuario_id: e.alumnoA.id, leccion_id: lec!.id });

  const { data } = await e.duenoA.cliente.from("progreso").select("usuario_id");
  expect((data ?? []).map((p) => p.usuario_id)).not.toContain(e.alumnoA.id);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
bun run test:rls
```

Esperado: FALLA — no existe `public.publicaciones`.

- [ ] **Paso 3: Crear la migración**

```bash
supabase migration new feed_eventos_progreso
```

```sql
create table public.publicaciones (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  espacio_id  uuid not null references public.espacios(id) on delete cascade,
  autor_id    uuid not null references public.perfiles(id) on delete cascade,
  titulo      text not null default '',
  cuerpo      text not null,
  fijado      boolean not null default false,
  creado_el   timestamptz not null default now()
);
alter table public.publicaciones enable row level security;
create index on public.publicaciones (curso_id);

create table public.comentarios (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  padre_id       uuid references public.comentarios(id) on delete cascade,
  autor_id       uuid not null references public.perfiles(id) on delete cascade,
  cuerpo         text not null,
  creado_el      timestamptz not null default now()
);
alter table public.comentarios enable row level security;
create index on public.comentarios (publicacion_id);

-- Tabla, no lista dentro de la publicacion: con una lista, dos me-gusta
-- simultaneos se pisan y uno se pierde.
create table public.me_gusta (
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  primary key (publicacion_id, usuario_id)
);
alter table public.me_gusta enable row level security;

create table public.eventos (
  id           uuid primary key default gen_random_uuid(),
  curso_id     uuid not null references public.cursos(id) on delete cascade,
  titulo       text not null,
  descripcion  text not null default '',
  fecha_inicio timestamptz not null,
  duracion_min integer not null default 60,
  url_sala     text not null default ''
);
alter table public.eventos enable row level security;
create index on public.eventos (curso_id);

create table public.progreso (
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  leccion_id    uuid not null references public.lecciones(id) on delete cascade,
  completada_el timestamptz not null default now(),
  primary key (usuario_id, leccion_id)
);
alter table public.progreso enable row level security;

create policy "publicaciones: miembros del curso"
  on public.publicaciones for select to authenticated
  using (privado.cubre_curso(curso_id)
         or exists (select 1 from public.cursos c
                    where c.id = curso_id and privado.es_propietario_de(c.comunidad_id)));

create policy "publicaciones: escribe el autor"
  on public.publicaciones for insert to authenticated
  with check (autor_id = (select auth.uid()) and privado.cubre_curso(curso_id));

create policy "publicaciones: edita el autor"
  on public.publicaciones for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy "publicaciones: borra el autor o el propietario"
  on public.publicaciones for delete to authenticated
  using (autor_id = (select auth.uid())
         or exists (select 1 from public.cursos c
                    where c.id = curso_id and privado.es_propietario_de(c.comunidad_id)));

create policy "comentarios: via su publicacion"
  on public.comentarios for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id and privado.cubre_curso(p.curso_id)));

create policy "comentarios: escribe el autor"
  on public.comentarios for insert to authenticated
  with check (autor_id = (select auth.uid())
              and exists (select 1 from public.publicaciones p
                          where p.id = publicacion_id and privado.cubre_curso(p.curso_id)));

create policy "comentarios: borra el autor"
  on public.comentarios for delete to authenticated
  using (autor_id = (select auth.uid()));

create policy "me_gusta: via su publicacion"
  on public.me_gusta for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id and privado.cubre_curso(p.curso_id)));

create policy "me_gusta: solo el propio"
  on public.me_gusta for insert to authenticated
  with check (usuario_id = (select auth.uid())
              and exists (select 1 from public.publicaciones p
                          where p.id = publicacion_id and privado.cubre_curso(p.curso_id)));

create policy "me_gusta: quita el propio"
  on public.me_gusta for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy "eventos: miembros del curso"
  on public.eventos for select to authenticated
  using (privado.cubre_curso(curso_id));

create policy "eventos: los gestiona el propietario"
  on public.eventos for all to authenticated
  using (exists (select 1 from public.cursos c
                 where c.id = curso_id and privado.es_propietario_de(c.comunidad_id)))
  with check (exists (select 1 from public.cursos c
                      where c.id = curso_id and privado.es_propietario_de(c.comunidad_id)));

create policy "progreso: solo el propio"
  on public.progreso for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

grant select, insert, update, delete on
  public.publicaciones, public.comentarios, public.me_gusta,
  public.eventos, public.progreso to authenticated;
```

- [ ] **Paso 4: Aplicar y ejecutar**

```bash
supabase db push --linked
bun run test:rls
```

Esperado: las 4 pruebas de `feed.test.ts` PASAN.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations tests/rls/feed.test.ts
git commit -m "feat(db): feed, eventos y progreso con RLS por curso"
```

---

### Tarea 6: Invitaciones con token aleatorio y acceso sin sesión

**Interfaces:**
- Produce: `public.invitaciones`, `public.marca_publica(text)`,
  `public.invitacion_publica(text)`, trigger `aceptar_invitaciones_al_entrar`.

**Archivos:**
- Crear: `supabase/migrations/<ts>_invitaciones_y_acceso_publico.sql`
- Crear: `tests/rls/invitaciones.test.ts`

- [ ] **Paso 1: Escribir las pruebas que fallan**

Crear `tests/rls/invitaciones.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, comoAnonimo, comoUsuario, limpiarUsuarios } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

let e: Escenario;
let token: string;
const extra: string[] = [];

beforeAll(async () => {
  e = await montarEscenario("inv");
  const { data } = await admin.from("invitaciones").insert({
    email: "invitado-inv@prueba.klaze", comunidad_id: e.comunidadA,
    todos_los_cursos: true,
  }).select("token").single();
  token = data!.token;
});
afterAll(async () => { await limpiarUsuarios(extra); await desmontar(e); });

test("8a. el token no es adivinable", () => {
  expect(token.length).toBeGreaterThanOrEqual(40);
  expect(token).not.toMatch(/^inv-\d+$/);
});

test("8b. un token inventado no se distingue de uno valido gastado", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.rpc("invitacion_publica", { p_token: "inventado" });
  expect(data ?? []).toEqual([]);
});

test("8c. la invitacion pendiente sí se puede leer sin sesion", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.rpc("invitacion_publica", { p_token: token });
  expect(data?.[0]?.email).toBe("invitado-inv@prueba.klaze");
});

test("8d. un anonimo NO puede leer la tabla de invitaciones", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.from("invitaciones").select("email");
  expect(data ?? []).toEqual([]);
});

test("8e. la marca publica no filtra el propietario", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.rpc("marca_publica", { p_slug: `empresa-a-inv` });
  expect(data?.[0]?.nombre).toBe("empresa-a-inv");
  expect(data?.[0]).not.toHaveProperty("propietario_id");
});

test("8f. al entrar, la invitacion pendiente se convierte en inscripcion", async () => {
  const invitado = await comoUsuario("invitado-inv@prueba.klaze");
  extra.push(invitado.id);

  const { data } = await invitado.cliente
    .from("inscripciones").select("comunidad_id, estado");
  expect(data?.[0]?.comunidad_id).toBe(e.comunidadA);
  expect(data?.[0]?.estado).toBe("activo");
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
bun run test:rls
```

Esperado: FALLA — no existe `public.invitaciones`.

- [ ] **Paso 3: Crear la migración**

```bash
supabase migration new invitaciones_y_acceso_publico
```

```sql
-- Token aleatorio. Los secuenciales de la demo (inv-1, inv-2...) son
-- enumerables y filtran a quien se invito y a que empresa.
create table public.invitaciones (
  id               uuid primary key default gen_random_uuid(),
  token            text not null unique
  -- 'hex' y no 'base64': base64 produce '/' y '+', que hay que escapar en una
  -- URL. Y 'base64url' solo existe desde Postgres 16. Hex son 64 caracteres
  -- seguros en cualquier version.
                     default encode(extensions.gen_random_bytes(32), 'hex'),
  email            text not null,
  comunidad_id     uuid not null references public.comunidades(id) on delete cascade,
  todos_los_cursos boolean not null default false,
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente','aceptada')),
  creada_el        timestamptz not null default now()
);
alter table public.invitaciones enable row level security;
create index on public.invitaciones (lower(email));

create table public.invitacion_cursos (
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  curso_id      uuid not null references public.cursos(id) on delete cascade,
  primary key (invitacion_id, curso_id)
);
alter table public.invitacion_cursos enable row level security;

create policy "invitaciones: solo el propietario"
  on public.invitaciones for all to authenticated
  using (privado.es_propietario_de(comunidad_id) or privado.es_superadmin())
  with check (privado.es_propietario_de(comunidad_id) or privado.es_superadmin());

create policy "invitacion_cursos: via su invitacion"
  on public.invitacion_cursos for all to authenticated
  using (exists (select 1 from public.invitaciones i
                 where i.id = invitacion_id and privado.es_propietario_de(i.comunidad_id)))
  with check (exists (select 1 from public.invitaciones i
                      where i.id = invitacion_id and privado.es_propietario_de(i.comunidad_id)));

-- Acceso sin sesion. Van en `public` porque `anon` debe poder invocarlas, y
-- por eso devuelven un conjunto FIJO de columnas en vez de filas de tabla.
create function public.marca_publica(p_slug text)
returns table (nombre text, logo_url text, color_acento text, marca_auth jsonb)
language sql security definer stable set search_path = '' as $$
  select c.nombre, c.logo_url, c.color_acento, c.marca_auth
  from public.comunidades c
  where c.slug = p_slug and c.estado = 'activa';
$$;

-- Devuelve vacio para token inexistente, aceptado o comunidad suspendida, sin
-- distinguir los casos: distinguirlos confirmaria que tokens existen.
create function public.invitacion_publica(p_token text)
returns table (email text, comunidad_nombre text, comunidad_logo text,
               comunidad_color text, todos_los_cursos boolean, cursos text[])
language sql security definer stable set search_path = '' as $$
  select i.email, c.nombre, c.logo_url, c.color_acento, i.todos_los_cursos,
         coalesce(array_agg(cu.titulo) filter (where cu.titulo is not null), '{}')
  from public.invitaciones i
  join public.comunidades c on c.id = i.comunidad_id
  left join public.invitacion_cursos ic on ic.invitacion_id = i.id
  left join public.cursos cu on cu.id = ic.curso_id
  where i.token = p_token and i.estado = 'pendiente' and c.estado = 'activa'
  group by i.email, c.nombre, c.logo_url, c.color_acento, i.todos_los_cursos;
$$;

grant execute on function public.marca_publica(text) to anon, authenticated;
grant execute on function public.invitacion_publica(text) to anon, authenticated;

-- Al entrar por primera vez, convertir invitaciones pendientes en inscripciones.
-- Trigger y no codigo de la app: evita el estado intermedio "tiene cuenta pero
-- no acceso" y que dos pestañas creen dos inscripciones.
create function public.aceptar_invitaciones_al_entrar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  nueva_inscripcion uuid;
begin
  for inv in
    select * from public.invitaciones
    where lower(email) = lower(new.email) and estado = 'pendiente'
  loop
    insert into public.inscripciones
      (usuario_id, comunidad_id, estado, todos_los_cursos)
    values (new.id, inv.comunidad_id, 'activo', inv.todos_los_cursos)
    on conflict (usuario_id, comunidad_id) do update set estado = 'activo'
    returning id into nueva_inscripcion;

    insert into public.inscripcion_cursos (inscripcion_id, curso_id)
    select nueva_inscripcion, ic.curso_id
    from public.invitacion_cursos ic where ic.invitacion_id = inv.id
    on conflict do nothing;

    update public.invitaciones set estado = 'aceptada' where id = inv.id;
  end loop;
  return new;
end;
$$;

-- Se ejecuta DESPUES del que crea el perfil (orden alfabetico del nombre del
-- trigger: "on_auth_user_created" < "z_aceptar_invitaciones"), porque
-- inscripciones referencia perfiles.
create trigger z_aceptar_invitaciones
  after insert on auth.users
  for each row execute function public.aceptar_invitaciones_al_entrar();

grant select, insert, update, delete on
  public.invitaciones, public.invitacion_cursos to authenticated;
```

- [ ] **Paso 4: Aplicar y ejecutar**

```bash
supabase db push --linked
bun run test:rls
```

Esperado: las 6 pruebas de `invitaciones.test.ts` PASAN.

Si `8a` falla porque el token es corto, revisar que la extensión `pgcrypto` esté
disponible en el esquema `extensions` (viene por defecto en Supabase).

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations tests/rls/invitaciones.test.ts
git commit -m "feat(db): invitaciones con token aleatorio y acceso sin sesion"
```

---

### Tarea 7: Cerrar el registro público y fijar el superadmin

**Archivos:**
- Crear: `tests/rls/privilegios.test.ts`
- Modificar: configuración del proyecto (panel de Supabase)

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/privilegios.test.ts`:

```ts
import { expect, test, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";

const creados: string[] = [];
afterAll(() => limpiarUsuarios(creados));

test("7. nadie puede ascenderse a superadmin desde el navegador", async () => {
  const u = await comoUsuario("escalada@prueba.klaze");
  creados.push(u.id);

  // user_metadata SI es editable por el usuario...
  await u.cliente.auth.updateUser({ data: { rol: "superadmin" } });

  // ...pero es app_metadata lo que lee privado.es_superadmin(), y esa
  // el usuario no la puede tocar. Comprobamos que no gano acceso.
  const { data: sesion } = await u.cliente.auth.getSession();
  const claims = JSON.parse(
    atob(sesion.session!.access_token.split(".")[1])
  );
  expect(claims.app_metadata?.rol ?? "alumno").not.toBe("superadmin");
});

test("7b. el superadmin de verdad se marca desde el servidor", async () => {
  const u = await comoUsuario("jefe@prueba.klaze");
  creados.push(u.id);

  const { error } = await admin.auth.admin.updateUserById(u.id, {
    app_metadata: { rol: "superadmin" },
  });
  expect(error).toBeNull();
});
```

- [ ] **Paso 2: Ejecutar**

```bash
bun run test:rls
```

Esperado: ambas PASAN ya (no requieren migración). Documentan y blindan el
comportamiento — si alguien cambia `es_superadmin()` para leer `user_metadata`,
la primera prueba se pone roja.

- [ ] **Paso 3: Cerrar el registro público**

En el panel: **Authentication → Sign In / Providers → Email**, desactivar
"Allow new users to sign up". El alcance es alta manual; hoy está abierto y
cualquiera con la URL puede crearse una cuenta.

Anotarlo también en `supabase/config.toml`:

```toml
[auth]
enable_signup = false
```

- [ ] **Paso 4: Verificar a mano que el registro está cerrado**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://rwqfktltjuztmgggzlqt.supabase.co/auth/v1/signup" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"colado@prueba.klaze","password":"loquesea123"}'
```

Esperado: `422` (signups not allowed), no `200`.

> Nota: las pruebas usan `admin.auth.admin.createUser`, que sigue funcionando
> con el registro cerrado. Por eso el arnés no se rompe.

- [ ] **Paso 5: Commit**

```bash
git add tests/rls/privilegios.test.ts supabase/config.toml
git commit -m "feat(auth): cerrar registro publico y blindar la marca de superadmin"
```

---

### Tarea 8: Revisión de seguridad y cierre

- [ ] **Paso 1: Ejecutar los advisors**

```bash
supabase db advisors --linked --type security
```

Corregir todo lo que salga. Lo esperable: alguna tabla sin política, o funciones
sin `search_path` fijo. Si aparece una tabla sin RLS, es un error grave — todas
deben tenerlo desde su migración.

- [ ] **Paso 2: Ejecutar la suite completa**

```bash
bun run test:rls
```

Esperado: las 8 pruebas de la spec, verdes:

1. Aislamiento de cursos entre empresas → `aislamiento.test.ts` prueba 1
2. Aislamiento de inscripciones → prueba 2
3. Borradores invisibles para alumnos → prueba 3
4. Suspender revoca acceso real → prueba 4
5. Sin acceso a cursos no comprados → prueba 5
6. Nadie escribe a nombre de otro → `feed.test.ts` 6b, 6c
7. Nadie se asciende a superadmin → `privilegios.test.ts` 7
8. `invitacion_publica` no confirma tokens → `invitaciones.test.ts` 8b

- [ ] **Paso 3: Verificar que la app sigue compilando**

```bash
bun run build && bun run lint
```

Esperado: ambos limpios. La app aún lee datos falsos — eso es correcto, la
migración de lectura es el proyecto 2.

- [ ] **Paso 4: Documentar el estado**

Añadir a `CLAUDE.md`, tras la sección "Resolvers centrales":

```markdown
## Base de datos (proyecto 1 completado)

El esquema vive en `supabase/migrations/`. Las cuatro reglas centrales de la
sección anterior tienen su gemelo SQL en el esquema `privado`
(`pertenece_a`, `cubre_curso`, `es_propietario_de`, `es_superadmin`), y ahí
son inevitables: ninguna consulta las puede rodear.

Al tocar el esquema: `supabase migration new <nombre>`, editar el SQL,
`supabase db push --linked`, y `bun run test:rls` antes de commitear. No hay
base local (esta máquina no tiene Docker): las migraciones van al proyecto
alojado.

RLS activado en toda tabla nueva, en su misma migración. Nunca después.
```

- [ ] **Paso 5: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: documentar el esquema y el flujo de migraciones"
git push origin main
```

---

## Autorrevisión frente a la spec

| Sección de la spec | Tarea |
|---|---|
| §2 Modelo (16 tablas) | 2, 3, 4, 5, 6 |
| §2.1 Desdoblar lo anidado | 3 (módulos, lecciones), 5 (comentarios, me_gusta) |
| §2.2 Acceso a cursos en dos piezas | 4 (`todos_los_cursos` + `inscripcion_cursos`) |
| §2.3 Espacios del curso | 3 (`secciones.curso_id`) |
| §2.4 Tokens aleatorios | 6 (+ prueba 8a) |
| §3.1 Superadmin en `app_metadata` | 4 (función), 7 (prueba) |
| §3.2 Cinco funciones en `privado` | 4 |
| §4 Políticas por tabla | 2, 3, 4, 5, 6 |
| §5 Acceso sin sesión | 6 (`marca_publica`, `invitacion_publica`) |
| §6 Cómo entra la gente | 6 (trigger), 7 (registro cerrado) |
| §7 Las 8 pruebas | 4, 5, 6, 7; verificadas en 8 |
| §8 Migración de la app | **Fuera de alcance: proyecto 2** |

Dos cosas de §8 que este plan **no** hace y quedan para el proyecto 2: corregir
las 4 violaciones de `mocks → hooks → páginas` y retirar `user-switcher.tsx`.
Ninguna es prerrequisito del cimiento — ambas tocan la capa de lectura.
