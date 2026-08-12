# Goteo de contenido — Plan de implementación

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementarlo tarea a tarea. Los pasos llevan casilla (`- [ ]`) para ir marcando.

**Objetivo:** que un módulo se abra a los N días de que el alumno entrara a la academia, o en una fecha fija, en vez de entregarlo entero el primer día.

**Arquitectura:** un resolver nuevo `privado.curso_disponible(curso)` que comprueba los dos candados —la fecha del goteo y el nivel— y se llama desde las políticas de `modulos` y `lecciones`. La fila del módulo sigue visible para poder pintar la cuenta atrás; su contenido no sale de la base. El navegador solo calcula el texto: quien decide es Postgres.

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, shadcn/ui, Zustand, Supabase Postgres con RLS, `bun`.

**Spec:** `docs/superpowers/specs/2026-08-12-goteo-de-contenido-design.md`

## Restricciones del proyecto

Aplican a todas las tareas.

- **Vocabulario partido.** En el código `curso` = **módulo** en la interfaz, `modulo` = **submódulo**, `leccion` = **clase**. La copy nueva usa las palabras de la interfaz; los identificadores, las del código.
- **Toda la interfaz y la copy, en español.**
- **Ningún componente ni página consulta Supabase directamente**: todo dato pasa por un hook de `src/lib/hooks/`, que llama a un módulo de `src/lib/supabase/`.
- **RLS no lanza: filtra.** Un `insert`/`update` rechazado vuelve sin error y sin filas. Todo escritor comprueba `data.length === 0` y lanza.
- **Toda función `security definer` lleva `set search_path = ''`** y referencia tablas con esquema explícito. Lo verifica `tests/rls/auditoria.test.ts` (A3).
- **RLS activado y `grant` explícito** en toda tabla nueva, en su misma migración. Aquí no se crean tablas.
- **`setState` nunca síncrono dentro de un efecto.**
- **Selectores de Zustand:** nada de `.filter()`/`.map()` dentro del selector; se selecciona el array crudo y se deriva con `useMemo`.
- **Clases semánticas de color** (`bg-card`, `text-muted-foreground`), nunca colores fijos.
- **Antes de terminar cada tarea:** `bun run build` y `bun run lint` limpios, por código de salida.
- Las pruebas contra la base necesitan `bun run dev` levantado solo para las de endpoint; las de RLS no.
- **No hay base local.** Las migraciones van al proyecto alojado con `bun run db:push`.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_goteo_de_contenido.sql` | **Crear.** Columnas, `privado.nivel_por_puntos`, `privado.curso_disponible`, las dos políticas recreadas |
| `src/lib/goteo.ts` | **Crear.** Lógica pura: de la configuración de un módulo y la fecha de entrada, el instante de apertura y su texto. Sin base y sin React |
| `src/lib/types.ts` | **Modificar.** `Course` gana `goteoModo`, `goteoDias`, `goteoDesde` |
| `src/lib/supabase/consultas.ts` | **Modificar.** El armazón trae las tres columnas y la fecha de entrada del alumno |
| `src/lib/supabase/guardar-curso.ts` | **Modificar.** `guardarCurso` escribe las tres columnas |
| `src/lib/supabase/alumnos.ts` | **Modificar.** `contarBloqueadosPorGoteo`, para el aviso del creador |
| `src/lib/hooks/use-courses.ts` | **Modificar.** `AccesoCurso` gana `"candado-fecha"`; `CourseConAcceso` gana `abreEl` |
| `src/app/(creador)/admin/cursos/[curso]/_curso-editor.tsx` | **Modificar.** El bloque «Cuándo se abre» |
| `src/components/admin/fila-modulo.tsx` | **Modificar.** La nota del goteo en la fila |
| `src/components/course/course-card.tsx` | **Modificar.** El texto del candado por fecha |
| `src/app/(miembro)/c/[comunidad]/cursos/[curso]/modulo/[id]/_modulo-detalle.tsx` | **Modificar.** El estado «todavía no» al entrar por URL |
| `tests/goteo.test.ts` | **Crear.** Lógica pura, sin base |
| `tests/rls/goteo.test.ts` | **Crear.** Aislamiento real contra Postgres |

---

## Tarea 1: La base — columnas, resolvers y políticas

Es la tarea que decide si el goteo existe o es decorado. Todo lo demás pinta lo que esta tarea hace cumplir.

**Archivos:**
- Crear: `supabase/migrations/<timestamp>_goteo_de_contenido.sql`
- Crear: `tests/rls/goteo.test.ts`

**Interfaces:**
- Consume: `privado.cubre_curso(uuid)`, `privado.es_propietario_de(uuid)`, `public.inscripciones`, `public.perfiles.puntos` — ya existen.
- Produce: columnas `cursos.goteo_modo` (`'ninguno'|'dias'|'fecha'`), `cursos.goteo_dias` (`integer`), `cursos.goteo_desde` (`timestamptz`); funciones `privado.nivel_por_puntos(integer) → integer` y `privado.curso_disponible(uuid) → boolean`.

- [ ] **Paso 1: Crear el archivo de migración**

```bash
supabase migration new goteo_de_contenido
```

Anota la ruta que imprime; los pasos siguientes escriben en ese archivo.

- [ ] **Paso 2: Escribir la migración**

Contenido completo del archivo:

```sql
-- Goteo de contenido: los modulos se abren cuando toca.
--
-- Quien compra recibia hoy el temario entero el primer dia. Podia verlo todo en
-- un fin de semana y pedir el reembolso, y ademas se llevaba el ritmo por
-- delante: nadie vuelve a una comunidad de la que ya se llevo todo.
--
-- EL RESOLVER NO VA DENTRO DE `cubre_curso`, y esa es la decision de fondo.
-- `cubre_curso` decide si el modulo EXISTE para ti; metiendo ahi la fecha, un
-- modulo pendiente desapareceria de la lista sin candado, sin fecha y sin
-- explicacion, arrastrando su ficha y su fila del ranking --- y `cubre_curso_de`
-- alimenta el directorio de miembros, asi que la gente apareceria y
-- desapareceria de el segun el dia. Es el callejon sin salida de las academias
-- suspendidas: la app no puede distinguir "todavia no" de "no existe".
--
-- La division correcta ya existe aqui: `inscrito_en` deja ver la fila,
-- `pertenece_a` deja ver el contenido. Esto la repite un nivel mas abajo.

/* 1 --- La configuracion, en el propio modulo. --------------------------- */

alter table public.cursos
  add column goteo_modo  text not null default 'ninguno'
    check (goteo_modo in ('ninguno','dias','fecha')),
  -- Solo en modo 'dias': cuantos dias desde que el alumno entro a la academia.
  add column goteo_dias  integer,
  -- Solo en modo 'fecha'. `timestamptz` y no `date` porque el creador elige
  -- fecha Y hora: con solo fecha habria que inventarse una hora y una zona, y
  -- "el 15 de septiembre" significaria cosas distintas en Quito y en Madrid.
  add column goteo_desde timestamptz;

-- Discriminador explicito, y no "si goteo_dias no es nulo entonces es por
-- dias". Misma decision que `canales_venta.tipo`: un nulo con significado es lo
-- que hace que dentro de tres meses nadie recuerde por que esa columna es
-- opcional. Con la restriccion, un modo a medias no se puede guardar ni
-- saltandose la pantalla.
alter table public.cursos
  add constraint cursos_goteo_coherente check (
    (goteo_modo = 'ninguno' and goteo_dias is null and goteo_desde is null) or
    (goteo_modo = 'dias'    and goteo_dias is not null and goteo_dias > 0
                            and goteo_desde is null) or
    (goteo_modo = 'fecha'   and goteo_desde is not null and goteo_dias is null)
  );

/* 2 --- Los umbrales de nivel, que hasta hoy solo existian en TypeScript. -- */

-- Copia de `NIVEL_UMBRALES` de `src/lib/levels.ts`. Existir en dos sitios es el
-- precio de aplicar el candado por nivel en la base en vez de solo en la
-- pantalla; `tests/rls/goteo.test.ts` compara los dos para que no se separen.
--
-- `greatest(1, ...)` porque `ajustar_puntos` RESTA al borrar una leccion, asi
-- que un alumno puede acabar bajo cero. TypeScript devuelve 1 ahi, y esto tiene
-- que devolver lo mismo o los dos candados discreparian justo en el caso raro.
create function privado.nivel_por_puntos(p_puntos integer) returns integer
language sql immutable set search_path = '' as $$
  select greatest(1, (
    select count(*)::integer
    from unnest(array[0,20,65,155,315,515,815,1215,1715]) u
    where p_puntos >= u
  ));
$$;

/* 3 --- El resolver. ------------------------------------------------------ */

-- "Este modulo esta abierto para mi ahora mismo?" --- una sola pregunta que
-- comprueba los DOS candados: la fecha del goteo y el nivel.
--
-- Una funcion y no dos, aunque sean reglas distintas: tienen el mismo efecto y
-- el mismo sitio de llamada. Separarlas obligaria a cada consumidor futuro a
-- acordarse de invocar las dos --- que es exactamente como `lecciones` se quedo
-- sin comprobar `publicado` cuando `modulos` si lo comprobaba.
--
-- Un `p_curso` inexistente devuelve null, y una politica trata null como falso:
-- el resultado correcto.
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

grant execute on function privado.nivel_por_puntos(integer) to authenticated;
grant execute on function privado.curso_disponible(uuid) to authenticated;

/* 4 --- Las dos politicas. ------------------------------------------------ */

-- Solo cambia la rama del MIEMBRO. La del dueno queda intacta y es
-- deliberado: es lo que le deja preparar el modulo antes de que abra. El precio
-- es que su "Ver como alumno" miente, y la pantalla lo dice.

drop policy if exists "modulos: via su curso" on public.modulos;
create policy "modulos: via su curso"
  on public.modulos for select to authenticated
  using (
    (publicado
     and privado.cubre_curso(curso_id)
     and privado.curso_disponible(curso_id))
    or exists (select 1 from public.cursos c
               where c.id = modulos.curso_id
                 and privado.es_propietario_de(c.comunidad_id))
  );

-- OJO: esta politica NO comprobaba `m.publicado`. La migracion
-- `20260807024857_modulo_en_borrador_no_sale_de_la_base` lo arreglo en
-- `modulos` y se dejo esta fuera, asi que las clases de un submodulo en
-- borrador SI salian de la base aunque el submodulo no apareciera. Se arregla
-- aqui porque es la misma linea y el mismo repaso --- y porque sin ese
-- `m.publicado` la cascada del goteo tampoco funcionaria.
drop policy if exists "lecciones: via su modulo" on public.lecciones;
create policy "lecciones: via su modulo"
  on public.lecciones for select to authenticated
  using (
    exists (
      select 1 from public.modulos m
      where m.id = lecciones.modulo_id
        and (
          (m.publicado
           and privado.cubre_curso(m.curso_id)
           and privado.curso_disponible(m.curso_id))
          or exists (select 1 from public.cursos c
                     where c.id = m.curso_id
                       and privado.es_propietario_de(c.comunidad_id))
        )
    )
  );
```

- [ ] **Paso 3: Escribir las pruebas de aislamiento**

Crear `tests/rls/goteo.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * El goteo, comprobado donde importa: en la base.
 *
 * El candado por nivel vivia solo en el navegador y por eso no protegia nada
 * --- un alumno pedia la clase por su id y Postgres se la daba. Estas pruebas
 * existen para que al goteo no le pase lo mismo: cada una pide el contenido POR
 * SU ID con la sesion del alumno, que es lo que haria alguien con las
 * herramientas del navegador abiertas.
 */
const sql = new SQL(process.env.SUPABASE_DB_URL!, { max: 1 });

let e: Escenario;
let submoduloId: string;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("goteo");

  const { data: mod } = await admin
    .from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "Submodulo", orden: 1, publicado: true })
    .select("id")
    .single();
  submoduloId = mod!.id;

  const { data: lec } = await admin
    .from("lecciones")
    .insert({ modulo_id: submoduloId, titulo: "Clase", orden: 1 })
    .select("id")
    .single();
  leccionId = lec!.id;
});

afterAll(async () => {
  await sql.end();
  await desmontar(e);
});

/** Deja el modulo sin goteo, que es el estado por defecto. */
async function sinGoteo() {
  await admin
    .from("cursos")
    .update({ goteo_modo: "ninguno", goteo_dias: null, goteo_desde: null })
    .eq("id", e.cursoAPublicado);
}

/** Mueve la fecha de entrada del alumno A para simular antiguedad. */
async function entroHace(dias: number) {
  await sql`
    update public.inscripciones
       set creado_el = now() - make_interval(days => ${dias})
     where usuario_id = ${e.alumnoA.id} and comunidad_id = ${e.comunidadA}
  `;
}

/** Lo que el alumno A saca de la base pidiendolo POR SU ID. */
async function loQueVeElAlumno() {
  const { data: submodulos } = await e.alumnoA.cliente
    .from("modulos").select("id").eq("id", submoduloId);
  const { data: clases } = await e.alumnoA.cliente
    .from("lecciones").select("id").eq("id", leccionId);
  const { data: modulo } = await e.alumnoA.cliente
    .from("cursos").select("id").eq("id", e.cursoAPublicado);
  return {
    submodulos: (submodulos ?? []).length,
    clases: (clases ?? []).length,
    modulo: (modulo ?? []).length,
  };
}

test("G1. con el plazo pendiente no salen ni los submodulos ni las clases", async () => {
  await entroHace(2);
  await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: 7, goteo_desde: null })
    .eq("id", e.cursoAPublicado);

  const visto = await loQueVeElAlumno();
  expect(visto.submodulos).toBe(0);
  expect(visto.clases).toBe(0);
});

test("G2. pero la fila del modulo SI se sigue viendo", async () => {
  // Contraintuitivo y a proposito: sin ella el alumno no ve "se abre el
  // martes", ve que el modulo no existe. Es la misma division que ya hay entre
  // `inscrito_en` (ves la fila) y `pertenece_a` (ves el contenido).
  await entroHace(2);
  await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: 7, goteo_desde: null })
    .eq("id", e.cursoAPublicado);

  const visto = await loQueVeElAlumno();
  expect(visto.modulo).toBe(1);
});

test("G3. cumplido el plazo, sale todo", async () => {
  // Una regla que ademas rompe el caso bueno no es una regla, es una averia.
  await entroHace(30);
  await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: 7, goteo_desde: null })
    .eq("id", e.cursoAPublicado);

  const visto = await loQueVeElAlumno();
  expect(visto.submodulos).toBe(1);
  expect(visto.clases).toBe(1);
});

test("G4. modo fecha: antes no, despues si", async () => {
  await admin
    .from("cursos")
    .update({
      goteo_modo: "fecha",
      goteo_dias: null,
      goteo_desde: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq("id", e.cursoAPublicado);
  expect((await loQueVeElAlumno()).clases).toBe(0);

  await admin
    .from("cursos")
    .update({ goteo_desde: new Date(Date.now() - 86_400_000).toISOString() })
    .eq("id", e.cursoAPublicado);
  expect((await loQueVeElAlumno()).clases).toBe(1);
});

test("G5. el dueno lo ve siempre, tambien con el plazo pendiente", async () => {
  // Si se rompe, un creador no puede preparar su temario antes de que abra.
  await admin
    .from("cursos")
    .update({
      goteo_modo: "fecha",
      goteo_dias: null,
      goteo_desde: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq("id", e.cursoAPublicado);

  const { data } = await e.duenoA.cliente.from("lecciones").select("id").eq("id", leccionId);
  expect((data ?? []).length).toBe(1);
});

test("G6. el candado por nivel ahora tambien corta en la base", async () => {
  // Hasta hoy `nivel_requerido` se aplicaba SOLO en `use-courses.ts`: un alumno
  // por debajo del nivel pedia la clase por su id y la base se la entregaba.
  await sinGoteo();
  await admin.from("perfiles").update({ puntos: 0 }).eq("id", e.alumnoA.id);
  await admin.from("cursos").update({ nivel_requerido: 5 }).eq("id", e.cursoAPublicado);

  expect((await loQueVeElAlumno()).clases).toBe(0);

  await admin.from("cursos").update({ nivel_requerido: null }).eq("id", e.cursoAPublicado);
  expect((await loQueVeElAlumno()).clases).toBe(1);
});

test("G7. las clases de un submodulo en borrador ya no salen", async () => {
  // El fallo que aparecio explorando: `lecciones` no comprobaba `m.publicado`,
  // asi que el submodulo se escondia y sus clases no.
  await sinGoteo();
  await admin.from("modulos").update({ publicado: false }).eq("id", submoduloId);

  const visto = await loQueVeElAlumno();
  expect(visto.submodulos).toBe(0);
  expect(visto.clases).toBe(0);

  await admin.from("modulos").update({ publicado: true }).eq("id", submoduloId);
});

test("G8. los umbrales de nivel dicen lo mismo en Postgres y en TypeScript", async () => {
  // Los umbrales existen en dos sitios: `NIVEL_UMBRALES` y el array dentro de
  // `privado.nivel_por_puntos`. Esta prueba es lo unico que impide que se
  // separen sin que nadie se entere.
  const { nivelPorPuntos } = await import("../../src/lib/levels");

  for (const puntos of [-50, -1, 0, 1, 19, 20, 64, 65, 154, 155, 814, 1715, 99_999]) {
    const [f] = await sql`select privado.nivel_por_puntos(${puntos}) as n`;
    expect(f.n).toBe(nivelPorPuntos(puntos));
  }
});

test("G9. la base rechaza una configuracion de goteo a medias", async () => {
  const { error } = await admin
    .from("cursos")
    .update({ goteo_modo: "dias", goteo_dias: null, goteo_desde: null })
    .eq("id", e.cursoAPublicado);
  expect(error?.message ?? "").toContain("cursos_goteo_coherente");

  await sinGoteo();
});
```

- [ ] **Paso 4: Correr las pruebas y verificar que fallan**

Ejecutar: `bun test --env-file=.env.local --timeout=60000 tests/rls/goteo.test.ts`

Esperado: FALLA. Los mensajes serán del tipo `column "goteo_modo" does not exist` — la migración todavía no se ha aplicado.

- [ ] **Paso 5: Aplicar la migración**

```bash
bun run db:push
```

Esperado: `1 migración(es) aplicada(s)`.

- [ ] **Paso 6: Correr las pruebas y verificar que pasan**

Ejecutar: `bun test --env-file=.env.local --timeout=60000 tests/rls/goteo.test.ts`

Esperado: 9 pruebas en verde.

- [ ] **Paso 7: Verificar que no se rompió el resto del aislamiento**

Ejecutar: `bun test --env-file=.env.local --timeout=60000 tests/rls/auditoria.test.ts tests/rls/aislamiento.test.ts tests/rls/suspension.test.ts tests/rls/guardar-curso.test.ts`

Esperado: todo verde. `auditoria.test.ts` A3 comprueba que las funciones nuevas fijan su `search_path`.

- [ ] **Paso 8: Commit**

```bash
git add supabase/migrations tests/rls/goteo.test.ts
git commit -m "feat(goteo): el resolver y las politicas que lo hacen cumplir"
```

---

## Tarea 2: `src/lib/goteo.ts` — el cálculo, puro y probado sin base

**Archivos:**
- Crear: `src/lib/goteo.ts`
- Crear: `tests/goteo.test.ts`

**Interfaces:**
- Consume: nada. Es lógica pura.
- Produce:
  - `type GoteoModo = "ninguno" | "dias" | "fecha"`
  - `interface ConfigGoteo { goteoModo: GoteoModo; goteoDias: number | null; goteoDesde: string | null }`
  - `fechaDeApertura(config: ConfigGoteo, entradaEl: string | null, ahora: Date): Date | null`
  - `textoDeApertura(abreEl: Date, ahora: Date): string`
  - `notaDeGoteo(config: ConfigGoteo): string | null`

- [ ] **Paso 1: Escribir las pruebas**

Crear `tests/goteo.test.ts`:

```ts
import { expect, test } from "bun:test";
import {
  fechaDeApertura,
  textoDeApertura,
  notaDeGoteo,
  type ConfigGoteo,
} from "../src/lib/goteo";

const AHORA = new Date("2026-08-12T12:00:00Z");
const SIN_GOTEO: ConfigGoteo = { goteoModo: "ninguno", goteoDias: null, goteoDesde: null };

test("sin goteo, abierto", () => {
  expect(fechaDeApertura(SIN_GOTEO, "2026-08-10T00:00:00Z", AHORA)).toBeNull();
});

test("por dias: el plazo se cuenta desde que entro a la academia", () => {
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  const abre = fechaDeApertura(c, "2026-08-10T09:00:00Z", AHORA);
  expect(abre?.toISOString()).toBe("2026-08-17T09:00:00.000Z");
});

test("por dias: cumplido el plazo, abierto", () => {
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  expect(fechaDeApertura(c, "2026-07-01T09:00:00Z", AHORA)).toBeNull();
});

test("por dias: justo al cumplirse el instante, abierto", () => {
  // El limite exacto. Con `<` en vez de `<=` este caso ensenaria un candado
  // que la base ya no aplica --- y el alumno veria "se abre en 0 minutos".
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  expect(fechaDeApertura(c, "2026-08-05T12:00:00Z", AHORA)).toBeNull();
});

test("por dias sin fecha de entrada, se da por abierto", () => {
  // No es permisividad: quien decide es Postgres. Si aqui no se sabe, se pinta
  // abierto y la base devuelve lo que corresponda.
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  expect(fechaDeApertura(c, null, AHORA)).toBeNull();
});

test("por fecha: antes devuelve el instante, despues null", () => {
  const futuro: ConfigGoteo = {
    goteoModo: "fecha", goteoDias: null, goteoDesde: "2026-09-15T14:00:00Z",
  };
  expect(fechaDeApertura(futuro, null, AHORA)?.toISOString()).toBe("2026-09-15T14:00:00.000Z");

  const pasado: ConfigGoteo = {
    goteoModo: "fecha", goteoDias: null, goteoDesde: "2026-01-01T00:00:00Z",
  };
  expect(fechaDeApertura(pasado, null, AHORA)).toBeNull();
});

test("el texto cambia segun lo que falte", () => {
  expect(textoDeApertura(new Date("2026-08-12T14:30:00Z"), AHORA)).toBe("Se abre en 2 horas");
  expect(textoDeApertura(new Date("2026-08-12T12:30:00Z"), AHORA)).toBe("Se abre en 30 minutos");
  expect(textoDeApertura(new Date("2026-08-13T10:00:00Z"), AHORA)).toBe("Se abre mañana");
  expect(textoDeApertura(new Date("2026-08-20T10:00:00Z"), AHORA)).toContain("Se abre el ");
});

test("una hora se dice en singular", () => {
  expect(textoDeApertura(new Date("2026-08-12T13:00:00Z"), AHORA)).toBe("Se abre en 1 hora");
});

test("la nota de la lista resume la configuracion", () => {
  expect(notaDeGoteo(SIN_GOTEO)).toBeNull();
  expect(notaDeGoteo({ goteoModo: "dias", goteoDias: 7, goteoDesde: null }))
    .toBe("Se abre a los 7 días");
  expect(notaDeGoteo({ goteoModo: "dias", goteoDias: 1, goteoDesde: null }))
    .toBe("Se abre al día siguiente");
  expect(notaDeGoteo({ goteoModo: "fecha", goteoDias: null, goteoDesde: "2026-09-15T14:00:00Z" }))
    .toContain("Se abre el ");
});
```

- [ ] **Paso 2: Correr las pruebas y verificar que fallan**

Ejecutar: `bun test tests/goteo.test.ts`

Esperado: FALLA con `Cannot find module '../src/lib/goteo'`.

- [ ] **Paso 3: Escribir el módulo**

Crear `src/lib/goteo.ts`:

```ts
/**
 * Cuándo se abre un módulo, y cómo se dice.
 *
 * Lógica pura y en su propio archivo, como `slug.ts`: se prueba sin base de
 * datos y sin React, que es donde están los casos raros de verdad —el plazo que
 * se cumple justo ahora, el cambio de mes, la fecha ya pasada.
 *
 * **Nada de esto es el candado.** Quien decide es Postgres
 * (`privado.curso_disponible`). Si el reloj del alumno va adelantado y su
 * tarjeta dice que ya abrió, al entrar no habrá nada — y eso es correcto. Esta
 * fue la lección del candado por nivel, que vivía solo aquí y por eso no
 * protegía nada.
 *
 * `ahora` se recibe por parámetro en vez de leer el reloj dentro: así las
 * pruebas son deterministas y no dependen del día en que se ejecuten.
 */

export type GoteoModo = "ninguno" | "dias" | "fecha";

export interface ConfigGoteo {
  goteoModo: GoteoModo;
  /** Solo en modo `dias`: días desde que el alumno entró a la academia. */
  goteoDias: number | null;
  /** Solo en modo `fecha`, en ISO. */
  goteoDesde: string | null;
}

const UNA_HORA = 60 * 60 * 1000;
const UN_DIA = 24 * UNA_HORA;

/**
 * El instante en que se abre, o `null` si ya está abierto.
 *
 * Sin fecha de entrada en modo `dias` devuelve `null`, o sea abierto. No es
 * permisividad: no sabemos, y quien decide de verdad es la base. Pintar un
 * candado sin poder decir cuándo se levanta es peor que no pintarlo.
 */
export function fechaDeApertura(
  config: ConfigGoteo,
  entradaEl: string | null,
  ahora: Date
): Date | null {
  if (config.goteoModo === "fecha" && config.goteoDesde) {
    const abre = new Date(config.goteoDesde);
    return abre.getTime() <= ahora.getTime() ? null : abre;
  }

  if (config.goteoModo === "dias" && config.goteoDias && entradaEl) {
    const abre = new Date(new Date(entradaEl).getTime() + config.goteoDias * UN_DIA);
    // `<=` y no `<`: cumplido el instante exacto está abierto, igual que en el
    // resolver de Postgres. Con `<` la pantalla enseñaría "se abre en 0
    // minutos" sobre un módulo que la base ya está entregando.
    return abre.getTime() <= ahora.getTime() ? null : abre;
  }

  return null;
}

/** «Se abre en 2 horas», «Se abre mañana», «Se abre el martes 19 de agosto». */
export function textoDeApertura(abreEl: Date, ahora: Date): string {
  const falta = abreEl.getTime() - ahora.getTime();

  if (falta < UNA_HORA) {
    const minutos = Math.max(1, Math.round(falta / 60_000));
    return `Se abre en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  }

  if (falta < UN_DIA) {
    const horas = Math.round(falta / UNA_HORA);
    return `Se abre en ${horas} ${horas === 1 ? "hora" : "horas"}`;
  }

  if (falta < 2 * UN_DIA) return "Se abre mañana";

  return `Se abre el ${fechaLarga(abreEl)}`;
}

/** Lo que ve el creador en la lista de módulos, o `null` si no hay goteo. */
export function notaDeGoteo(config: ConfigGoteo): string | null {
  if (config.goteoModo === "dias" && config.goteoDias) {
    return config.goteoDias === 1
      ? "Se abre al día siguiente"
      : `Se abre a los ${config.goteoDias} días`;
  }
  if (config.goteoModo === "fecha" && config.goteoDesde) {
    return `Se abre el ${fechaLarga(new Date(config.goteoDesde))}`;
  }
  return null;
}

function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
}
```

- [ ] **Paso 4: Correr las pruebas y verificar que pasan**

Ejecutar: `bun test tests/goteo.test.ts`

Esperado: 9 pruebas en verde.

- [ ] **Paso 5: Verificar build y lint**

```bash
bun run lint && bun run build
```

Esperado: ambos con código de salida 0.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/goteo.ts tests/goteo.test.ts
git commit -m "feat(goteo): el calculo de la fecha de apertura, puro y probado"
```

---

## Tarea 3: Que el dato viaje — tipos, armazón y guardado

Sin esto el creador no puede configurar nada y el alumno no puede saber cuándo abre.

**Archivos:**
- Modificar: `src/lib/types.ts` (interfaz `Course`, línea ~63)
- Modificar: `src/lib/supabase/consultas.ts` (`Armazon` línea ~5, `cargarArmazon`)
- Modificar: `src/lib/supabase/guardar-curso.ts` (`guardarCurso`, el `upsert` de `cursos`)
- Modificar: `tests/rls/guardar-curso.test.ts` (una prueba nueva)

**Interfaces:**
- Consume: `ConfigGoteo`, `GoteoModo` de `src/lib/goteo.ts` (Tarea 2); las columnas de la Tarea 1.
- Produce: `Course` con `goteoModo`/`goteoDias`/`goteoDesde`; `Armazon.entradaEl: string | null`.

- [ ] **Paso 1: Escribir la prueba de ida y vuelta**

Añadir al final de `tests/rls/guardar-curso.test.ts`:

```ts
test("el goteo se guarda y se vuelve a leer igual", async () => {
  // Un campo que se guarda pero no se lee —o al reves— es de los fallos que no
  // dan error: el creador configura el goteo, recarga y se le ha ido.
  const curso = await leerCursoDelDueno();

  await guardarCurso(e.duenoA.cliente, {
    ...curso,
    goteoModo: "dias",
    goteoDias: 7,
    goteoDesde: null,
  });

  const { data } = await admin
    .from("cursos")
    .select("goteo_modo, goteo_dias, goteo_desde")
    .eq("id", curso.id)
    .single();

  expect(data!.goteo_modo).toBe("dias");
  expect(data!.goteo_dias).toBe(7);
  expect(data!.goteo_desde).toBeNull();

  await guardarCurso(e.duenoA.cliente, {
    ...curso,
    goteoModo: "ninguno",
    goteoDias: null,
    goteoDesde: null,
  });
});
```

Ese archivo ya importa `cargarArmazon` (línea 10) y lo usa en varias pruebas,
así que solo falta la ayuda. Añadirla junto a las demás, arriba del archivo:

```ts
/** El curso del escenario tal como lo devuelve el armazón del dueño. */
async function leerCursoDelDueno() {
  const { cursos } = await cargarArmazon(e.duenoA.cliente);
  const curso = cursos.find((c) => c.id === e.cursoAPublicado);
  if (!curso) throw new Error("El escenario no trajo el curso publicado");
  return curso;
}
```

- [ ] **Paso 2: Correr la prueba y verificar que falla**

Ejecutar: `bun test --env-file=.env.local --timeout=60000 tests/rls/guardar-curso.test.ts`

Esperado: FALLA de TypeScript — `goteoModo` no existe en `Course`.

- [ ] **Paso 3: Añadir los campos a `Course`**

En `src/lib/types.ts`, dentro de `interface Course`, justo después de `orden: number;`:

```ts
  /**
   * Cuándo se abre este módulo para un alumno.
   *
   * `ninguno` (lo que ya había) lo entrega al comprar. `dias` lo abre a los
   * `goteoDias` de que esa persona entrara a la academia. `fecha` lo abre en
   * `goteoDesde`, igual para todos.
   *
   * Estos tres campos son SOLO para pintar la cuenta atrás. El candado de
   * verdad es `privado.curso_disponible` en Postgres.
   */
  goteoModo: GoteoModo;
  goteoDias: number | null;
  goteoDesde: string | null;
```

y en la cabecera del archivo: `import type { GoteoModo } from "@/lib/goteo";`

- [ ] **Paso 4: Traer los campos y la fecha de entrada en el armazón**

En `src/lib/supabase/consultas.ts`:

1. En `interface Armazon`, después de `progreso: string[];`:

```ts
  /**
   * Cuándo entró esta persona a la academia, en ISO, o `null` si no está
   * inscrita.
   *
   * Es el reloj del goteo por días. Viaja en el armazón porque la tarjeta de
   * un módulo cerrado tiene que poder decir «se abre el martes», y sin esta
   * fecha solo podría decir «cerrado».
   */
  entradaEl: string | null;
```

2. En el `select` de `cursos`, añadir las tres columnas a la lista de campos:

```
precio_referencial, nivel_requerido, publicado, orden,
goteo_modo, goteo_dias, goteo_desde,
```

3. En el `map` que arma cada `Course`, después de `orden: f.orden ?? 0,`:

```ts
    goteoModo: (f.goteo_modo ?? "ninguno") as GoteoModo,
    goteoDias: f.goteo_dias ?? null,
    goteoDesde: f.goteo_desde ?? null,
```

4. Después de resolver la comunidad `c`, leer la fecha de entrada:

```ts
  // La fecha de entrada de esta persona a la academia, que es el reloj del
  // goteo por días. Se pregunta aquí y no en el bloque de arriba porque el
  // dueño también está inscrito en la suya —`crearAcademia` le inscribe para
  // que «Ver como alumno» le enseñe algo— y así el camino es el mismo para los
  // dos.
  let entradaEl: string | null = null;
  if (c) {
    const { data: mia } = await supabase
      .from("inscripciones")
      .select("creado_el")
      .eq("usuario_id", usuario.id)
      .eq("comunidad_id", c.id)
      .maybeSingle();
    entradaEl = mia?.creado_el ?? null;
  }
```

5. Añadir `entradaEl` al objeto que devuelve `cargarArmazon`.

6. Importar el tipo: `import type { GoteoModo } from "@/lib/goteo";`

- [ ] **Paso 5: Guardar los campos**

En `src/lib/supabase/guardar-curso.ts`, dentro del `upsert` de `cursos`, después de `orden: curso.orden,`:

```ts
    goteo_modo: curso.goteoModo,
    // Los dos van explícitos a `null` cuando no aplican, y no se omiten: un
    // `upsert` que no menciona la columna deja el valor viejo, y quedaría un
    // `goteo_dias` de 7 bajo un modo `fecha` — que la restricción de la base
    // rechaza, con un error que nadie sabría leer.
    goteo_dias: curso.goteoModo === "dias" ? curso.goteoDias : null,
    goteo_desde: curso.goteoModo === "fecha" ? curso.goteoDesde : null,
```

- [ ] **Paso 6: Correr la prueba y verificar que pasa**

Ejecutar: `bun test --env-file=.env.local --timeout=60000 tests/rls/guardar-curso.test.ts`

Esperado: verde, incluida la prueba nueva.

- [ ] **Paso 7: Verificar build y lint**

```bash
bun run lint && bun run build
```

Esperado: código de salida 0 en los dos. Si el build se queja de que falta `goteoModo` en algún sitio que construye un `Course` a mano —por ejemplo `src/app/(creador)/admin/cursos/page.tsx`, donde se crea un módulo nuevo— añadir ahí `goteoModo: "ninguno", goteoDias: null, goteoDesde: null`.

- [ ] **Paso 8: Commit**

```bash
git add src/lib/types.ts src/lib/supabase/consultas.ts src/lib/supabase/guardar-curso.ts tests/rls/guardar-curso.test.ts
git commit -m "feat(goteo): el modulo lleva su configuracion y el armazon la fecha de entrada"
```

---

## Tarea 4: El creador lo configura, y ve a quién afecta

**Archivos:**
- Modificar: `src/app/(creador)/admin/cursos/[curso]/_curso-editor.tsx` (después del campo de precio, línea ~448)
- Modificar: `src/components/admin/fila-modulo.tsx` (la línea de «N submódulos · N clases · N alumnos», línea ~153)
- Modificar: `src/lib/supabase/alumnos.ts` (función nueva)

**Interfaces:**
- Consume: `notaDeGoteo`, `ConfigGoteo` de `src/lib/goteo.ts`; `Course` con los tres campos (Tarea 3).
- Produce: `contarBloqueadosPorGoteo(supabase, comunidadId, cursoId, config, ahora) → Promise<{ bloqueados: number; total: number; entradaMasReciente: string | null }>`

- [ ] **Paso 1: Escribir la consulta del aviso**

Añadir al final de `src/lib/supabase/alumnos.ts`:

```ts
/**
 * A cuántos alumnos les cerraría el módulo esta configuración de goteo.
 *
 * Existe porque la regla se aplica a todos sin excepciones: alguien que ya
 * tenía el módulo abierto puede perderlo al encender el goteo. Enseñar el
 * número ANTES de guardar convierte eso en una decisión informada en vez de en
 * un correo de un alumno preguntando qué pasó.
 *
 * Cuenta solo a quien de verdad tiene acceso a ese módulo: con
 * `todos_los_cursos`, o con su fila en `inscripcion_cursos`.
 *
 * Vive en este archivo y no en uno propio porque es una consulta sobre
 * `inscripciones`, que es de lo que trata este archivo.
 */
export async function contarBloqueadosPorGoteo(
  supabase: SupabaseClient,
  comunidadId: string,
  cursoId: string,
  config: ConfigGoteo,
  ahora: Date
): Promise<{ bloqueados: number; total: number; entradaMasReciente: string | null }> {
  const { data, error } = await supabase
    .from("inscripciones")
    .select("creado_el, todos_los_cursos, inscripcion_cursos(curso_id)")
    .eq("comunidad_id", comunidadId)
    .eq("estado", "activo");

  if (error) throw new Error(`No se pudieron leer los alumnos: ${error.message}`);

  const conAcceso = (data ?? []).filter(
    (i) =>
      i.todos_los_cursos ||
      ((i.inscripcion_cursos ?? []) as { curso_id: string }[]).some(
        (c) => c.curso_id === cursoId
      )
  );

  // Se reutiliza `fechaDeApertura`, la misma que pinta la tarjeta del alumno:
  // si el aviso calculara por su cuenta, diría un número y la pantalla del
  // alumno mostraría otro.
  const bloqueados = conAcceso.filter(
    (i) => fechaDeApertura(config, i.creado_el, ahora) !== null
  );

  const entradaMasReciente = bloqueados
    .map((i) => i.creado_el as string)
    .sort()
    .at(-1) ?? null;

  return { bloqueados: bloqueados.length, total: conAcceso.length, entradaMasReciente };
}
```

y en la cabecera del archivo:

```ts
import { fechaDeApertura, type ConfigGoteo } from "@/lib/goteo";
```

- [ ] **Paso 2: Añadir el bloque al editor**

En `src/app/(creador)/admin/cursos/[curso]/_curso-editor.tsx`, junto a las demás funciones de actualización (después de `actualizarPrecioCurso`, línea ~228):

```ts
  /**
   * Cambiar el modo limpia el campo del otro modo. Sin esto quedaría un
   * `goteoDias` de 7 bajo un modo `fecha`, que la restricción de la base
   * rechaza con un error que nadie sabría leer.
   */
  function actualizarModoGoteo(goteoModo: GoteoModo) {
    actualizarCurso((c) => ({
      ...c,
      goteoModo,
      goteoDias: goteoModo === "dias" ? (c.goteoDias ?? 7) : null,
      goteoDesde: goteoModo === "fecha" ? c.goteoDesde : null,
    }));
  }

  function actualizarDiasGoteo(valor: string) {
    actualizarCurso((c) => ({ ...c, goteoDias: Math.max(1, Number(valor) || 1) }));
  }

  function actualizarFechaGoteo(valor: string) {
    // `datetime-local` da "2026-09-15T14:00" sin zona. `new Date` lo interpreta
    // en la del navegador, que es la que el creador tiene en la cabeza cuando
    // escribe "las 9 de la mañana".
    actualizarCurso((c) => ({
      ...c,
      goteoDesde: valor ? new Date(valor).toISOString() : null,
    }));
  }
```

Y justo después del bloque del precio (el `</div>` que cierra `curso-precio`, línea ~448), el bloque nuevo:

```tsx
        <div className="space-y-1.5">
          <Label htmlFor="curso-goteo">Cuándo se abre</Label>
          <select
            id="curso-goteo"
            value={curso.goteoModo}
            onChange={(e) => actualizarModoGoteo(e.target.value as GoteoModo)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="ninguno">Al comprar</option>
            <option value="dias">A los … días de entrar a la academia</option>
            <option value="fecha">En una fecha concreta</option>
          </select>

          {curso.goteoModo === "dias" && (
            <Input
              type="number"
              min={1}
              value={curso.goteoDias ?? 7}
              onChange={(e) => actualizarDiasGoteo(e.target.value)}
              aria-label="Días desde que el alumno entra a la academia"
            />
          )}

          {curso.goteoModo === "fecha" && (
            <Input
              type="datetime-local"
              value={curso.goteoDesde ? paraCampoLocal(curso.goteoDesde) : ""}
              onChange={(e) => actualizarFechaGoteo(e.target.value)}
              aria-label="Fecha y hora en que se abre el módulo"
            />
          )}

          <p className="text-xs text-muted-foreground">
            {curso.goteoModo === "ninguno"
              ? "Tus alumnos lo ven en cuanto reciben acceso."
              : "Mientras esté cerrado, tus alumnos ven el módulo con un candado y la fecha en que se abre. Tú lo ves siempre, para poder prepararlo."}
          </p>
        </div>
```

Y arriba del componente, la ayuda para el campo de fecha:

```ts
/**
 * ISO → el formato que pide `datetime-local`, en la zona del navegador.
 *
 * `toISOString()` daría UTC y el creador vería una hora distinta de la que
 * escribió. `sv-SE` se usa porque su formato es `YYYY-MM-DD HH:mm`, a un
 * espacio de distancia del que necesita el campo.
 */
function paraCampoLocal(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(" ", "T");
}
```

Importar en la cabecera: `import type { GoteoModo } from "@/lib/goteo";`

- [ ] **Paso 3: Añadir el aviso antes de guardar**

En el mismo archivo, dentro de `async function guardar()` (línea 320). Va
**después** de `const supabase = crearClienteNavegador();` —lo necesita para
consultar— y **antes** del `try` que llama a `guardarCurso`:

```ts
    // El aviso solo aparece cuando de verdad cierra algo. La regla se aplica a
    // todos sin excepciones, así que esto es lo que convierte esa decisión en
    // informada en vez de en una sorpresa que llega por correo de un alumno.
    if (curso.goteoModo !== "ninguno") {
      const { bloqueados, total } = await contarBloqueadosPorGoteo(
        supabase,
        community.id,
        curso.id,
        curso,
        new Date()
      );
      if (bloqueados > 0) {
        const seguir = window.confirm(
          `Esto cierra «${curso.titulo}» a ${bloqueados} de tus ${total} ` +
            `${total === 1 ? "alumno" : "alumnos"} ahora mismo. ` +
            `Volverán a verlo cuando cumplan el plazo. ¿Lo guardo igualmente?`
        );
        if (!seguir) return;
      }
    }
```

Importar: `import { contarBloqueadosPorGoteo } from "@/lib/supabase/alumnos";`

- [ ] **Paso 4: Añadir la nota a la fila de la lista**

En `src/components/admin/fila-modulo.tsx`, dentro del `<span>` que dice «N submódulos · N clases · N alumnos» (línea ~153), añadir al final:

```tsx
              {nota && <span className="text-primary"> · {nota}</span>}
```

y arriba, junto a `const numClases = …`:

```tsx
  // Se ve desde la lista y no solo dentro del editor: con ocho módulos, tener
  // que abrirlos uno a uno para reconstruir el calendario recién montado es
  // justo cuando se cuelan los huecos y los solapes.
  const nota = notaDeGoteo(curso);
```

Importar: `import { notaDeGoteo } from "@/lib/goteo";`

- [ ] **Paso 5: Verificar build y lint**

```bash
bun run lint && bun run build
```

Esperado: código de salida 0 en los dos.

- [ ] **Paso 6: Comprobarlo a mano**

Con `bun run dev`:

1. Entrar a `/admin/cursos`, abrir «Mentoría Básica - Fundamentos».
2. Poner «A los 7 días», guardar.
3. Esperado: sale el aviso con el número de alumnos afectados. Aceptar.
4. Volver a `/admin/cursos`: la fila enseña «Se abre a los 7 días».
5. Recargar la página y volver a abrir el editor: el valor sigue ahí.

- [ ] **Paso 7: Commit**

```bash
git add "src/app/(creador)/admin/cursos/[curso]/_curso-editor.tsx" src/components/admin/fila-modulo.tsx src/lib/supabase/alumnos.ts
git commit -m "feat(goteo): el creador lo configura y ve a cuantos alumnos afecta"
```

---

## Tarea 5: El alumno ve el candado y la fecha

**Archivos:**
- Modificar: `src/lib/hooks/use-courses.ts` (`AccesoCurso` línea 12, `CourseConAcceso` línea 14, `useCourses` líneas ~75-92)
- Modificar: `src/components/course/course-card.tsx` (el bloque `bloqueado`, líneas ~113-130)
- Modificar: `src/app/(miembro)/c/[comunidad]/cursos/[curso]/modulo/[id]/_modulo-detalle.tsx`

**Interfaces:**
- Consume: `fechaDeApertura`, `textoDeApertura` de `src/lib/goteo.ts`; `Armazon.entradaEl` (Tarea 3).
- Produce: `AccesoCurso` con `"candado-fecha"`; `CourseConAcceso.abreEl: Date | null`.

- [ ] **Paso 1: Añadir el estado y calcularlo**

En `src/lib/hooks/use-courses.ts`:

1. Línea 12:

```ts
export type AccesoCurso = "si" | "candado-nivel" | "candado-fecha" | "sin-acceso";
```

2. En `CourseConAcceso`, añadir:

```ts
  /**
   * Instante en que se abre, o `null` si ya está abierto.
   *
   * Se calcula aquí y no en la tarjeta para que el cálculo ocurra una vez por
   * módulo y no una por render, y para que la tarjeta solo tenga que
   * formatearlo.
   */
  abreEl: Date | null;
```

3. Dentro del `useMemo`, antes del `map`:

```ts
    const ahora = new Date();
    const entradaEl = armazon?.entradaEl ?? null;
```

4. Sustituir el cálculo de `acceso` y el `return` del `map` por:

```ts
      const abreEl = fechaDeApertura(curso, entradaEl, ahora);

      // El orden importa: primero «no tienes acceso», que es lo más fuerte;
      // luego el nivel, que depende de lo que haga el alumno; y por último la
      // fecha, que depende solo de esperar. Si un módulo estuviera bajo dos
      // candados, decirle «sube de nivel» es más accionable que «espera».
      const acceso: AccesoCurso = !user
        ? "sin-acceso"
        : curso.nivelRequerido !== null && nivelUsuario < curso.nivelRequerido
          ? "candado-nivel"
          : abreEl
            ? "candado-fecha"
            : "si";

      return { ...curso, acceso, abreEl, progresoPct };
```

5. Importar: `import { fechaDeApertura } from "@/lib/goteo";`

- [ ] **Paso 2: Poner el texto en la tarjeta**

En `src/components/course/course-card.tsx`, dentro del bloque `{bloqueado && (…)}`, sustituir el ternario `curso.acceso === "candado-nivel" ? … : …` por una cadena de tres:

```tsx
            {curso.acceso === "candado-nivel" ? (
              <p className="max-w-[14rem] text-xs font-medium text-balance text-foreground">
                Se desbloquea en nivel {curso.nivelRequerido}
                {nombreNivelRequerido ? ` — ${nombreNivelRequerido}` : ""}
              </p>
            ) : curso.acceso === "candado-fecha" && curso.abreEl ? (
              // Un candado sin fecha es una puerta cerrada sin cartel, y la
              // fecha es justo lo que hace que el goteo retenga en vez de
              // frustrar.
              <p className="max-w-[14rem] text-xs font-medium text-balance text-foreground">
                {textoDeApertura(curso.abreEl, new Date())}
              </p>
            ) : (
              <>
                <p className="text-xs font-medium text-foreground">No tienes acceso</p>
                <p className="text-[11px] text-muted-foreground">
                  Valor referencial: ${curso.precioReferencial}
                </p>
              </>
            )}
```

Importar: `import { textoDeApertura } from "@/lib/goteo";`

No hay que tocar nada más de la tarjeta: `bloqueado` ya es `curso.acceso !== "si"`, así que el desenfoque, la opacidad y el no-navegar los hereda el estado nuevo.

- [ ] **Paso 3: Cubrir la entrada por URL directa**

En `_modulo-detalle.tsx`, el curso se resuelve en la línea 64
(`const curso = cursos.find((c) => c.slug === cursoSlug);`). Añadir este bloque
**después de esa línea y antes del `EmptyState` de «módulo no encontrado»**, para
que el caso concreto gane al genérico:

```tsx
  // Quien tenga la clase en un marcador cae aquí con la base devolviendo cero
  // submódulos. Sin esto vería una lista vacía sin explicación — el mismo error
  // que las academias suspendidas: «vacío» y «todavía no» se parecen en la
  // pantalla y no se parecen en nada para quien lo vive.
  if (curso && curso.acceso === "candado-fecha" && curso.abreEl) {
    return (
      <EmptyState
        icono={Lock}
        titulo="Este módulo todavía no está abierto"
        descripcion={`${textoDeApertura(curso.abreEl, new Date())}. Aquí encontrarás las clases en cuanto puedas entrar.`}
      />
    );
  }
```

`EmptyState` recibe `icono`, `titulo` y `descripcion` (`accion` es opcional y
aquí no hace falta: el alumno ya tiene la navegación del classroom alrededor).

Importar `Lock` de `lucide-react` —el archivo ya importa otros iconos de ahí en
la línea 5— y `textoDeApertura` de `@/lib/goteo`.

- [ ] **Paso 4: Verificar build y lint**

```bash
bun run lint && bun run build
```

Esperado: código de salida 0 en los dos.

- [ ] **Paso 5: Correr la suite completa**

Con `bun run dev` levantado en otra terminal:

```bash
bun run test
```

Esperado: todo verde. Referencia antes de esta función: 256 pruebas, 0 fallos.

- [ ] **Paso 6: Comprobarlo a mano de punta a punta**

1. Como creador, poner «Fundamentos» a 7 días.
2. Entrar como alumno (`joffrellerena1996+alumno@gmail.com`) a `/c/mentoria-v7/cursos`.
3. Esperado: la tarjeta de «Fundamentos» con candado y el texto de cuándo se abre. No navega al pulsarla.
4. Pegar en la barra la dirección de un submódulo de ese módulo. Esperado: el estado «todavía no está abierto», no una lista vacía.
5. Que la base de verdad no entrega el contenido ya lo comprueba la prueba G1,
   que pide los submódulos y las clases **por su id** con la sesión del alumno —
   exactamente lo que haría alguien con las herramientas del navegador abiertas.
   No hace falta repetirlo a mano.
6. Volver a poner «Al comprar». Esperado: reabre al instante y el progreso sigue donde estaba.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/hooks/use-courses.ts src/components/course/course-card.tsx "src/app/(miembro)/c/[comunidad]/cursos/[curso]/modulo/[id]/_modulo-detalle.tsx"
git commit -m "feat(goteo): el alumno ve el candado con la fecha, tambien por URL directa"
```

---

## Verificación final

1. `bun run lint` y `bun run build`, por código de salida.
2. `bun run test` completa con `bun run dev` levantado.
3. Revisar el modo oscuro de la lista de módulos y de la tarjeta bloqueada (toggle en el menú de usuario).
4. Tras `bun run deploy`, repetir a mano los pasos 1-6 de la Tarea 5 contra producción.
