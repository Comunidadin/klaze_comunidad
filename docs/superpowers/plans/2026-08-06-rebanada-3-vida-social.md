# Rebanada 3 — La vida social: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan
> casillas (`- [ ]`).

**Objetivo:** que el feed, los comentarios, los eventos y el ranking dejen de ser
decorado y vivan en Postgres, con el feed cargando por páginas.

**Arquitectura:** el feed no cabe en el armazón —crece sin techo— así que cada
pantalla pide lo suyo y pagina **por fecha**. Los puntos los otorga un trigger
sobre `progreso`, no la app. El ranking sale de una función, porque un alumno ve
la posición de sus compañeros pero no su progreso.

**Stack:** Supabase (Postgres 17), `@supabase/supabase-js`, Zustand, `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-06-rebanada-3-vida-social-design.md`

## Restricciones globales

- **No hay Docker.** Migraciones con `bun run db:push`.
- **Proyecto:** ref `rwqfktltjuztmgggzlqt`.
- **RLS en toda tabla nueva, en su misma migración**, con `grant` explícito.
- **Toda función `security definer`** lleva `set search_path = ''` y esquema
  explícito en las tablas.
- **Toda tabla necesita política de escritura, no solo de lectura.** El cimiento
  se dejó seis a medias y nadie podía escribir en ellas;
  `tests/rls/auditoria.test.ts` (A2b) lo vigila.
- **Selectores de Zustand:** seleccionar crudo, derivar con `useMemo` fuera.
  Nunca `[]` literal dentro del selector — usa una constante de módulo.
- **`setState` nunca síncrono dentro de un efecto.** El patrón del proyecto es
  una función `async` cuyo `.then()` fija el estado, aunque alguna rama no
  espere nada.
- **Copy en español.**
- **Antes de cada commit:** `bun run build`, `bun run lint` y `bun run test:rls`
  limpios. Punto de partida: **63/63**.

### Aviso de entorno

La carpeta está sincronizada con iCloud y crea copias `nombre 2.ext`. Si algo se
comporta de forma imposible:

```bash
find . -name "* 2.*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.next/*"
```

---

### Tarea 1: Puntos y ranking

**Archivos:**
- Crear: `supabase/migrations/<ts>_puntos_y_ranking.sql`
- Crear: `src/lib/supabase/ranking.ts`
- Modificar: `src/lib/hooks/use-gamification.ts`
- Crear: `tests/rls/ranking.test.ts`

**Interfaces:**
- Produce: `public.ranking_de_comunidad(p_comunidad uuid, p_desde timestamptz)`
  → `table (usuario_id uuid, puntos integer)`
- Produce: `leerRanking(supabase, comunidadId, desde): Promise<Map<string, number>>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/ranking.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { marcarLeccion } from "../../src/lib/supabase/progreso";

let e: Escenario;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("ranking");
  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1 })
    .select("id").single();
  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1, tipo: "texto" })
    .select("id").single();
  leccionId = lec!.id;
});
afterAll(async () => { await desmontar(e); });

async function puntosDe(usuarioId: string): Promise<number> {
  const { data } = await admin.from("perfiles").select("puntos").eq("id", usuarioId).single();
  return data!.puntos;
}

test("completar una leccion suma 10 puntos", async () => {
  const antes = await puntosDe(e.alumnoA.id);
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);
  expect(await puntosDe(e.alumnoA.id)).toBe(antes + 10);
});

test("desmarcarla los resta", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);
  const conPuntos = await puntosDe(e.alumnoA.id);
  await marcarLeccion(e.alumnoA.cliente, leccionId, false);
  expect(await puntosDe(e.alumnoA.id)).toBe(conPuntos - 10);
});

test("borrar una leccion ajusta los puntos de quien la habia completado", async () => {
  // El caso que se olvida siempre: el progreso cae por cascada y los puntos
  // se quedarian inflados si el trigger no cubriera el DELETE.
  const { data: mod } = await admin
    .from("modulos").insert({ curso_id: e.cursoAPublicado, titulo: "M2", orden: 2 })
    .select("id").single();
  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L2", orden: 1, tipo: "texto" })
    .select("id").single();

  await marcarLeccion(e.alumnoA.cliente, lec!.id, true);
  const conPuntos = await puntosDe(e.alumnoA.id);

  await admin.from("lecciones").delete().eq("id", lec!.id);
  expect(await puntosDe(e.alumnoA.id)).toBe(conPuntos - 10);
});

test("el ranking de 7 dias excluye lo mas antiguo", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);
  // Se envejece la fila a 30 dias atras para que caiga fuera de la ventana.
  await admin
    .from("progreso")
    .update({ completada_el: new Date(Date.parse("2026-07-01T00:00:00Z")).toISOString() })
    .eq("usuario_id", e.alumnoA.id)
    .eq("leccion_id", leccionId);

  const hace7 = new Date(Date.parse("2026-08-01T00:00:00Z")).toISOString();
  const { data } = await e.alumnoA.cliente.rpc("ranking_de_comunidad", {
    p_comunidad: e.comunidadA,
    p_desde: hace7,
  });
  const mio = (data ?? []).find((r: { usuario_id: string }) => r.usuario_id === e.alumnoA.id);
  expect(mio?.puntos ?? 0).toBe(0);
});

test("un alumno de otra empresa recibe vacio", async () => {
  const { data } = await e.alumnoB.cliente.rpc("ranking_de_comunidad", {
    p_comunidad: e.comunidadA,
    p_desde: null,
  });
  expect(data ?? []).toEqual([]);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — los puntos no cambian y `ranking_de_comunidad` no existe.

- [ ] **Paso 3: Crear la migración**

```bash
supabase migration new puntos_y_ranking
```

```sql
-- Los puntos los otorga la base, no la app.
--
-- Va aqui y no en el codigo por el mismo motivo que los resolvers del cimiento:
-- si dependiera de que cada pantalla se acuerde de sumar, tarde o temprano una
-- no lo hara. Y cubre gratis el caso que siempre se olvida — al borrar una
-- leccion, su progreso cae por cascada y los puntos se ajustan solos.
create function public.ajustar_puntos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.perfiles set puntos = puntos + 10 where id = new.usuario_id;
    return new;
  else
    update public.perfiles set puntos = greatest(0, puntos - 10)
    where id = old.usuario_id;
    return old;
  end if;
end;
$$;

create trigger al_cambiar_progreso
  after insert or delete on public.progreso
  for each row execute function public.ajustar_puntos();

-- Ranking de una comunidad. Existe porque un alumno debe ver la posicion de sus
-- companeros, pero NO puede leer su progreso: esa tabla es privada. Esta
-- funcion devuelve totales por persona, nunca el detalle de que leccion vio
-- cada uno.
--
-- `p_desde` null = desde siempre. Los periodos salen de `completada_el`, que ya
-- existe, en vez de multiplicar el total por un porcentaje inventado.
create function public.ranking_de_comunidad(
  p_comunidad uuid,
  p_desde timestamptz default null
)
returns table (usuario_id uuid, puntos integer)
language sql security definer stable set search_path = '' as $$
  select p.usuario_id, (count(*) * 10)::integer as puntos
  from public.progreso p
  join public.lecciones l on l.id = p.leccion_id
  join public.modulos m on m.id = l.modulo_id
  join public.cursos c on c.id = m.curso_id
  where c.comunidad_id = p_comunidad
    and (p_desde is null or p.completada_el >= p_desde)
    and (privado.pertenece_a(p_comunidad)
         or privado.es_propietario_de(p_comunidad)
         or privado.es_superadmin())
  group by p.usuario_id;
$$;

grant execute on function public.ranking_de_comunidad(uuid, timestamptz)
  to authenticated;
```

- [ ] **Paso 4: Aplicar y ejecutar**

```bash
bun run db:push
bun run test:rls
```
Esperado: las 5 pruebas de `ranking.test.ts` PASAN.

Si "borrar una leccion ajusta los puntos" falla, comprobar que el trigger
declara `after insert or delete` — con solo `insert` el borrado no lo dispara.

- [ ] **Paso 5: Escribir el acceso a datos**

Crear `src/lib/supabase/ranking.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Puntos por persona en una comunidad, opcionalmente desde una fecha.
 *
 * Devuelve un `Map` y no un array porque quien lo consume ya tiene la lista de
 * miembros y solo necesita cruzar puntos por id.
 */
export async function leerRanking(
  supabase: SupabaseClient,
  comunidadId: string,
  desde: Date | null
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("ranking_de_comunidad", {
    p_comunidad: comunidadId,
    p_desde: desde ? desde.toISOString() : null,
  });
  if (error) throw new Error(`No se pudo leer el ranking: ${error.message}`);

  return new Map(
    ((data ?? []) as { usuario_id: string; puntos: number }[]).map((r) => [
      r.usuario_id,
      r.puntos,
    ])
  );
}
```

- [ ] **Paso 6: Migrar `useGamification`**

Conserva su forma de retorno (`ranking`, `rankingPorPeriodo`, `miNivel`,
`puntosParaSiguiente`). Cambia el origen: en vez de derivar 7d/30d
multiplicando el total por un porcentaje, hace **tres llamadas** a `leerRanking`
—una por periodo, con `desde` distinto— y cruza con los miembros de
`useMembers`.

```ts
const ahora = Date.now();
const DESDE: Record<PeriodoRanking, Date | null> = {
  total: null,
  "30d": new Date(ahora - 30 * 24 * 60 * 60 * 1000),
  "7d": new Date(ahora - 7 * 24 * 60 * 60 * 1000),
};
```

Borrar la función `puntosDelPeriodo` y su comentario: era la que inventaba los
porcentajes.

- [ ] **Paso 7: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(ranking): puntos por leccion completada y ranking por periodos reales"
```

---

### Tarea 2: El feed, paginado por fecha

**Archivos:**
- Crear: `src/lib/supabase/feed.ts`
- Modificar: `src/lib/hooks/use-feed.ts`
- Modificar: `src/components/community/feed.tsx`, `post-card.tsx`, `post-composer.tsx`, `comment-thread.tsx`
- Crear: `tests/rls/feed-paginado.test.ts`

**Interfaces:**
- Produce: `leerPagina(supabase, filtro, antesDe): Promise<PostConAutor[]>`
- Produce: `crearPost`, `alternarMeGusta`, `comentar`, `eliminarPost`, `fijarPost`
- Produce: `useFeed(...)` → `{ posts, fijado, cargando, hayMas, cargarMas, recargar }`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/feed-paginado.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { leerPagina, crearPost } from "../../src/lib/supabase/feed";

let e: Escenario;
let espacioId: string;

beforeAll(async () => {
  e = await montarEscenario("feedpag");
  const { data: sec } = await admin
    .from("secciones")
    .insert({ curso_id: e.cursoAPublicado, titulo: "General", orden: 1 })
    .select("id").single();
  const { data: esp } = await admin
    .from("espacios")
    .insert({ seccion_id: sec!.id, slug: "general", nombre: "General", orden: 1 })
    .select("id").single();
  espacioId = esp!.id;

  // 25 publicaciones con fechas separadas, para que el orden sea inequivoco.
  for (let i = 0; i < 25; i++) {
    await admin.from("publicaciones").insert({
      curso_id: e.cursoAPublicado,
      espacio_id: espacioId,
      autor_id: e.alumnoA.id,
      titulo: `Post ${i}`,
      cuerpo: "x",
      creado_el: new Date(Date.parse("2026-08-01T00:00:00Z") + i * 60_000).toISOString(),
    });
  }
});
afterAll(async () => { await desmontar(e); });

test("la primera pagina trae 20 y la segunda el resto, sin repetir", async () => {
  const filtro = { cursoId: e.cursoAPublicado, espacioId };
  const p1 = await leerPagina(e.alumnoA.cliente, filtro, null);
  expect(p1.length).toBe(20);

  const p2 = await leerPagina(e.alumnoA.cliente, filtro, p1[p1.length - 1].creadoEl);
  expect(p2.length).toBe(5);

  const ids = new Set([...p1, ...p2].map((p) => p.id));
  expect(ids.size).toBe(25);
});

test("publicar entre pagina y pagina NO duplica ni salta ninguna", async () => {
  // El fallo exacto que motiva paginar por fecha: con paginas numeradas, una
  // publicacion nueva desplaza a las demas y la 20 reaparece en la pagina 2.
  const filtro = { cursoId: e.cursoAPublicado, espacioId };
  const p1 = await leerPagina(e.alumnoA.cliente, filtro, null);

  await crearPost(e.alumnoA.cliente, {
    cursoId: e.cursoAPublicado, espacioId, titulo: "Intruso", cuerpo: "y",
  });

  const p2 = await leerPagina(e.alumnoA.cliente, filtro, p1[p1.length - 1].creadoEl);
  const repetidos = p2.filter((x) => p1.some((y) => y.id === x.id));
  expect(repetidos).toEqual([]);
});

test("un alumno de otra empresa no ve nada de este feed", async () => {
  const { data } = await e.alumnoB.cliente.from("publicaciones").select("id");
  expect(data ?? []).toEqual([]);
});

test("nadie publica a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente.from("publicaciones").insert({
    curso_id: e.cursoAPublicado, espacio_id: espacioId,
    autor_id: e.duenoA.id, titulo: "suplantada", cuerpo: "x",
  });
  expect(error).not.toBeNull();
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `src/lib/supabase/feed.ts`.

- [ ] **Paso 3: Escribir el acceso a datos**

Crear `src/lib/supabase/feed.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post, PostComment } from "@/lib/types";

export const POR_PAGINA = 20;

export type PostConAutor = Post & {
  autorNombre: string;
  autorAvatar: string;
  numComentarios: number;
  meGusta: boolean;
};

export interface FiltroFeed {
  cursoId: string;
  espacioId?: string;
}

/**
 * Una página del feed, ordenada de más nueva a más vieja.
 *
 * Se pagina por FECHA (`antesDe`) y no por número de página. Con páginas
 * numeradas, si alguien publica mientras otro lee, la publicación que estaba en
 * la posición 20 pasa a la 21 y reaparece al pedir la página siguiente. Con un
 * corte por fecha eso no puede ocurrir.
 *
 * La publicación fijada NO sale aquí: la trae `leerFijado`, y va fuera de la
 * paginación porque si entrara en el orden por fecha desaparecería en cuanto
 * hubiera 20 publicaciones más nuevas — lo contrario de fijar.
 */
export async function leerPagina(
  supabase: SupabaseClient,
  filtro: FiltroFeed,
  antesDe: string | null
): Promise<PostConAutor[]> {
  let consulta = supabase
    .from("publicaciones")
    .select(
      `id, curso_id, espacio_id, autor_id, titulo, cuerpo, fijado, creado_el,
       perfiles ( nombre, avatar_url ),
       comentarios ( id, autor_id, cuerpo, padre_id, creado_el ),
       me_gusta ( usuario_id )`
    )
    .eq("curso_id", filtro.cursoId)
    .eq("fijado", false)
    .order("creado_el", { ascending: false })
    .limit(POR_PAGINA);

  if (filtro.espacioId) consulta = consulta.eq("espacio_id", filtro.espacioId);
  if (antesDe) consulta = consulta.lt("creado_el", antesDe);

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudo leer el feed: ${error.message}`);

  const { data: sesion } = await supabase.auth.getUser();
  const yo = sesion.user?.id ?? "";

  return (data ?? []).map((f) => aPost(f, yo));
}

/** La publicación fijada del curso, si la hay. Va aparte de la paginación. */
export async function leerFijado(
  supabase: SupabaseClient,
  cursoId: string
): Promise<PostConAutor | null> {
  const { data } = await supabase
    .from("publicaciones")
    .select(
      `id, curso_id, espacio_id, autor_id, titulo, cuerpo, fijado, creado_el,
       perfiles ( nombre, avatar_url ),
       comentarios ( id, autor_id, cuerpo, padre_id, creado_el ),
       me_gusta ( usuario_id )`
    )
    .eq("curso_id", cursoId)
    .eq("fijado", true)
    .limit(1);

  const { data: sesion } = await supabase.auth.getUser();
  const yo = sesion.user?.id ?? "";
  return data?.[0] ? aPost(data[0], yo) : null;
}

interface FilaPerfilAutor {
  nombre: string;
  avatar_url: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- la fila anidada de
   PostgREST no tiene un tipo generado; se normaliza aquí y no sale de este
   archivo. */
function aPost(f: any, yo: string): PostConAutor {
  const perfil = (Array.isArray(f.perfiles) ? f.perfiles[0] : f.perfiles) as
    | FilaPerfilAutor
    | undefined;
  const comentarios = (f.comentarios ?? []) as {
    id: string; autor_id: string; cuerpo: string;
    padre_id: string | null; creado_el: string;
  }[];
  const meGusta = (f.me_gusta ?? []) as { usuario_id: string }[];

  const raices: PostComment[] = comentarios
    .filter((c) => !c.padre_id)
    .map((c) => ({
      id: c.id, autorId: c.autor_id, cuerpo: c.cuerpo, likes: [],
      creadoEl: c.creado_el,
      respuestas: comentarios
        .filter((r) => r.padre_id === c.id)
        .map((r) => ({
          id: r.id, autorId: r.autor_id, cuerpo: r.cuerpo, likes: [],
          respuestas: [], creadoEl: r.creado_el,
        })),
    }));

  return {
    id: f.id, comunidadId: "", cursoId: f.curso_id, autorId: f.autor_id,
    espacioId: f.espacio_id, titulo: f.titulo, cuerpo: f.cuerpo,
    fijado: f.fijado, likes: meGusta.map((m) => m.usuario_id),
    comentarios: raices, creadoEl: f.creado_el,
    autorNombre: perfil?.nombre ?? "", autorAvatar: perfil?.avatar_url ?? "",
    numComentarios: comentarios.length,
    meGusta: meGusta.some((m) => m.usuario_id === yo),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function crearPost(
  supabase: SupabaseClient,
  datos: { cursoId: string; espacioId: string; titulo: string; cuerpo: string }
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const autorId = sesion.user?.id;
  if (!autorId) throw new Error("Publicar requiere una sesión activa");

  const { error } = await supabase.from("publicaciones").insert({
    curso_id: datos.cursoId, espacio_id: datos.espacioId,
    autor_id: autorId, titulo: datos.titulo, cuerpo: datos.cuerpo,
  });
  if (error) throw new Error(`No se pudo publicar: ${error.message}`);
}

/** Alterna el me gusta del usuario de la sesión. Nunca a nombre de otro. */
export async function alternarMeGusta(
  supabase: SupabaseClient,
  publicacionId: string,
  puesto: boolean
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const usuarioId = sesion.user?.id;
  if (!usuarioId) throw new Error("Requiere una sesión activa");

  const { error } = puesto
    ? await supabase
        .from("me_gusta")
        .delete()
        .eq("publicacion_id", publicacionId)
        .eq("usuario_id", usuarioId)
    : await supabase
        .from("me_gusta")
        .insert({ publicacion_id: publicacionId, usuario_id: usuarioId });

  if (error) throw new Error(`No se pudo guardar el me gusta: ${error.message}`);
}

export async function comentar(
  supabase: SupabaseClient,
  publicacionId: string,
  cuerpo: string,
  padreId: string | null
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const autorId = sesion.user?.id;
  if (!autorId) throw new Error("Comentar requiere una sesión activa");

  const { error } = await supabase.from("comentarios").insert({
    publicacion_id: publicacionId, autor_id: autorId, cuerpo, padre_id: padreId,
  });
  if (error) throw new Error(`No se pudo comentar: ${error.message}`);
}

export async function eliminarPost(
  supabase: SupabaseClient,
  publicacionId: string
): Promise<void> {
  const { error } = await supabase.from("publicaciones").delete().eq("id", publicacionId);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
}

/** Fija una publicación, desfijando la anterior del mismo curso: solo una. */
export async function fijarPost(
  supabase: SupabaseClient,
  cursoId: string,
  publicacionId: string
): Promise<void> {
  const { error: err1 } = await supabase
    .from("publicaciones")
    .update({ fijado: false })
    .eq("curso_id", cursoId)
    .eq("fijado", true);
  if (err1) throw new Error(`No se pudo desfijar la anterior: ${err1.message}`);

  const { error: err2 } = await supabase
    .from("publicaciones")
    .update({ fijado: true })
    .eq("id", publicacionId);
  if (err2) throw new Error(`No se pudo fijar: ${err2.message}`);
}
```

- [ ] **Paso 4: Ejecutar las pruebas**

Run: `bun run test:rls`
Esperado: las 4 pruebas de `feed-paginado.test.ts` PASAN.

- [ ] **Paso 5: Reescribir `useFeed`**

Rompe la firma síncrona a propósito: aquí el estado de carga sí es información
que la pantalla necesita.

```ts
export interface UseFeedResult {
  posts: PostConAutor[];
  fijado: PostConAutor | null;
  cargando: boolean;
  hayMas: boolean;
  cargarMas: () => Promise<void>;
  recargar: () => Promise<void>;
}

export function useFeed(
  comunidadId: string,
  cursoId?: string,
  espacioId?: string
): UseFeedResult
```

`hayMas` se deduce de si la última página vino llena (`length === POR_PAGINA`).
El parámetro `orden` desaparece: el feed va siempre por fecha descendente, y
ordenar por popularidad exigiría contar me gusta en la base — otra rebanada.

- [ ] **Paso 6: Adaptar los componentes**

```bash
grep -rn "useFeed\|crearPost\|toggleLike\|comentar\|eliminarPost\|fijarPost" src/app src/components
```

Cada manejador pasa a `async`, llama a la función de `feed.ts`, y luego
`recargar()`. Los que muestran listas añaden un botón "Cargar más" visible solo
cuando `hayMas`.

- [ ] **Paso 7: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(feed): publicaciones, comentarios y me gusta en Postgres, paginados por fecha"
```

---

### Tarea 3: Comentarios de lección

**Archivos:**
- Crear: `supabase/migrations/<ts>_comentarios_leccion.sql`
- Crear: `src/lib/supabase/comentarios-leccion.ts`
- Modificar: `src/lib/hooks/use-lesson-comments.ts`
- Crear: `tests/rls/comentarios-leccion.test.ts`

**Interfaces:**
- Produce: tabla `public.comentarios_leccion`
- Produce: `leerComentarios(supabase, leccionId)`, `comentarLeccion(supabase, leccionId, cuerpo, padreId)`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/comentarios-leccion.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { leerComentarios, comentarLeccion } from "../../src/lib/supabase/comentarios-leccion";

let e: Escenario;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("comlec");
  const { data: mod } = await admin
    .from("modulos").insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1 })
    .select("id").single();
  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1, tipo: "texto" })
    .select("id").single();
  leccionId = lec!.id;
});
afterAll(async () => { await desmontar(e); });

test("un alumno con acceso comenta y lo relee", async () => {
  await comentarLeccion(e.alumnoA.cliente, leccionId, "¿Esto aplica a servicios?", null);
  const lista = await leerComentarios(e.alumnoA.cliente, leccionId);
  expect(lista.map((c) => c.cuerpo)).toContain("¿Esto aplica a servicios?");
});

test("el dueno responde y el alumno lo ve", async () => {
  const lista = await leerComentarios(e.duenoA.cliente, leccionId);
  await comentarLeccion(e.duenoA.cliente, leccionId, "Si, igual.", lista[0].id);

  const trasResponder = await leerComentarios(e.alumnoA.cliente, leccionId);
  expect(trasResponder.some((c) => c.cuerpo === "Si, igual.")).toBe(true);
});

test("un alumno de otra empresa no ve nada", async () => {
  const lista = await leerComentarios(e.alumnoB.cliente, leccionId);
  expect(lista).toEqual([]);
});

test("nadie comenta a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente.from("comentarios_leccion").insert({
    leccion_id: leccionId, autor_id: e.duenoA.id, cuerpo: "suplantado",
  });
  expect(error).not.toBeNull();
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe el módulo ni la tabla.

- [ ] **Paso 3: Crear la migración**

```bash
supabase migration new comentarios_leccion
```

```sql
-- Comentarios dentro de una leccion.
--
-- Antes eran decorado: se generaban de un calculo sobre el id de la leccion,
-- salian solo en el curso 1, y no se guardaban en ninguna parte.
--
-- Tabla propia y no un `leccion_id` opcional en `comentarios`: una columna que
-- a veces apunta a una publicacion y a veces a una leccion obliga a comprobar
-- cual de las dos en cada consulta y en cada politica. Dos tablas con la misma
-- forma son mas aburridas y no se equivocan.
create table public.comentarios_leccion (
  id         uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  padre_id   uuid references public.comentarios_leccion(id) on delete cascade,
  autor_id   uuid not null references public.perfiles(id) on delete cascade,
  cuerpo     text not null,
  creado_el  timestamptz not null default now()
);
alter table public.comentarios_leccion enable row level security;
create index on public.comentarios_leccion (leccion_id);

-- Permisos calcados de los del feed: los lee quien tiene acceso al curso de esa
-- leccion, y el dueno de la academia.
create policy "comentarios_leccion: quien tiene acceso al curso"
  on public.comentarios_leccion for select to authenticated
  using (exists (
    select 1 from public.lecciones l
    join public.modulos m on m.id = l.modulo_id
    join public.cursos c on c.id = m.curso_id
    where l.id = comentarios_leccion.leccion_id
      and (privado.cubre_curso(m.curso_id)
           or privado.es_propietario_de(c.comunidad_id))
  ));

create policy "comentarios_leccion: escribe el autor"
  on public.comentarios_leccion for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.lecciones l
      join public.modulos m on m.id = l.modulo_id
      join public.cursos c on c.id = m.curso_id
      where l.id = comentarios_leccion.leccion_id
        and (privado.cubre_curso(m.curso_id)
             or privado.es_propietario_de(c.comunidad_id))
    )
  );

create policy "comentarios_leccion: edita el autor"
  on public.comentarios_leccion for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy "comentarios_leccion: borra el autor o el propietario"
  on public.comentarios_leccion for delete to authenticated
  using (
    autor_id = (select auth.uid())
    or exists (
      select 1 from public.lecciones l
      join public.modulos m on m.id = l.modulo_id
      join public.cursos c on c.id = m.curso_id
      where l.id = comentarios_leccion.leccion_id
        and privado.es_propietario_de(c.comunidad_id)
    )
  );

grant select, insert, update, delete on public.comentarios_leccion to authenticated;
```

- [ ] **Paso 4: Escribir el acceso a datos**

Crear `src/lib/supabase/comentarios-leccion.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ComentarioLeccion {
  id: string;
  autorId: string;
  autorNombre: string;
  autorAvatar: string;
  cuerpo: string;
  padreId: string | null;
  creadoEl: string;
}

interface FilaPerfilAutor {
  nombre: string;
  avatar_url: string;
}

export async function leerComentarios(
  supabase: SupabaseClient,
  leccionId: string
): Promise<ComentarioLeccion[]> {
  const { data, error } = await supabase
    .from("comentarios_leccion")
    .select("id, autor_id, cuerpo, padre_id, creado_el, perfiles ( nombre, avatar_url )")
    .eq("leccion_id", leccionId)
    .order("creado_el", { ascending: true });

  if (error) throw new Error(`No se pudieron leer los comentarios: ${error.message}`);

  return (data ?? []).map((f) => {
    const perfil = (Array.isArray(f.perfiles) ? f.perfiles[0] : f.perfiles) as
      | FilaPerfilAutor
      | undefined;
    return {
      id: f.id,
      autorId: f.autor_id,
      autorNombre: perfil?.nombre ?? "",
      autorAvatar: perfil?.avatar_url ?? "",
      cuerpo: f.cuerpo,
      padreId: f.padre_id,
      creadoEl: f.creado_el,
    };
  });
}

/** El autor sale de la sesión: no hay forma de comentar a nombre de otro. */
export async function comentarLeccion(
  supabase: SupabaseClient,
  leccionId: string,
  cuerpo: string,
  padreId: string | null
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const autorId = sesion.user?.id;
  if (!autorId) throw new Error("Comentar requiere una sesión activa");

  const { error } = await supabase.from("comentarios_leccion").insert({
    leccion_id: leccionId, autor_id: autorId, cuerpo, padre_id: padreId,
  });
  if (error) throw new Error(`No se pudo comentar: ${error.message}`);
}
```

- [ ] **Paso 5: Aplicar, ejecutar y migrar el hook**

```bash
bun run db:push
bun run test:rls
```
Esperado: las 4 pruebas PASAN.

`useLessonComments(leccionId)` pasa a `{ comentarios, cargando, agregar }`,
donde `agregar(cuerpo, padreId)` ya no recibe `userId` — sale de la sesión.
Borrar `PLANTILLAS`, `hashDeterministico` y `comentariosSemilla`.

- [ ] **Paso 6: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(lecciones): comentarios reales bajo cada leccion"
```

---

### Tarea 4: Espacios y eventos

**Archivos:**
- Crear: `src/lib/supabase/espacios.ts`, `src/lib/supabase/eventos.ts`
- Modificar: `src/lib/hooks/use-espacios.ts`, `src/lib/hooks/use-events.ts`
- Modificar: `src/app/(creador)/admin/eventos/page.tsx`, `src/app/(creador)/admin/comunidad/page.tsx`
- Modificar: `src/app/(creador)/admin/cursos/page.tsx` (espacios por defecto al crear)
- Crear: `tests/rls/espacios-eventos.test.ts`

**Interfaces:**
- Produce: `leerSecciones(supabase, cursoId)`, `guardarSecciones(supabase, cursoId, secciones)`
- Produce: `leerEventos(supabase, cursoId)`, `guardarEvento(supabase, evento)`, `eliminarEvento(supabase, id)`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/espacios-eventos.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { guardarSecciones, leerSecciones } from "../../src/lib/supabase/espacios";
import { guardarEvento, leerEventos, eliminarEvento } from "../../src/lib/supabase/eventos";

let e: Escenario;
beforeAll(async () => { e = await montarEscenario("espev"); });
afterAll(async () => { await desmontar(e); });

test("el dueno guarda secciones con sus espacios y las relee", async () => {
  await guardarSecciones(e.duenoA.cliente, e.cursoAPublicado, [
    { id: crypto.randomUUID(), titulo: "Comienza aquí", orden: 1, espacios: [
      { id: crypto.randomUUID(), slug: "anuncios", nombre: "Anuncios",
        icono: "📣", orden: 1, soloLectura: true },
    ]},
  ]);

  const leidas = await leerSecciones(e.duenoA.cliente, e.cursoAPublicado);
  expect(leidas.length).toBe(1);
  expect(leidas[0].espacios[0].nombre).toBe("Anuncios");
  expect(leidas[0].espacios[0].soloLectura).toBe(true);
});

test("un alumno con acceso ve los espacios; uno de otra empresa no", async () => {
  expect((await leerSecciones(e.alumnoA.cliente, e.cursoAPublicado)).length).toBe(1);
  expect((await leerSecciones(e.alumnoB.cliente, e.cursoAPublicado)).length).toBe(0);
});

test("guardar sin una seccion la borra de verdad", async () => {
  await guardarSecciones(e.duenoA.cliente, e.cursoAPublicado, []);
  expect((await leerSecciones(e.duenoA.cliente, e.cursoAPublicado)).length).toBe(0);
});

test("el dueno crea un evento y el alumno lo ve", async () => {
  await guardarEvento(e.duenoA.cliente, {
    id: crypto.randomUUID(), cursoId: e.cursoAPublicado, comunidadId: e.comunidadA,
    titulo: "Sesión en vivo", descripcion: "", duracionMin: 60,
    fechaInicio: "2026-09-01T18:00:00Z", urlSala: "https://meet.example/x",
  });

  const delAlumno = await leerEventos(e.alumnoA.cliente, e.cursoAPublicado);
  expect(delAlumno.map((v) => v.titulo)).toContain("Sesión en vivo");

  const deOtraEmpresa = await leerEventos(e.alumnoB.cliente, e.cursoAPublicado);
  expect(deOtraEmpresa).toEqual([]);
});

test("un alumno no puede crear eventos", async () => {
  await expect(
    guardarEvento(e.alumnoA.cliente, {
      id: crypto.randomUUID(), cursoId: e.cursoAPublicado, comunidadId: e.comunidadA,
      titulo: "Colado", descripcion: "", duracionMin: 30,
      fechaInicio: "2026-09-02T18:00:00Z", urlSala: "",
    })
  ).rejects.toThrow();
});

test("el dueno borra su evento", async () => {
  const antes = await leerEventos(e.duenoA.cliente, e.cursoAPublicado);
  await eliminarEvento(e.duenoA.cliente, antes[0].id);
  expect((await leerEventos(e.duenoA.cliente, e.cursoAPublicado)).length).toBe(antes.length - 1);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existen los módulos.

- [ ] **Paso 3: Escribir `espacios.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunitySection } from "@/lib/types";

export async function leerSecciones(
  supabase: SupabaseClient,
  cursoId: string
): Promise<CommunitySection[]> {
  const { data, error } = await supabase
    .from("secciones")
    .select("id, titulo, orden, espacios ( id, slug, nombre, icono, orden, solo_lectura )")
    .eq("curso_id", cursoId)
    .order("orden");

  if (error) throw new Error(`No se pudieron leer los espacios: ${error.message}`);

  return (data ?? []).map((s) => ({
    id: s.id,
    titulo: s.titulo,
    orden: s.orden,
    espacios: ((s.espacios ?? []) as {
      id: string; slug: string; nombre: string;
      icono: string; orden: number; solo_lectura: boolean;
    }[])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((e) => ({
        id: e.id, slug: e.slug, nombre: e.nombre,
        icono: e.icono, orden: e.orden, soloLectura: e.solo_lectura,
      })),
  }));
}

/**
 * Guarda la estructura completa de espacios de un curso.
 *
 * Borra lo que ya no está, igual que `guardarCurso`: sin esa limpieza, quitar
 * un espacio en el editor no lo quitaría de la base y reaparecería al recargar.
 * Los espacios de una sección eliminada caen por cascada.
 */
export async function guardarSecciones(
  supabase: SupabaseClient,
  cursoId: string,
  secciones: CommunitySection[]
): Promise<void> {
  const ids = secciones.map((s) => s.id);
  const borrar = supabase.from("secciones").delete().eq("curso_id", cursoId);
  const { error: errBorrar } = ids.length
    ? await borrar.not("id", "in", `(${ids.join(",")})`)
    : await borrar;
  if (errBorrar) throw new Error(`No se pudieron limpiar los espacios: ${errBorrar.message}`);

  if (secciones.length === 0) return;

  const { error: errSec } = await supabase.from("secciones").upsert(
    secciones.map((s) => ({ id: s.id, curso_id: cursoId, titulo: s.titulo, orden: s.orden }))
  );
  if (errSec) throw new Error(`No se pudieron guardar las secciones: ${errSec.message}`);

  for (const seccion of secciones) {
    const idsEsp = seccion.espacios.map((e) => e.id);
    const borrarEsp = supabase.from("espacios").delete().eq("seccion_id", seccion.id);
    const { error: e1 } = idsEsp.length
      ? await borrarEsp.not("id", "in", `(${idsEsp.join(",")})`)
      : await borrarEsp;
    if (e1) throw new Error(`No se pudieron limpiar los espacios: ${e1.message}`);

    if (seccion.espacios.length === 0) continue;

    const { error: e2 } = await supabase.from("espacios").upsert(
      seccion.espacios.map((e) => ({
        id: e.id, seccion_id: seccion.id, slug: e.slug, nombre: e.nombre,
        icono: e.icono, orden: e.orden, solo_lectura: e.soloLectura ?? false,
      }))
    );
    if (e2) throw new Error(`No se pudieron guardar los espacios: ${e2.message}`);
  }
}
```

- [ ] **Paso 4: Escribir `eventos.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityEvent } from "@/lib/types";

export async function leerEventos(
  supabase: SupabaseClient,
  cursoId: string
): Promise<CommunityEvent[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select("id, curso_id, titulo, descripcion, fecha_inicio, duracion_min, url_sala")
    .eq("curso_id", cursoId)
    .order("fecha_inicio");

  if (error) throw new Error(`No se pudieron leer los eventos: ${error.message}`);

  return (data ?? []).map((f) => ({
    id: f.id,
    comunidadId: "",
    cursoId: f.curso_id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    fechaInicio: f.fecha_inicio,
    duracionMin: f.duracion_min,
    urlSala: f.url_sala,
  }));
}

export async function guardarEvento(
  supabase: SupabaseClient,
  evento: CommunityEvent
): Promise<void> {
  const { data, error } = await supabase
    .from("eventos")
    .upsert({
      id: evento.id, curso_id: evento.cursoId, titulo: evento.titulo,
      descripcion: evento.descripcion, fecha_inicio: evento.fechaInicio,
      duracion_min: evento.duracionMin, url_sala: evento.urlSala,
    })
    .select("id");

  if (error) throw new Error(`No se pudo guardar el evento: ${error.message}`);
  // RLS no lanza: filtra. Un upsert rechazado por politica vuelve sin error y
  // sin filas, y devolver eso en silencio haria creer que el evento existe.
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar el evento: sin permiso sobre ese curso");
  }
}

export async function eliminarEvento(
  supabase: SupabaseClient,
  eventoId: string
): Promise<void> {
  const { error } = await supabase.from("eventos").delete().eq("id", eventoId);
  if (error) throw new Error(`No se pudo eliminar el evento: ${error.message}`);
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Run: `bun run test:rls`
Esperado: las 6 pruebas PASAN.

- [ ] **Paso 6: Migrar hooks y pantallas**

`useEspacios(comunidadId, cursoId?)` y `useEvents(comunidadId, cursoId?)`
conservan su forma de retorno; cambian el origen y ganan `recargar`.

En `admin/cursos/page.tsx`, un curso nuevo vuelve a nacer con sus espacios por
defecto: tras `guardarCurso`, llamar a `guardarSecciones` con
`crearSeccionesDefault(curso.id)`. La rebanada 1 lo desactivó porque no había
dónde guardarlos; ahora sí lo hay.

**Mover `crearSeccionesDefault` fuera de los mocks primero.** Vive hoy en
`src/lib/mocks/espacios.ts`, pero no es un dato semilla: es una fábrica de
contenido por defecto que va a usar código de producción. Dejarla ahí
convertiría `admin/cursos/page.tsx` en una violación nueva de
`mocks → hooks → páginas`, justo cuando estamos cerrando la última.

```bash
git mv src/lib/mocks/espacios.ts src/lib/espacios-default.ts
grep -rln "mocks/espacios" src | xargs sed -i '' 's|@/lib/mocks/espacios|@/lib/espacios-default|g'
```

Quitar del archivo movido lo que sí era semilla (los espacios de ejemplo del
seed), dejando solo `crearSeccionesDefault`.

- [ ] **Paso 7: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(comunidad): espacios y eventos en la base"
```

---

### Tarea 5: Perfil y comunidad

Cierra la última violación de `mocks → hooks → páginas`.

**Archivos:**
- Crear: `src/lib/supabase/perfil.ts`
- Modificar: `src/app/(miembro)/perfil/page.tsx`
- Modificar: `src/app/(creador)/admin/configuracion/page.tsx`
- Modificar: `src/lib/hooks/use-my-community.ts`, `use-community.ts`
- Crear: `tests/rls/perfil.test.ts`

**Interfaces:**
- Produce: `actualizarPerfil(supabase, { nombre, bio })`, `guardarComunidad(supabase, comunidadId, cambios)`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/perfil.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { actualizarPerfil, guardarComunidad } from "../../src/lib/supabase/perfil";
import { cargarArmazon } from "../../src/lib/supabase/consultas";

let e: Escenario;
beforeAll(async () => { e = await montarEscenario("perfil"); });
afterAll(async () => { await desmontar(e); });

test("cada cual edita su propio perfil", async () => {
  await actualizarPerfil(e.alumnoA.cliente, { nombre: "Ana Real", bio: "Vendo cosas" });
  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.perfil.nombre).toBe("Ana Real");
  expect(armazon.perfil.bio).toBe("Vendo cosas");
});

test("el dueno cambia el nombre y el color de su academia", async () => {
  await guardarComunidad(e.duenoA.cliente, e.comunidadA, {
    nombre: "Academia Nueva", colorAcento: "#123456",
  });
  const armazon = await cargarArmazon(e.duenoA.cliente);
  expect(armazon.comunidad?.nombre).toBe("Academia Nueva");
  expect(armazon.comunidad?.colorAcento).toBe("#123456");
});

test("un alumno no puede renombrar la academia", async () => {
  await expect(
    guardarComunidad(e.alumnoA.cliente, e.comunidadA, { nombre: "Secuestrada" })
  ).rejects.toThrow();
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `src/lib/supabase/perfil.ts`.

- [ ] **Paso 3: Escribir el acceso a datos**

Crear `src/lib/supabase/perfil.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/types";

/** El id sale de la sesión: no existe forma de editar el perfil de otro. */
export async function actualizarPerfil(
  supabase: SupabaseClient,
  cambios: { nombre: string; bio: string }
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const id = sesion.user?.id;
  if (!id) throw new Error("Editar el perfil requiere una sesión activa");

  const { error } = await supabase
    .from("perfiles")
    .update({ nombre: cambios.nombre, bio: cambios.bio })
    .eq("id", id);
  if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`);
}

export type CambiosComunidad = Partial<
  Pick<Community, "nombre" | "logoUrl" | "colorAcento" | "nombresNiveles" | "marcaAuth">
>;

export async function guardarComunidad(
  supabase: SupabaseClient,
  comunidadId: string,
  cambios: CambiosComunidad
): Promise<void> {
  const fila: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) fila.nombre = cambios.nombre;
  if (cambios.logoUrl !== undefined) fila.logo_url = cambios.logoUrl;
  if (cambios.colorAcento !== undefined) fila.color_acento = cambios.colorAcento;
  if (cambios.nombresNiveles !== undefined) fila.nombres_niveles = cambios.nombresNiveles;
  if (cambios.marcaAuth !== undefined) fila.marca_auth = cambios.marcaAuth;

  const { data, error } = await supabase
    .from("comunidades")
    .update(fila)
    .eq("id", comunidadId)
    .select("id");

  if (error) throw new Error(`No se pudo guardar la academia: ${error.message}`);
  // RLS no lanza: filtra. Sin filas, el update fue rechazado por politica.
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar la academia: no es tuya");
  }
}
```

- [ ] **Paso 4: Migrar las pantallas y quitar los overrides**

`perfil/page.tsx` deja de importar mocks (última violación) y de leer
`perfilOverrides`. `admin/configuracion/page.tsx` llama a `guardarComunidad` y
refresca el armazón.

`useMyCommunity` y `useCommunity` dejan de aplicar `resolverComunidad`: los
overrides desaparecen, y la comunidad del armazón ya es la verdad.

```bash
grep -rn "perfilOverrides\|comunidadOverrides\|resolverComunidad\|aplicarPerfilOverride" src
```

- [ ] **Paso 5: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(perfil): perfil y datos de la academia en la base"
```

---

### Tarea 6: Limpieza, documentación y comprobación real

**Archivos:**
- Modificar: `src/lib/store.ts`
- Modificar: `CLAUDE.md`
- Borrar: los mocks que ya no lee nadie

- [ ] **Paso 1: Vaciar el store de lo que ya no es interfaz**

Retirar: `postsCreados`, `likesDados`, `comentariosCreados`, `postsEliminados`,
`postFijadoPorComunidad`, `proximoPostId`, `crearPost`, `toggleLike`,
`comentar`, `eliminarPost`, `fijarPost`, `eventosEditados`,
`eventosEliminados`, `proximoEventoId`, `guardarEvento`, `eliminarEvento`,
`siguienteEventoId`, `guardarSecciones`, `siguienteEspacioId`,
`proximoEspacioId`, `perfilOverrides`, `actualizarPerfil`,
`comunidadOverrides`, `guardarComunidad`, `guardarNombresNiveles`,
`usuariosCreados`, `enrollmentsExtra`.

**Y el código muerto que dejó la rebanada 2:** `cambiarEstadoAlumno`,
`estadoOverrides` y `resolverEstadoEnrollment`. Se conservaron diciendo que
`/admin/reportes` los necesitaba; se migró reportes y nadie volvió a por ellos.

Debe quedar solo estado de interfaz: `armazon`, `currentUserId`,
`establecerArmazon`, `espaciosVistos`, `marcarEspacioVisto`, y lo de
`/plataforma` (`planOverrides`, `guardarPlan`, `cambiarEstadoComunidad`,
`comunidadesCreadas`), que es rebanada 4.

```bash
grep -rn "useAppStore" src | grep -v "armazon\|espaciosVistos\|establecerArmazon\|planOverrides\|guardarPlan\|cambiarEstadoComunidad\|comunidadesCreadas"
```

- [ ] **Paso 2: Borrar los mocks huérfanos**

```bash
for m in posts events enrollments; do
  echo "$m: $(grep -rl "mocks/$m" src | grep -v "^src/lib/mocks/" | wc -l) consumidores"
done
```

Borrar los que salgan a 0. `users`, `communities`, `courses`, `plans` y `fechas`
siguen en uso por `/plataforma`, que es la rebanada 4.

`espacios` no aparece en la lista: la Tarea 4 lo saca de `mocks/` a
`src/lib/espacios-default.ts`, porque `crearSeccionesDefault` deja de ser un
dato semilla y pasa a ser código de producción.

- [ ] **Paso 3: Actualizar `CLAUDE.md`**

En la sección "Base de datos", añadir:

```markdown
El store de Zustand ya **no guarda datos de dominio**: solo estado de interfaz
(tema, espacios vistos) y lo pendiente de `/plataforma`. Todo lo demás vive en
Postgres y se lee por los módulos de `src/lib/supabase/`.

El feed es el único que no viaja en el armazón: crece sin techo, así que
`useFeed` pagina **por fecha** (`creado_el < ultimaVista`). No lo cambies a
páginas numeradas — con una publicación nueva de por medio, la última de una
página reaparece en la siguiente.

Los puntos los otorga un trigger sobre `progreso` (10 por lección). No los
sumes desde la app.
```

- [ ] **Paso 4: Verificar**

```bash
bun run build && bun run lint && bun run test:rls
```
Esperado: los tres limpios, con todas las pruebas en verde.

- [ ] **Paso 5: La comprobación que ninguna prueba sustituye**

Con `bun run dev` y dos navegadores (dueño y alumno):

1. El alumno publica en el espacio del curso; el dueño lo ve **al recargar**.
2. El dueño comenta y da me gusta; el alumno lo ve.
3. El dueño fija una publicación: sale primero aunque no sea la más reciente.
4. El alumno pregunta bajo una lección; el dueño responde ahí mismo.
5. El dueño crea un evento; aparece en el calendario del alumno.
6. El alumno marca una lección: **sus puntos suben 10** y sube en el ranking.
7. Nada de lo anterior se ve desde otra empresa.

- [ ] **Paso 6: Commit final**

```bash
git add -A
git commit -m "chore: vaciar el store de datos de dominio y documentar la rebanada 3"
```

---

## Autorrevisión frente a la spec

| Sección de la spec | Tarea |
|---|---|
| §1 Criterio de terminación (7 puntos) | 6, paso 5 los recorre todos |
| §2 Comentarios de lección no existen | 3 |
| §2 Ranking no existe | 1 |
| §3 Trigger de puntos, 10 por lección | 1 |
| §3 Periodos desde `completada_el` | 1, paso 6 |
| §3 `ranking_de_comunidad` | 1 |
| §4 Paginación por fecha, 20 por carga | 2 |
| §4 Fijado fuera de la paginación | 2 (`leerFijado`) |
| §4 `useFeed` gana `cargando`/`hayMas`/`cargarMas` | 2, paso 5 |
| §5 Tabla `comentarios_leccion` | 3 |
| §6 Espacios y eventos | 4 |
| §6 Curso nuevo nace con espacios | 4, paso 6 |
| §7 Vaciar el store | 6 |
| §7 Código muerto de la rebanada 2 | 6, paso 1 |
| §7 Última violación (`perfil/page.tsx`) | 5 |
| §8 Pruebas 1-10 | 2 (1-5), 3 (6), 1 (7-10) |

**Hueco detectado y cerrado:** la prueba 3 de la spec ("el autor borra su
publicación; el dueño también; un tercero no") no tenía tarea. Se añade a la
Tarea 2, tras las cuatro existentes:

```ts
test("borra el autor y el dueno, pero no un tercero", async () => {
  const { data: p } = await admin.from("publicaciones").insert({
    curso_id: e.cursoAPublicado, espacio_id: espacioId,
    autor_id: e.alumnoA.id, titulo: "Borrable", cuerpo: "x",
  }).select("id").single();

  await eliminarPost(e.alumnoB.cliente, p!.id);
  const { data: sigue } = await admin
    .from("publicaciones").select("id").eq("id", p!.id);
  expect(sigue?.length).toBe(1); // el tercero no pudo

  await eliminarPost(e.duenoA.cliente, p!.id);
  const { data: ya } = await admin
    .from("publicaciones").select("id").eq("id", p!.id);
  expect(ya ?? []).toEqual([]);
});
```

(Importar `eliminarPost` de `../../src/lib/supabase/feed`.)

**Fuera de alcance, confirmado:** `/plataforma` y `usePlatform` no se tocan —
son la rebanada 4.
