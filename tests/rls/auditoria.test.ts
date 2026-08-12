import { expect, test, afterAll } from "bun:test";
import { SQL } from "bun";

/**
 * Revisión de seguridad del esquema.
 *
 * Sustituye a `supabase db advisors`, que exige `supabase login` (navegador,
 * no automatizable). Estas comprobaciones son las mismas que hace el advisor
 * de seguridad, consultadas directamente al catálogo de Postgres — y al vivir
 * como prueba, se ejecutan en cada cambio en vez de una sola vez.
 */
const sql = new SQL(process.env.SUPABASE_DB_URL!, { max: 1 });
afterAll(() => sql.end());

test("A1. toda tabla de `public` tiene RLS activado", async () => {
  const sinRls = await sql`
    select tablename from pg_tables t
    join pg_class c on c.relname = t.tablename
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where t.schemaname = 'public' and c.relrowsecurity = false
    order by 1
  `;
  expect(sinRls.map((r: { tablename: string }) => r.tablename)).toEqual([]);
});

test("A2. toda tabla de `public` tiene al menos una politica", async () => {
  // RLS activado sin politicas deja la tabla ilegible para todo el mundo.
  // Suele ser un olvido, no una decision.
  //
  // Salvo en `limites_uso`, donde SI es la decision: es el contador de topes, y
  // lo unico que lo hace un tope es que la persona limitada no pueda tocarlo.
  // No se le da la vuelta a la comprobacion, se le pone nombre --- y A2c de
  // abajo verifica que ese cero sigue siendo cero.
  const SIN_POLITICA_A_PROPOSITO = ["limites_uso"];

  const sinPolitica = await sql`
    select t.tablename from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename
      )
    order by 1
  `;
  const inesperadas = sinPolitica
    .map((r: { tablename: string }) => r.tablename)
    .filter((t: string) => !SIN_POLITICA_A_PROPOSITO.includes(t));
  expect(inesperadas).toEqual([]);
});

test("A2c. `limites_uso` sigue siendo inalcanzable desde el navegador", async () => {
  // La proteccion de esta tabla es una ausencia --- cero politicas y cero
  // permisos --- y una ausencia no se ve al leer el codigo. Esta prueba la
  // convierte en algo que se rompe si alguien la deshace.
  //
  // Lo que impide: que quien esta siendo limitado ponga su propio contador a
  // cero. Sin eso, el tope de `/api/recuperar` seria un adorno y volveriamos a
  // ALTO-1 de la auditoria del 12 de agosto.
  const politicas = await sql`
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'limites_uso'
  `;
  expect(politicas.map((r: { policyname: string }) => r.policyname)).toEqual([]);

  // Y sin permisos: Supabase concede todo por defecto a cada tabla nueva de
  // `public`, asi que esto se quita a mano y hay que vigilar que siga quitado.
  const permisos = await sql`
    select grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'limites_uso'
      and grantee in ('anon', 'authenticated')
  `;
  expect(permisos).toEqual([]);

  // La funcion que si escribe, tampoco se puede llamar desde el navegador.
  const puede = await sql`
    select has_function_privilege('authenticated',
      'public.consumir_limite(text,text,integer)', 'EXECUTE') as auth,
      has_function_privilege('anon',
      'public.consumir_limite(text,text,integer)', 'EXECUTE') as anon
  `;
  expect(puede[0].auth).toBe(false);
  expect(puede[0].anon).toBe(false);
});

test("A2b. ninguna tabla se queda solo con politica de lectura", async () => {
  // A2 comprobaba "al menos una politica", y eso dejo pasar seis tablas con
  // SELECT y nada mas: nadie podia escribir en ellas, ni su propio dueno. Lo
  // encontro la primera prueba que intento guardar un curso, no la auditoria.
  // Esta comprobacion existe para que no vuelva a colarse.
  //
  // Dos excepciones, y las dos por lo mismo: ahi la AUSENCIA de politica de
  // escritura ES la proteccion. Solo escribe el Route Handler con la clave
  // secreta, que se salta RLS.
  //
  // - `uso_ia`: con una politica de escritura, un alumno pondria su contador de
  //   preguntas a cero y gastaria sin limite la clave de OpenAI del dueno de la
  //   plataforma.
  // - `recepciones_canal`: es el registro de lo que llego por los enlaces de
  //   compra. Un registro que su dueno puede editar o borrar no sirve para
  //   averiguar por que alguien no entro.
  //
  // `limites_uso` no aparece aqui porque no tiene NINGUNA politica, ni de
  // lectura: no llega a esta comprobacion, que solo mira las tablas que tienen
  // alguna. La vigila A2c, justo debajo.
  const EXCEPCIONES = ["uso_ia", "recepciones_canal"];

  const soloLectura = await sql`
    select t.tablename
    from pg_tables t
    where t.schemaname = 'public'
      and exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename
      )
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename
          and p.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      )
    order by 1
  `;
  const inesperadas = soloLectura
    .map((r: { tablename: string }) => r.tablename)
    .filter((t: string) => !EXCEPCIONES.includes(t));
  expect(inesperadas).toEqual([]);
});

test("A3. toda funcion `security definer` fija su search_path", async () => {
  // Sin `set search_path = ''`, alguien puede anteponer un esquema propio y
  // cambiar el significado de la funcion desde dentro.
  const sinSearchPath = await sql`
    select n.nspname || '.' || p.proname as funcion
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'privado')
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
        where cfg like 'search_path=%'
      )
    order by 1
  `;
  expect(sinSearchPath.map((r: { funcion: string }) => r.funcion)).toEqual([]);
});

test("A4. el esquema `privado` no es alcanzable desde el API", async () => {
  const permisos = await sql`
    select has_schema_privilege('anon', 'privado', 'USAGE') as anon,
           has_schema_privilege('authenticated', 'privado', 'USAGE') as auth
  `;
  // `authenticated` necesita USAGE para ejecutar las funciones desde las
  // politicas, pero `anon` no debe tener nada.
  expect(permisos[0].anon).toBe(false);
});

test("A5. `planes` es la unica politica sin condicion", async () => {
  // `using (true)` deja pasar TODAS las filas de una tabla. En `planes` es
  // correcto --- es el catalogo de tarifas, lo mismo para todo el mundo, y solo
  // de lectura para `authenticated` --- pero es la clase de linea que se copia y
  // pega a otra tabla donde no da igual.
  //
  // Asi que en vez de arreglarla, se le pone nombre: si aparece una segunda,
  // esta prueba se pone roja y alguien tiene que justificarla.
  const SIN_CONDICION_A_PROPOSITO = ["planes"];

  const abiertas = await sql`
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
    order by 1, 2
  `;

  const inesperadas = abiertas
    .filter((p: { tablename: string }) => !SIN_CONDICION_A_PROPOSITO.includes(p.tablename))
    .map((p: { tablename: string; policyname: string }) => `${p.tablename}: ${p.policyname}`);
  expect(inesperadas).toEqual([]);

  // Y la de `planes` sigue siendo solo de lectura: `using (true)` en un SELECT
  // es un catalogo; en un INSERT o un UPDATE seria que cualquiera con sesion
  // reescribe tus precios.
  const dePlanes = abiertas.filter((p: { tablename: string }) => p.tablename === "planes");
  for (const p of dePlanes as { cmd: string }[]) {
    expect(p.cmd).toBe("SELECT");
  }
});
