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
  const sinPolitica = await sql`
    select t.tablename from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename
      )
    order by 1
  `;
  expect(sinPolitica.map((r: { tablename: string }) => r.tablename)).toEqual([]);
});

test("A2b. ninguna tabla se queda solo con politica de lectura", async () => {
  // A2 comprobaba "al menos una politica", y eso dejo pasar seis tablas con
  // SELECT y nada mas: nadie podia escribir en ellas, ni su propio dueno. Lo
  // encontro la primera prueba que intento guardar un curso, no la auditoria.
  // Esta comprobacion existe para que no vuelva a colarse.
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
  expect(soloLectura.map((r: { tablename: string }) => r.tablename)).toEqual([]);
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
