# Rebanada 4 — `/plataforma` sobre datos reales · Plan de implementación

> **Para quien ejecute esto:** usa `superpowers:executing-plans` tarea a tarea.
> Los pasos van en casillas (`- [ ]`) para poder marcarlos.

**Objetivo:** pasar `/plataforma` de datos semilla a Postgres, permitir dar de
alta una academia desde la pantalla, y hacer que suspender una academia revoque
acceso de verdad.

**Arquitectura:** las lecturas van por RLS desde el navegador, como el resto de
la app. El único código de servidor nuevo es el alta, porque crear una cuenta
exige la API de administración.

**Herramientas:** Next.js 16 (App Router), TypeScript, Supabase, `bun`.

## Restricciones globales

- Toda la UI y la copy, **en español**.
- Ninguna página ni componente importa `src/lib/mocks` directamente.
- RLS activado y política de escritura en toda tabla nueva, en su misma migración.
- Toda función `security definer` lleva `set search_path = ''` y referencia
  tablas con esquema explícito. `tests/rls/auditoria.test.ts` lo verifica.
- **RLS no lanza: filtra.** Toda escritura hace `.select("id")` y lanza si
  vuelve vacío.
- Nunca `user_metadata` para decidir permisos. Los roles van en `app_metadata`.
- Al leer relaciones anidadas, nombrar la clave foránea
  (`perfiles!comunidades_propietario_id_fkey`).
- `setState` nunca síncrono dentro de un efecto: función `async` cuyo `.then()`
  fija el estado.
- Selectores de Zustand: nada de `.filter()`/`.map()` dentro del selector.
- `bun run build` y `bun run lint` limpios antes de cada commit.
- Rama: `backend/rebanada-4`.

---

### Tarea 1: La suspensión revoca acceso de verdad

Hoy `privado.pertenece_a` mira el estado de la **inscripción** y
`privado.es_propietario_de` no mira ninguno, así que suspender una academia solo
cambia una insignia.

El problema al arreglarlo: los miembros leen la fila de `comunidades` a través
de `pertenece_a`. Si le añado el estado sin más, dejan de poder leerla y la app
les enseña "Comunidad no encontrada" en vez de explicar qué pasa.

La solución es partir la pregunta en dos:

- **`privado.inscrito_en(comunidad)`** — ¿tiene inscripción activa? Nada más.
  Es lo que hace hoy `pertenece_a`. Guarda la **fila de la academia**, para que
  la app pueda leer su `estado` y explicarse.
- **`privado.pertenece_a(comunidad)`** — inscrito **y** academia activa. Guarda
  el **contenido**: cursos, lecciones, publicaciones, eventos.

**Archivos:**
- Crear: `supabase/migrations/<timestamp>_suspension_revoca_acceso.sql`
- Modificar: `tests/rls/ayudas.ts` (nuevo `comoSuperadmin`)
- Modificar: `tests/rls/escenario.ts` (el escenario gana un superadmin)
- Crear: `tests/rls/suspension.test.ts`

**Interfaces:**
- Produce: `privado.inscrito_en(uuid) → boolean`, `comoSuperadmin(email)`,
  `Escenario.superadmin: { id: string; cliente: SupabaseClient }`.

- [ ] **Paso 1: Crear el archivo de migración**

```bash
supabase migration new suspension_revoca_acceso
```

- [ ] **Paso 2: Escribir la migración**

En el archivo recién creado:

```sql
-- Suspender una academia no revocaba nada: `pertenece_a` miraba el estado de
-- la inscripcion y `es_propietario_de` no miraba ninguno. El boton del
-- superadmin solo cambiaba una insignia.
--
-- Se parte la pregunta en dos. `inscrito_en` responde "tiene inscripcion
-- activa" y guarda la FILA de la academia; `pertenece_a` responde eso Y ademas
-- "la academia esta activa", y guarda el CONTENIDO. Sin esa division, un
-- miembro de una academia suspendida no podria ni leer la fila, y la app le
-- ensenaria "Comunidad no encontrada" en vez de decirle que esta suspendida.

create or replace function privado.inscrito_en(p_comunidad uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.inscripciones
    where usuario_id = auth.uid()
      and comunidad_id = p_comunidad
      and estado = 'activo'
  );
$$;

create or replace function privado.pertenece_a(p_comunidad uuid)
returns boolean
language sql stable security definer set search_path = ''
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

create or replace function privado.es_propietario_de(p_comunidad uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.comunidades
    where id = p_comunidad
      and propietario_id = auth.uid()
      and estado = 'activa'
  );
$$;

-- Los miembros leen la fila de su academia aunque este suspendida: la politica
-- pasa a `inscrito_en`. El propietario ya la leia por `propietario_id` directo,
-- asi que no hace falta tocar la suya.
drop policy "comunidades: los miembros la ven" on public.comunidades;
create policy "comunidades: los miembros la ven"
  on public.comunidades for select
  using (privado.inscrito_en(id) or privado.es_superadmin());

-- Editar una academia suspendida tampoco. Esta politica usaba `propietario_id`
-- directo y se habria quedado fuera del cambio de `es_propietario_de`.
drop policy "comunidades: el propietario edita la suya" on public.comunidades;
create policy "comunidades: el propietario edita la suya"
  on public.comunidades for update
  using (propietario_id = (select auth.uid()) and estado = 'activa')
  with check (propietario_id = (select auth.uid()) and estado = 'activa');
```

El superadmin queda fuera de todo esto: `es_superadmin()` no consulta ninguna
academia, así que sigue viendo y reactivando una suspendida. Si no fuera así,
suspender sería irreversible.

- [ ] **Paso 3: Añadir `comoSuperadmin` al arnés**

En `tests/rls/ayudas.ts`, junto a `comoUsuario`:

```ts
/**
 * Igual que `comoUsuario`, pero con `rol: superadmin` en `app_metadata`.
 *
 * Va en `app_metadata` y no en `user_metadata` porque el segundo lo edita el
 * propio usuario desde el navegador: cualquiera podria ascenderse solo.
 * `privado.es_superadmin()` lee exactamente este campo.
 */
export async function comoSuperadmin(
  email: string
): Promise<{ id: string; cliente: SupabaseClient }> {
  const password = "prueba-" + email;

  let { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol: "superadmin" },
  });

  if (error?.message?.includes("already been registered")) {
    await borrarPorEmail(email);
    ({ data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { rol: "superadmin" },
    }));
  }

  if (error) throw new Error(`No se pudo crear ${email}: ${error.message}`);
  if (!data?.user) throw new Error(`Supabase no devolvio usuario para ${email}`);

  const cliente = createClient(URL, PUBLICABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: errorSesion } = await cliente.auth.signInWithPassword({
    email,
    password,
  });
  if (errorSesion) {
    throw new Error(`No se pudo entrar como ${email}: ${errorSesion.message}`);
  }

  return { id: data.user.id, cliente };
}
```

`borrarPorEmail` es privada del módulo y ya existe: no hay que exportarla.

- [ ] **Paso 4: Añadir el superadmin al escenario**

En `tests/rls/escenario.ts`, en la interfaz:

```ts
  superadmin: { id: string; cliente: SupabaseClient };
```

En `montarEscenario`, junto a los otros cuatro:

```ts
  const superadmin = await comoSuperadmin(`super-${sufijo}@prueba.klaze`);
```

Añadirlo al `return` y al `desmontar`:

```ts
  await limpiarUsuarios([
    e.duenoA.id, e.alumnoA.id, e.duenoB.id, e.alumnoB.id, e.superadmin.id,
  ]);
```

Y al import: `import { admin, comoSuperadmin, comoUsuario, limpiarUsuarios } from "./ayudas";`

- [ ] **Paso 5: Escribir las pruebas de suspensión**

Crear `tests/rls/suspension.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("susp");
});

afterAll(async () => {
  await desmontar(e);
});

async function estado(valor: "activa" | "suspendida") {
  const { error } = await admin
    .from("comunidades")
    .update({ estado: valor })
    .eq("id", e.comunidadA);
  if (error) throw new Error(error.message);
}

test("con la academia activa, el alumno ve su curso", async () => {
  const { data } = await e.alumnoA.cliente
    .from("cursos")
    .select("id")
    .eq("id", e.cursoAPublicado);
  expect(data ?? []).toHaveLength(1);
});

test("suspendida, el alumno pierde el curso", async () => {
  await estado("suspendida");
  const { data } = await e.alumnoA.cliente
    .from("cursos")
    .select("id")
    .eq("id", e.cursoAPublicado);
  expect(data ?? []).toEqual([]);
});

test("suspendida, el propio dueno pierde sus cursos", async () => {
  const { data } = await e.duenoA.cliente
    .from("cursos")
    .select("id")
    .eq("comunidad_id", e.comunidadA);
  expect(data ?? []).toEqual([]);
});

test("suspendida, ambos siguen leyendo la fila y su estado", async () => {
  // Es lo que permite decirles "tu academia esta suspendida" en vez de
  // ensenarles "Comunidad no encontrada".
  for (const quien of [e.alumnoA, e.duenoA]) {
    const { data } = await quien.cliente
      .from("comunidades")
      .select("id, estado")
      .eq("id", e.comunidadA)
      .maybeSingle();
    expect(data?.estado).toBe("suspendida");
  }
});

test("suspendida, el dueno tampoco puede editarla", async () => {
  const { data } = await e.duenoA.cliente
    .from("comunidades")
    .update({ nombre: "Renombrada" })
    .eq("id", e.comunidadA)
    .select("id");
  expect(data ?? []).toEqual([]);
});

test("el superadmin la sigue viendo y puede reactivarla", async () => {
  const { data: vista } = await e.superadmin.cliente
    .from("comunidades")
    .select("id, estado")
    .eq("id", e.comunidadA)
    .maybeSingle();
  expect(vista?.estado).toBe("suspendida");

  const { data } = await e.superadmin.cliente
    .from("comunidades")
    .update({ estado: "activa" })
    .eq("id", e.comunidadA)
    .select("id");
  expect(data ?? []).toHaveLength(1);
});

test("reactivada, alumno y dueno vuelven a entrar", async () => {
  const { data: delAlumno } = await e.alumnoA.cliente
    .from("cursos")
    .select("id")
    .eq("id", e.cursoAPublicado);
  expect(delAlumno ?? []).toHaveLength(1);

  const { data: delDueno } = await e.duenoA.cliente
    .from("cursos")
    .select("id")
    .eq("comunidad_id", e.comunidadA);
  expect((delDueno ?? []).length).toBeGreaterThan(0);
});
```

- [ ] **Paso 6: Ejecutar las pruebas y verificar que fallan**

```bash
bun run test:rls 2>&1 | tail -20
```

Esperado: fallan las de "suspendida, … pierde …" y "no puede editarla", porque
la migración aún no está aplicada. Si pasan a la primera, la migración ya se
aplicó por error o la prueba no comprueba lo que cree.

- [ ] **Paso 7: Aplicar la migración**

```bash
bun run db:push
```

- [ ] **Paso 8: Ejecutar la suite entera**

```bash
bun run test:rls 2>&1 | tail -20
```

Esperado: **todo verde**, no solo las nuevas. `pertenece_a` la usan 12
políticas: si alguna prueba antigua se pone roja, el cambio rompió algo real y
hay que entenderlo antes de seguir.

- [ ] **Paso 9: Commit**

```bash
git add supabase/migrations tests/rls
git commit -m "fix: suspender una academia revoca acceso de verdad"
```

---

### Tarea 2: Lecturas y escrituras de `/plataforma` por RLS

**Archivos:**
- Crear: `supabase/migrations/<timestamp>_limite_de_comunidades_por_plan.sql`
- Crear: `src/lib/supabase/plataforma.ts`
- Crear: `tests/rls/plataforma.test.ts`

- [ ] **Paso 0: Añadir la columna que falta**

`Plan.limites` tiene tres límites —comunidades, alumnos, cursos— y la pantalla
de planes edita los tres, pero `public.planes` solo tiene `max_alumnos` y
`max_cursos`. Sin esta columna, el campo "Comunidades" se guardaría en el vacío:
la pantalla diría "Plan actualizado" y el número volvería al recargar.

```bash
supabase migration new limite_de_comunidades_por_plan
```

```sql
-- `Plan.limites.comunidades` existe en el tipo y en la pantalla de planes desde
-- el principio, pero nunca tuvo columna: al pasar los planes a la base, editarlo
-- habria dicho "guardado" sin guardar nada.
--
-- Por defecto 1: un creador administra una academia. Los limites no se hacen
-- cumplir todavia (decision de la spec) — este numero es informativo.
alter table public.planes
  add column if not exists max_comunidades integer not null default 1;
```

Aplicar con `bun run db:push`.

**Interfaces:**
- Consume: nada de tareas anteriores.
- Produce:
  - `leerPlataforma(supabase): Promise<DatosPlataforma>`
  - `cambiarEstadoComunidad(supabase, comunidadId: string, estado: "activa" | "suspendida"): Promise<void>`
  - `guardarPlan(supabase, plan: Plan): Promise<void>`
  - `interface DatosPlataforma { academias: AcademiaPlataforma[]; creadores: CreadorPlataforma[]; planes: Plan[] }`
  - `interface AcademiaPlataforma { comunidad: Community; dueno: { id, nombre, email }; plan: Plan; miembros: number }`

- [ ] **Paso 1: Escribir el módulo**

Crear `src/lib/supabase/plataforma.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community, Plan } from "@/lib/types";
import { nombreVisible } from "@/lib/nombre-visible";

export interface DuenoPlataforma {
  id: string;
  nombre: string;
  email: string;
}

export interface AcademiaPlataforma {
  comunidad: Community;
  dueno: DuenoPlataforma;
  plan: Plan;
  /** Inscripciones de cualquier estado — mismo criterio que la tabla de admin. */
  miembros: number;
}

export interface CreadorPlataforma {
  id: string;
  nombre: string;
  email: string;
  academias: Community[];
}

export interface DatosPlataforma {
  academias: AcademiaPlataforma[];
  creadores: CreadorPlataforma[];
  planes: Plan[];
}

/**
 * El nombre de la clave foranea es obligatorio: `comunidades` y `perfiles`
 * tienen mas de un camino entre si, y sin el PostgREST falla con "more than
 * one relationship was found".
 *
 * `inscripciones(count)` cuenta sin traer las filas. Con una academia de mil
 * alumnos, traerlas para hacer `.length` seria absurdo.
 */
const CAMPOS = `
  id, slug, nombre, descripcion, logo_url, color_acento, propietario_id,
  plan_id, estado, nombres_niveles, marca_auth, creado_el,
  perfiles!comunidades_propietario_id_fkey ( id, nombre, email ),
  planes ( id, nombre, precio_mes, max_comunidades, max_alumnos, max_cursos, destacado ),
  inscripciones ( count )
`;

const DUENO_DESCONOCIDO: DuenoPlataforma = {
  id: "",
  nombre: "Sin dueño",
  email: "",
};

function unico<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

interface FilaPlan {
  id: string;
  nombre: string;
  precio_mes: number | string;
  max_comunidades: number;
  max_alumnos: number;
  max_cursos: number;
  destacado: boolean;
}

function aPlan(f: FilaPlan): Plan {
  return {
    id: f.id as Plan["id"],
    nombre: f.nombre,
    // `numeric` de Postgres llega como cadena por el JSON: sin `Number` el
    // precio se concatenaria en vez de sumarse.
    precioMes: Number(f.precio_mes),
    limites: {
      comunidades: f.max_comunidades,
      alumnos: f.max_alumnos,
      cursos: f.max_cursos,
    },
    destacado: f.destacado,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- la fila anidada de
   PostgREST no tiene tipo generado. Se normaliza aqui y no sale del archivo. */
function aComunidad(f: any): Community {
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion ?? "",
    logoUrl: f.logo_url ?? "",
    colorAcento: f.color_acento ?? "",
    ownerId: f.propietario_id,
    plan: f.plan_id as Community["plan"],
    estado: f.estado as Community["estado"],
    nombresNiveles: f.nombres_niveles ?? [],
    // `secciones` es obligatorio en el tipo pero vive en su propia tabla, y
    // ninguna pantalla de /plataforma las usa: traerlas seria una consulta mas
    // para pintar nada.
    secciones: [],
    marcaAuth: f.marca_auth ?? undefined,
    creadoEl: f.creado_el,
  };
}

/**
 * Todo lo que pinta `/plataforma`, en dos consultas.
 *
 * Solo el superadmin ve algo aqui: las politicas de `comunidades` y `perfiles`
 * filtran por `es_superadmin()`. A un creador le devuelve su propia academia y
 * poco mas, que es correcto — la pantalla no es suya y el guard de ruta ya lo
 * manda a `/admin`.
 */
export async function leerPlataforma(
  supabase: SupabaseClient
): Promise<DatosPlataforma> {
  const [comunidades, planes, perfiles] = await Promise.all([
    supabase.from("comunidades").select(CAMPOS).order("creado_el", { ascending: false }),
    supabase.from("planes").select("*").order("precio_mes", { ascending: true }),
    supabase.from("perfiles").select("id, nombre, email, rol"),
  ]);

  if (comunidades.error) {
    throw new Error(`No se pudieron leer las academias: ${comunidades.error.message}`);
  }
  if (planes.error) {
    throw new Error(`No se pudieron leer los planes: ${planes.error.message}`);
  }
  if (perfiles.error) {
    throw new Error(`No se pudieron leer los perfiles: ${perfiles.error.message}`);
  }

  const listaPlanes = ((planes.data ?? []) as FilaPlan[]).map(aPlan);

  const academias: AcademiaPlataforma[] = ((comunidades.data ?? []) as any[]).map((f) => {
    const perfil = unico<{ id: string; nombre: string; email: string }>(f.perfiles);
    const plan = unico<FilaPlan>(f.planes);
    const cuenta = unico<{ count: number }>(f.inscripciones);
    return {
      comunidad: aComunidad(f),
      dueno: perfil
        ? {
            id: perfil.id,
            nombre: nombreVisible(perfil.nombre ?? "", perfil.email ?? ""),
            email: perfil.email ?? "",
          }
        : DUENO_DESCONOCIDO,
      plan: plan ? aPlan(plan) : listaPlanes[0],
      miembros: cuenta?.count ?? 0,
    };
  });

  const creadores: CreadorPlataforma[] = ((perfiles.data ?? []) as any[])
    .filter((p) => p.rol === "creador" || p.rol === "superadmin")
    .map((p) => ({
      id: p.id,
      nombre: nombreVisible(p.nombre ?? "", p.email ?? ""),
      email: p.email ?? "",
      academias: academias
        .filter((a) => a.comunidad.ownerId === p.id)
        .map((a) => a.comunidad),
    }))
    // Un superadmin que no posee ninguna academia no es un creador: sale de la
    // lista para que la cuenta de "creadores" no se infle sola.
    .filter((c) => c.academias.length > 0);

  return { academias, creadores, planes: listaPlanes };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Suspende o reactiva una academia.
 *
 * Suspender revoca acceso real (ver la migracion `suspension_revoca_acceso`):
 * ni el creador ni sus alumnos entran mientras lo este.
 *
 * Lanza si la politica lo rechaza. RLS no lanza —filtra— asi que sin esta
 * comprobacion un creador veria "suspendida" sin que pasara nada.
 */
export async function cambiarEstadoComunidad(
  supabase: SupabaseClient,
  comunidadId: string,
  estado: "activa" | "suspendida"
): Promise<void> {
  const { data, error } = await supabase
    .from("comunidades")
    .update({ estado })
    .eq("id", comunidadId)
    .select("id");

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo cambiar el estado: no tienes permiso");
  }
}

/** Guarda un plan. Solo el superadmin: la politica de `planes` es `es_superadmin()`. */
export async function guardarPlan(
  supabase: SupabaseClient,
  plan: Plan
): Promise<void> {
  const { data, error } = await supabase
    .from("planes")
    .update({
      nombre: plan.nombre,
      precio_mes: plan.precioMes,
      max_comunidades: plan.limites.comunidades,
      max_alumnos: plan.limites.alumnos,
      max_cursos: plan.limites.cursos,
      destacado: plan.destacado,
    })
    .eq("id", plan.id)
    .select("id");

  if (error) throw new Error(`No se pudo guardar el plan: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar el plan: no tienes permiso");
  }
}
```

Los nombres ya estan comprobados contra `src/lib/types.ts`: `Plan.limites` es
un objeto anidado y no campos sueltos, `Community.secciones` es obligatorio, y
`plan`/`estado` son uniones de cadenas que necesitan el `as`. Si algo no
compila, mirar el tipo antes de inventar campos.

- [ ] **Paso 2: Escribir las pruebas**

Crear `tests/rls/plataforma.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import {
  leerPlataforma,
  cambiarEstadoComunidad,
  guardarPlan,
} from "../../src/lib/supabase/plataforma";

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("plat");
});

afterAll(async () => {
  await desmontar(e);
});

test("el superadmin ve las dos academias con dueno, plan y miembros", async () => {
  const { academias } = await leerPlataforma(e.superadmin.cliente);
  const ids = academias.map((a) => a.comunidad.id);
  expect(ids).toContain(e.comunidadA);
  expect(ids).toContain(e.comunidadB);

  const a = academias.find((x) => x.comunidad.id === e.comunidadA)!;
  expect(a.dueno.id).toBe(e.duenoA.id);
  expect(a.plan.id).toBe("pro");
  expect(a.miembros).toBe(1);
});

test("un creador no ve la academia ajena", async () => {
  const { academias } = await leerPlataforma(e.duenoA.cliente);
  const ids = academias.map((x) => x.comunidad.id);
  expect(ids).not.toContain(e.comunidadB);
});

test("un alumno no puede suspender una academia", async () => {
  await expect(
    cambiarEstadoComunidad(e.alumnoA.cliente, e.comunidadA, "suspendida")
  ).rejects.toThrow();
});

test("un creador tampoco puede suspender la suya", async () => {
  // Suspender es del superadmin. Si el creador pudiera, podria dejarse fuera
  // solo y sin forma de volver.
  await expect(
    cambiarEstadoComunidad(e.duenoA.cliente, e.comunidadA, "suspendida")
  ).rejects.toThrow();
});

test("el superadmin suspende y reactiva", async () => {
  await cambiarEstadoComunidad(e.superadmin.cliente, e.comunidadA, "suspendida");
  const { academias } = await leerPlataforma(e.superadmin.cliente);
  expect(
    academias.find((a) => a.comunidad.id === e.comunidadA)?.comunidad.estado
  ).toBe("suspendida");

  await cambiarEstadoComunidad(e.superadmin.cliente, e.comunidadA, "activa");
});

test("un alumno no puede editar un plan", async () => {
  const { planes } = await leerPlataforma(e.superadmin.cliente);
  const pro = planes.find((p) => p.id === "pro")!;
  await expect(
    guardarPlan(e.alumnoA.cliente, { ...pro, precioMes: 1 })
  ).rejects.toThrow();
});

test("el superadmin edita un plan y el cambio se lee", async () => {
  const { planes } = await leerPlataforma(e.superadmin.cliente);
  const pro = planes.find((p) => p.id === "pro")!;
  const original = pro.precioMes;

  await guardarPlan(e.superadmin.cliente, { ...pro, precioMes: 88 });

  const despues = await leerPlataforma(e.superadmin.cliente);
  expect(despues.planes.find((p) => p.id === "pro")?.precioMes).toBe(88);

  // Se restaura: el proyecto es real y compartido, y dejar el plan a 88
  // envenenaria la siguiente ejecucion y el panel del usuario.
  await guardarPlan(e.superadmin.cliente, { ...pro, precioMes: original });
});
```

- [ ] **Paso 3: Ejecutar y verificar verde**

```bash
bun run test:rls 2>&1 | tail -20
```

Si "un creador no ve la academia ajena" falla, revisar las políticas de
`comunidades` antes de tocar el módulo: significaría una fuga entre empresas.

- [ ] **Paso 4: Commit**

```bash
git add src/lib/supabase/plataforma.ts tests/rls/plataforma.test.ts
git commit -m "feat(plataforma): lecturas y escrituras del superadmin por RLS"
```

---

### Tarea 3: Alta de academia desde la pantalla

Hoy la lógica de alta vive dentro de `scripts/crear-academia.ts`. Se saca a un
módulo compartido para que el guion y la pantalla no diverjan.

**Archivos:**
- Crear: `src/lib/academia.ts`
- Modificar: `scripts/crear-academia.ts` (pasa a usar el módulo)
- Crear: `src/app/api/academias/route.ts`
- Crear: `tests/rls/api-academias.test.ts`

**Interfaces:**
- Consume: `Escenario.superadmin` de la Tarea 1.
- Produce:
  - `crearAcademia(admin: SupabaseClient, op: OpcionesAcademia): Promise<ResultadoAcademia>`
  - `interface OpcionesAcademia { email: string; empresa: string; slug: string; planId?: string }`
  - `interface ResultadoAcademia { comunidadId: string; usuarioId: string; yaExistia: boolean; passwordTemporal: string | null }`
  - `POST /api/academias`

- [ ] **Paso 1: Escribir el módulo compartido**

Crear `src/lib/academia.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface OpcionesAcademia {
  email: string;
  empresa: string;
  slug: string;
  /** Por defecto `"pro"`. */
  planId?: string;
}

export interface ResultadoAcademia {
  comunidadId: string;
  usuarioId: string;
  yaExistia: boolean;
  /**
   * Contraseña de un solo uso, o `null` si la cuenta ya existía (entonces la
   * persona entra con la suya). No se guarda en ningún sitio: si se pierde,
   * se pide una nueva desde /login.
   */
  passwordTemporal: string | null;
}

/** Los 9 nombres de nivel por defecto, en orden (nivel 1..9). */
const NIVELES_POR_DEFECTO = [
  "Novato", "Aprendiz", "Practicante", "Competente", "Avanzado",
  "Experto", "Maestro", "Mentor", "Leyenda",
];

/**
 * Contraseña legible pero no adivinable. `randomUUID` es criptográfico; se
 * quitan los guiones y se corta porque una de 32 caracteres nadie la teclea
 * bien, y esta se dicta por teléfono más veces de las que uno cree.
 */
function passwordTemporal(): string {
  return "Klaze-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

/**
 * Da de alta una academia: cuenta del creador, su perfil y la comunidad.
 *
 * Recibe el cliente ya construido en vez de construirlo: el guion de terminal
 * y el Route Handler obtienen la clave secreta de sitios distintos, pero la
 * lógica de alta tiene que ser una sola. Cuando estaba solo dentro del guion,
 * copiarla al handler habría garantizado que dentro de tres meses hicieran
 * cosas distintas.
 *
 * **Idempotente por slug**: repetir no duplica. Es lo primero que uno reejecuta
 * cuando algo sale a medias.
 */
export async function crearAcademia(
  admin: SupabaseClient,
  op: OpcionesAcademia
): Promise<ResultadoAcademia> {
  const { data: existente } = await admin
    .from("comunidades")
    .select("id, propietario_id")
    .eq("slug", op.slug)
    .maybeSingle();

  if (existente) {
    return {
      comunidadId: existente.id,
      usuarioId: existente.propietario_id,
      yaExistia: true,
      passwordTemporal: null,
    };
  }

  // Reutiliza la cuenta si ya existe: puede haberla dejado un intento anterior
  // que creo el usuario y fallo al crear la comunidad.
  const { data: lista } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  let usuarioId = lista?.users?.find(
    (u) => u.email?.toLowerCase() === op.email.toLowerCase()
  )?.id;

  let password: string | null = null;

  if (!usuarioId) {
    password = passwordTemporal();
    const { data, error } = await admin.auth.admin.createUser({
      email: op.email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    if (!data.user) throw new Error("Supabase no devolvio usuario al crearlo");
    usuarioId = data.user.id;
  }

  // El trigger `on_auth_user_created` ya creo el perfil; aqui solo el rol.
  const { error: errRol } = await admin
    .from("perfiles")
    .update({ rol: "creador" })
    .eq("id", usuarioId);
  if (errRol) throw new Error(`No se pudo marcar el rol: ${errRol.message}`);

  const { data: com, error: errCom } = await admin
    .from("comunidades")
    .insert({
      slug: op.slug,
      nombre: op.empresa,
      propietario_id: usuarioId,
      plan_id: op.planId ?? "pro",
      nombres_niveles: NIVELES_POR_DEFECTO,
    })
    .select("id")
    .single();
  if (errCom) throw new Error(`No se pudo crear la comunidad: ${errCom.message}`);

  return {
    comunidadId: com.id,
    usuarioId,
    yaExistia: false,
    passwordTemporal: password,
  };
}
```

- [ ] **Paso 2: Adelgazar el guion**

En `scripts/crear-academia.ts`: borrar `crearAcademia`, `OpcionesAcademia`,
`ResultadoAcademia` y `NIVELES_POR_DEFECTO`; conservar `clienteAdmin()` y el
bloque `if (import.meta.main)`. Importar del módulo:

```ts
import { crearAcademia } from "../src/lib/academia";
```

Y en el bloque principal, pasar el cliente y enseñar la contraseña:

```ts
  const r = await crearAcademia(clienteAdmin(), { email, empresa, slug });

  if (r.yaExistia) {
    console.log(`La academia "${slug}" ya existia. No se ha tocado nada.`);
  } else {
    console.log("Academia creada.");
    console.log(`  comunidad: ${r.comunidadId}`);
    console.log(`  dueno:     ${r.usuarioId}`);
    if (r.passwordTemporal) {
      console.log(`\n  Entra en /login con ${email}`);
      console.log(`  Contrasena temporal: ${r.passwordTemporal}`);
      console.log("  No se guarda en ningun sitio: apuntala ahora.");
    } else {
      console.log(`\n${email} ya tenia cuenta: entra con su contrasena de siempre.`);
    }
  }
```

Comprobar si algún otro archivo importaba `crearAcademia` del guion:

```bash
grep -rn "crear-academia" src/ tests/ scripts/ package.json
```

- [ ] **Paso 3: Escribir el Route Handler**

Crear `src/app/api/academias/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { crearAcademia } from "@/lib/academia";

/**
 * Da de alta una academia. Segundo y ultimo trozo de servidor del proyecto:
 * crear una cuenta exige la API de administracion, que no existe en el
 * navegador.
 *
 * OJO — aqui RLS NO protege nada. La clave secreta se salta todas las
 * politicas, asi que el permiso se comprueba a mano. Es exactamente el tipo de
 * sitio donde se olvida: la primera prueba escrita fue la que verifica que
 * rechaza a quien no es superadmin.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secreta) {
    return NextResponse.json(
      { error: "Faltan variables de servidor: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY" },
      { status: 500 }
    );
  }

  const cabecera = request.headers.get("authorization");
  const jwt = cabecera?.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!jwt) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const admin = createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: quien, error: errorQuien } = await admin.auth.getUser(jwt);
  if (errorQuien || !quien.user) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  // La comprobacion que RLS no hace por nosotros. `app_metadata` y nunca
  // `user_metadata`: el segundo lo edita el propio usuario desde el navegador,
  // asi que cualquiera podria ascenderse solo a superadmin.
  const rol = (quien.user.app_metadata as { rol?: string } | null)?.rol;
  if (rol !== "superadmin") {
    return NextResponse.json({ error: "Solo el superadmin da de alta academias" }, { status: 403 });
  }

  let cuerpo: { email?: string; empresa?: string; slug?: string; planId?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { email, empresa, slug, planId } = cuerpo;
  if (!email || !empresa || !slug) {
    return NextResponse.json(
      { error: "Faltan datos: email, empresa y slug" },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "El identificador solo admite minúsculas, números y guiones" },
      { status: 400 }
    );
  }

  try {
    const r = await crearAcademia(admin, { email, empresa, slug, planId });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear la academia" },
      { status: 500 }
    );
  }
}
```

- [ ] **Paso 4: Escribir las pruebas del handler**

Crear `tests/rls/api-academias.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

const BASE = "http://localhost:3000";
const SLUG = "alta-prueba-api";
const EMAIL = "alta-api@prueba.klaze";

let e: Escenario;
let hayServidor = false;

beforeAll(async () => {
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!hayServidor) return;
  e = await montarEscenario("apiacad");
});

afterAll(async () => {
  if (!hayServidor) return;
  // La academia creada por estas pruebas no cuelga del escenario: se limpia
  // aparte, y ANTES de la cuenta, porque `propietario_id` es ON DELETE RESTRICT.
  await admin.from("comunidades").delete().eq("slug", SLUG);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const creado = data?.users?.find((u) => u.email?.toLowerCase() === EMAIL);
  if (creado) await admin.auth.admin.deleteUser(creado.id);
  await desmontar(e);
});

async function tokenDe(cliente: SupabaseClient): Promise<string> {
  const { data } = await cliente.auth.getSession();
  return data.session!.access_token;
}

function saltar(): boolean {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return true;
  }
  return false;
}

async function alta(token: string | null, cuerpo: unknown) {
  return fetch(`${BASE}/api/academias`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
}

test("sin sesion, rechaza", async () => {
  if (saltar()) return;
  const r = await alta(null, { email: EMAIL, empresa: "X", slug: SLUG });
  expect(r.status).toBe(401);
});

test("un creador no puede dar de alta academias", async () => {
  if (saltar()) return;
  // Si esta prueba se pone roja, cualquier creador puede fabricarse academias
  // y cuentas a voluntad.
  const r = await alta(await tokenDe(e.duenoA.cliente), {
    email: EMAIL,
    empresa: "X",
    slug: SLUG,
  });
  expect(r.status).toBe(403);

  const { data } = await admin.from("comunidades").select("id").eq("slug", SLUG);
  expect(data ?? []).toEqual([]);
});

test("un alumno tampoco", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.alumnoA.cliente), {
    email: EMAIL,
    empresa: "X",
    slug: SLUG,
  });
  expect(r.status).toBe(403);
});

test("faltan datos, responde 400", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.superadmin.cliente), { email: EMAIL });
  expect(r.status).toBe(400);
});

test("un slug con mayusculas o espacios se rechaza", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.superadmin.cliente), {
    email: EMAIL,
    empresa: "X",
    slug: "Mi Empresa",
  });
  expect(r.status).toBe(400);
});

test("el superadmin da de alta y la contrasena temporal sirve para entrar", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.superadmin.cliente), {
    email: EMAIL,
    empresa: "Empresa de Prueba",
    slug: SLUG,
  });
  expect(r.ok).toBe(true);

  const cuerpo = await r.json();
  expect(cuerpo.yaExistia).toBe(false);
  expect(typeof cuerpo.passwordTemporal).toBe("string");

  const { data } = await admin
    .from("comunidades")
    .select("id, nombre, propietario_id")
    .eq("slug", SLUG)
    .maybeSingle();
  expect(data?.nombre).toBe("Empresa de Prueba");
  expect(data?.propietario_id).toBe(cuerpo.usuarioId);

  // Lo que de verdad importa: que esa contrasena abra la puerta. Si no,
  // la pantalla ensena algo que no sirve y el creador se queda fuera.
  const { createClient } = await import("@supabase/supabase-js");
  const suyo = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await suyo.auth.signInWithPassword({
    email: EMAIL,
    password: cuerpo.passwordTemporal,
  });
  expect(error).toBeNull();
});

test("repetir el mismo slug no duplica", async () => {
  if (saltar()) return;
  const r = await alta(await tokenDe(e.superadmin.cliente), {
    email: EMAIL,
    empresa: "Otro nombre",
    slug: SLUG,
  });
  expect(r.ok).toBe(true);

  const cuerpo = await r.json();
  expect(cuerpo.yaExistia).toBe(true);
  expect(cuerpo.passwordTemporal).toBeNull();

  const { data } = await admin.from("comunidades").select("id").eq("slug", SLUG);
  expect(data ?? []).toHaveLength(1);
});
```

- [ ] **Paso 5: Ejecutar con el servidor levantado**

```bash
bun run dev   # en otra terminal
bun run test:rls 2>&1 | tail -20
```

Si sale "SALTADA" en las de API, el servidor no está: estas pruebas no valen
nada saltadas, hay que levantarlo.

- [ ] **Paso 6: Verificar el guion**

```bash
bun run build && bun run lint
```

- [ ] **Paso 7: Commit**

```bash
git add src/lib/academia.ts src/app/api/academias scripts/crear-academia.ts tests/rls/api-academias.test.ts
git commit -m "feat(plataforma): alta de academia desde el servidor, compartida con el guion"
```

---

### Tarea 4: `use-platform` y las cuatro pantallas

**Archivos:**
- Modificar: `src/lib/hooks/use-platform.ts` (reescrito)
- Modificar: `src/app/(superadmin)/plataforma/page.tsx`
- Modificar: `src/app/(superadmin)/plataforma/comunidades/page.tsx`
- Modificar: `src/app/(superadmin)/plataforma/planes/page.tsx`
- Modificar: `src/app/(superadmin)/plataforma/creadores/page.tsx`
- Crear: `src/components/admin/alta-academia-dialog.tsx`

**Interfaces:**
- Consume: `leerPlataforma`, `cambiarEstadoComunidad`, `guardarPlan` (Tarea 2);
  `POST /api/academias` (Tarea 3).
- Produce: `usePlatform(): { academias, creadores, planes, metricas, cargando, recargar }`
  con `metricas: { academiasActivas: number; creadores: number; alumnos: number }`.

- [ ] **Paso 1: Reescribir el hook**

Reemplazar el contenido de `src/lib/hooks/use-platform.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  leerPlataforma,
  type AcademiaPlataforma,
  type CreadorPlataforma,
  type DatosPlataforma,
} from "@/lib/supabase/plataforma";
import type { Plan } from "@/lib/types";

export type { AcademiaPlataforma, CreadorPlataforma };

export interface PlatformMetricas {
  academiasActivas: number;
  creadores: number;
  alumnos: number;
}

export interface UsePlatformResult {
  academias: AcademiaPlataforma[];
  creadores: CreadorPlataforma[];
  planes: Plan[];
  metricas: PlatformMetricas;
  cargando: boolean;
  recargar: () => Promise<void>;
}

const VACIO: DatosPlataforma = { academias: [], creadores: [], planes: [] };

/**
 * Puerta única de datos de `/plataforma`.
 *
 * Ya no hay MRR ni gráfico de crecimiento: eran inventados, y un número falso
 * en un panel de control acaba creyéndose. Quedan tres cuentas reales.
 */
export function usePlatform(): UsePlatformResult {
  const [datos, setDatos] = useState<DatosPlataforma>(VACIO);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setDatos(await leerPlataforma(crearClienteNavegador()));
  }, []);

  useEffect(() => {
    let vivo = true;
    void leerPlataforma(crearClienteNavegador())
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const metricas: PlatformMetricas = {
    academiasActivas: datos.academias.filter((a) => a.comunidad.estado === "activa").length,
    creadores: datos.creadores.length,
    // Suma de inscripciones de todas las academias. Una misma persona en dos
    // academias cuenta dos veces, y es lo que se quiere saber: son dos plazas.
    alumnos: datos.academias.reduce((acc, a) => acc + a.miembros, 0),
  };

  return { ...datos, metricas, cargando, recargar };
}
```

- [ ] **Paso 2: Podar el panel principal**

En `src/app/(superadmin)/plataforma/page.tsx`:

- Cambiar `const { comunidades, metricas } = usePlatform()` por
  `const { academias, metricas, cargando } = usePlatform()`.
- Borrar la `StatCard` de MRR y el gráfico de crecimiento, con sus imports
  (`DollarSign`, `BarChart`, `formatUSD` si queda sin usar).
- Las tres `StatCard` restantes pasan a `metricas.academiasActivas`,
  `metricas.creadores`, `metricas.alumnos`.
- La lista de "comunidades más recientes" usa `academias` y
  `a.comunidad.nombre` / `a.dueno.nombre`.
- Añadir el estado de carga al principio del `return`:

```tsx
  if (cargando) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
```

Ejecutar `bun run build` para que TypeScript señale cada sitio donde el nombre
cambió: es más fiable que buscarlos a ojo.

- [ ] **Paso 3: Escribir el diálogo de alta**

Crear `src/components/admin/alta-academia-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { Plan } from "@/lib/types";

export interface AltaAcademiaDialogProps {
  abierto: boolean;
  onCerrar: () => void;
  planes: Plan[];
  /** Se llama tras un alta correcta: la lista vive en el padre. */
  onCreada: () => void | Promise<void>;
}

/** `Mi Empresa` → `mi-empresa`. Sin acentos: el slug va en la URL. */
function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AltaAcademiaDialog({
  abierto, onCerrar, planes, onCreada,
}: AltaAcademiaDialogProps) {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [planId, setPlanId] = useState(planes[0]?.id ?? "pro");
  const [enviando, setEnviando] = useState(false);
  // Se guarda aparte del formulario: es el resultado, y se enseña una sola vez.
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null);

  const slugEfectivo = slugTocado ? slug : aSlug(empresa);

  function limpiar() {
    setEmpresa(""); setEmail(""); setSlug(""); setSlugTocado(false);
    setCredencial(null); setEnviando(false);
  }

  async function enviar() {
    if (!empresa.trim() || !email.trim() || !slugEfectivo) {
      toast.error("Rellena el nombre, el correo y el identificador.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = crearClienteNavegador();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesión caducó. Vuelve a entrar.");

      const r = await fetch("/api/academias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          empresa: empresa.trim(),
          email: email.trim(),
          slug: slugEfectivo,
          planId,
        }),
      });

      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo crear la academia");

      await onCreada();

      if (cuerpo.yaExistia) {
        toast.info(`Ya existía una academia con el identificador "${slugEfectivo}". No se ha tocado nada.`);
        onCerrar();
        limpiar();
        return;
      }

      if (cuerpo.passwordTemporal) {
        setCredencial({ email: email.trim(), password: cuerpo.passwordTemporal });
      } else {
        toast.success(`Academia creada. ${email.trim()} ya tenía cuenta: entra con su contraseña de siempre.`);
        onCerrar();
        limpiar();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la academia");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(open) => {
        if (!open) { onCerrar(); limpiar(); }
      }}
    >
      <DialogContent>
        {credencial ? (
          <>
            <DialogHeader>
              <DialogTitle>Academia creada</DialogTitle>
              <DialogDescription>
                Pásale estos datos al creador. La contraseña no se guarda en
                ningún sitio y no volverás a verla.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p><span className="text-muted-foreground">Correo:</span> {credencial.email}</p>
              <p className="font-mono">
                <span className="font-sans text-muted-foreground">Contraseña:</span>{" "}
                {credencial.password}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `Correo: ${credencial.email}\nContraseña: ${credencial.password}`
                  );
                  toast.success("Copiado.");
                }}
              >
                <Copy /> Copiar
              </Button>
              <Button onClick={() => { onCerrar(); limpiar(); }}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Dar de alta una academia</DialogTitle>
              <DialogDescription>
                Se crea la cuenta del creador y su academia. Al terminar verás
                una contraseña temporal para pasarle.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="empresa">Nombre de la academia</Label>
                <Input
                  id="empresa"
                  value={empresa}
                  onChange={(ev) => setEmpresa(ev.target.value)}
                  placeholder="Mentoría Élite"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Correo del creador</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="jefe@empresa.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Identificador en la URL</Label>
                <Input
                  id="slug"
                  value={slugEfectivo}
                  onChange={(ev) => { setSlugTocado(true); setSlug(aSlug(ev.target.value)); }}
                  placeholder="mentoria-elite"
                />
                <p className="text-xs text-muted-foreground">
                  Sus alumnos entrarán por /c/{slugEfectivo || "…"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan">Plan</Label>
                <select
                  id="plan"
                  value={planId}
                  onChange={(ev) => setPlanId(ev.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => { onCerrar(); limpiar(); }}>
                Cancelar
              </Button>
              <Button onClick={() => void enviar()} disabled={enviando}>
                {enviando ? "Creando…" : "Crear academia"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Antes de escribirlo, comprobar que `src/components/ui/label.tsx` existe. Si no,
usar un `<label className="text-sm font-medium">` normal.

- [ ] **Paso 4: Conectar el diálogo y las escrituras en `/plataforma/comunidades`**

En `src/app/(superadmin)/plataforma/comunidades/page.tsx`:

- Cambiar `const { comunidades } = usePlatform()` por
  `const { academias, planes, cargando, recargar } = usePlatform()`.
- Quitar `const cambiarEstadoComunidad = useAppStore(...)` y el import de
  `useAppStore`. Importar la función del módulo:

```ts
import { cambiarEstadoComunidad } from "@/lib/supabase/plataforma";
import { crearClienteNavegador } from "@/lib/supabase/client";
```

- El confirmar del `Dialog` pasa a ser `async` y recarga:

```ts
  async function confirmar() {
    if (!pendiente) return;
    try {
      await cambiarEstadoComunidad(
        crearClienteNavegador(),
        pendiente.comunidad.comunidad.id,
        pendiente.nuevoEstado
      );
      await recargar();
      toast.success(
        pendiente.nuevoEstado === "suspendida"
          ? `${pendiente.comunidad.comunidad.nombre} queda suspendida: ni su creador ni sus alumnos podrán entrar.`
          : `${pendiente.comunidad.comunidad.nombre} vuelve a estar activa.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setPendiente(null);
    }
  }
```

El texto de suspender **dice lo que hace ahora**: antes solo cambiaba una
insignia y el mensaje podía ser vago; ahora deja gente fuera y hay que avisarlo.

- Añadir el botón de alta junto al `<h1>`:

```tsx
<Button onClick={() => setAltaAbierta(true)}>Dar de alta</Button>
```

con `const [altaAbierta, setAltaAbierta] = useState(false)` y, al final del
`return`:

```tsx
<AltaAcademiaDialog
  abierto={altaAbierta}
  onCerrar={() => setAltaAbierta(false)}
  planes={planes}
  onCreada={recargar}
/>
```

- Ajustar el resto de referencias: donde había `c.community` ahora hay
  `a.comunidad`, y donde `c.dueno` sigue igual salvo que `dueno.avatarUrl` ya no
  existe (el módulo devuelve `{ id, nombre, email }`) — sustituir el avatar del
  dueño por su correo, que es más útil en esta tabla.

- [ ] **Paso 5: Conectar `/plataforma/planes`**

Quitar `useAppStore`; importar `guardarPlan` de `@/lib/supabase/plataforma` y
`crearClienteNavegador`. El `guardar()` pasa a `async` con `try/catch` y llama a
`recargar()` al terminar. El `onClick` del botón: `onClick={() => void guardar()}`.

- [ ] **Paso 6: Ajustar `/plataforma/creadores`**

Solo cambian los nombres: `creadores[].usuario` desaparece; ahora cada creador es
`{ id, nombre, email, academias }`. Sustituir `c.usuario.nombre` por `c.nombre`,
`c.comunidades` por `c.academias`, y el avatar por el correo.

- [ ] **Paso 7: Verificar**

```bash
bun run lint && bun run build
```

- [ ] **Paso 8: Comprobación manual**

Con `bun run dev`, entrar como superadmin en `/plataforma`:
1. Los tres números salen y cuadran con la base.
2. "Dar de alta" crea una academia y enseña una contraseña.
3. Entrar en una ventana privada con ese correo y esa contraseña: aterriza en
   `/admin` de su academia nueva.
4. Suspenderla desde `/plataforma/comunidades` y recargar la ventana privada:
   el creador ya no entra.
5. Reactivarla y comprobar que vuelve.

Borrar la academia de prueba al terminar.

- [ ] **Paso 9: Commit**

```bash
git add src/lib/hooks/use-platform.ts "src/app/(superadmin)" src/components/admin/alta-academia-dialog.tsx
git commit -m "feat(plataforma): panel sobre datos reales y alta de academia desde la pantalla"
```

---

### Tarea 5: Pantalla de academia suspendida

Sin esto, suspender produce una app rota en vez de una app cerrada: el creador
entra, no ve nada y no sabe por qué.

**Archivos:**
- Crear: `src/components/shared/academia-suspendida.tsx`
- Modificar: `src/app/(creador)/layout.tsx`
- Modificar: `src/app/(miembro)/layout.tsx`

**Interfaces:**
- Consume: `armazon.comunidad.estado`, que ya viaja en el armazón (`cargarArmazon`
  lee `comunidades`, y la política de lectura sigue permitiéndolo tras la Tarea 1).

- [ ] **Paso 1: Comprobar que el estado llega**

```bash
grep -n "estado" src/lib/supabase/consultas.ts
```

Si `cargarArmazon` no copia `estado` a la `Community`, añadirlo. Sin ese campo
la pantalla no puede decidir nada.

- [ ] **Paso 2: Escribir el componente**

Crear `src/components/shared/academia-suspendida.tsx`:

```tsx
import { PauseCircle } from "lucide-react";

export interface AcademiaSuspendidaProps {
  nombre: string;
}

/**
 * Lo que ve alguien cuya academia está suspendida.
 *
 * Existe porque la alternativa era peor: sin ella, las políticas dejan la app
 * sin cursos, sin feed y sin miembros, y quien entra ve una aplicación vacía y
 * rota sin ninguna explicación. Suspender debe cerrar la puerta, no romperla.
 */
export function AcademiaSuspendida({ nombre }: AcademiaSuspendidaProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <PauseCircle className="mx-auto size-10 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold text-foreground">
          {nombre} está suspendida
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          El acceso está pausado temporalmente. Escribe a quien administra la
          plataforma para reactivarla; tus cursos y tu progreso siguen intactos.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Paso 3: Gatear en los dos layouts**

En `src/app/(creador)/layout.tsx` y `src/app/(miembro)/layout.tsx`, **después**
del gate de `!hydrated || !user` que ya existe y antes de pintar el shell:

```tsx
  const comunidad = armazon?.comunidad;
  if (comunidad?.estado === "suspendida" && user.rol !== "superadmin") {
    return <AcademiaSuspendida nombre={comunidad.nombre} />;
  }
```

El superadmin queda fuera: es dueño de una academia y también quien la
reactiva. Si se le cerrara la puerta, tendría que suspenderse a sí mismo para
siempre.

- [ ] **Paso 4: Verificar**

```bash
bun run lint && bun run build
```

Y a mano: suspender la academia de prueba desde `/plataforma` y recargar la
ventana del creador. Debe salir la pantalla, no un error.

- [ ] **Paso 5: Commit**

```bash
git add src/components/shared/academia-suspendida.tsx "src/app/(creador)/layout.tsx" "src/app/(miembro)/layout.tsx"
git commit -m "feat: pantalla clara cuando la academia esta suspendida"
```

---

### Tarea 6: Vaciar el store y borrar los mocks huérfanos

Con `/plataforma` leyendo de Postgres, el store puede quedarse **solo con estado
de interfaz**, que es lo que CLAUDE.md dice que debe contener.

**Archivos:**
- Modificar: `src/lib/store.ts`
- Borrar: `src/lib/hooks/use-users.ts`
- Modificar: `src/lib/hooks/index.ts`
- Borrar: los mocks que se queden sin consumidores
- Modificar: `CLAUDE.md`

- [ ] **Paso 1: Localizar a los consumidores antes de borrar nada**

```bash
grep -rn "usuariosCreados\|comunidadesCreadas\|enrollmentsExtra\|perfilOverrides\|comunidadOverrides\|planOverrides\|resolverComunidad\|resolverPlan\|aplicarPerfilOverride\|useUsuarios" src/ tests/
```

Cada resultado es un sitio que hay que atender. Si alguno está fuera de
`/plataforma` y de `use-users.ts`, **parar y entenderlo**: significa que algo
del área de miembro o de creador sigue dependiendo de datos semilla, y borrarlo
lo rompería en silencio.

- [ ] **Paso 2: Quitar del store lo que ya no se usa**

De `src/lib/store.ts`: los campos `usuariosCreados`, `comunidadesCreadas`,
`enrollmentsExtra`, `perfilOverrides`, `comunidadOverrides`, `planOverrides`;
las acciones `cambiarEstadoComunidad` y `guardarPlan`; y las funciones
`resolverComunidad`, `resolverPlan` y `aplicarPerfilOverride`. Quitar también sus
valores del objeto inicial y los imports de tipos que queden sin uso.

- [ ] **Paso 3: Borrar `use-users.ts`**

```bash
rm src/lib/hooks/use-users.ts
```

Y quitar su línea de `src/lib/hooks/index.ts`.

- [ ] **Paso 4: Borrar los mocks sin consumidores**

```bash
for f in src/lib/mocks/*.ts; do
  n=$(basename "$f" .ts)
  [ "$n" = "index" ] && continue
  usos=$(grep -rl "mocks/$n" src/ tests/ | grep -v "^src/lib/mocks/" | wc -l)
  echo "$n: $usos consumidores"
done
```

Borrar los que salgan a 0 y quitar su línea de `src/lib/mocks/index.ts`.

Un mock que nadie importa es una trampa: el siguiente que busque "de dónde salen
las comunidades" lo encontrará antes que la consulta real. Los que sigan
teniendo consumidores se dejan tal cual.

- [ ] **Paso 5: Actualizar `CLAUDE.md`**

En la sección "El store ya no guarda datos de dominio", quitar la frase que dice
que `/plataforma` es la única área que sigue con datos semilla — ya no lo es.
Añadir a la sección de base de datos que **suspender una academia revoca acceso
real** y que `privado.inscrito_en` existe para poder explicarlo, junto a los
otros resolvers.

- [ ] **Paso 6: Verificar entero**

```bash
bun run lint && bun run build && bun run test:rls 2>&1 | tail -20
```

Con `bun run dev` levantado, para que las pruebas de API no se salten.

- [ ] **Paso 7: Recorrido manual de las tres áreas**

El riesgo de esta tarea es romper algo lejano al borrar. Entrar como alumno,
como creador y como superadmin, y visitar una pantalla de cada área. Modo oscuro
incluido.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "chore: el store se queda solo con estado de interfaz"
```

---

## Al terminar

Usar `superpowers:finishing-a-development-branch`: verificar que las tres
comprobaciones están verdes, y fusionar `backend/rebanada-4` a `main`.

Queda fuera de esta rebanada, y sigue pendiente: **rotar las cuatro credenciales
expuestas** (clave secreta de Supabase, contraseña maestra de la base, clave de
Resend y la contraseña del dueño).
