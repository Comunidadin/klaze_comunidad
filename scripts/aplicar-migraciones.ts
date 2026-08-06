/**
 * Aplica las migraciones de `supabase/migrations/` conectando directo a
 * Postgres.
 *
 * Existe porque `supabase db push` exige `supabase login`, que abre un
 * navegador y no se puede automatizar. Este script hace lo mismo por la vía
 * directa **y registra cada migración en `supabase_migrations.schema_migrations`**,
 * que es la tabla que la CLI consulta. Así, cuando alguien enlace el proyecto,
 * `supabase db push` verá estas migraciones como ya aplicadas en vez de
 * intentar repetirlas.
 *
 * Cada archivo se aplica dentro de una transacción: si una sentencia falla,
 * esa migración no deja nada a medias.
 *
 *   bun run db:push
 */
import { SQL } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  throw new Error(
    "Falta SUPABASE_DB_URL en `.env.local`. Es la cadena de conexión directa " +
      "a Postgres (Project Settings → Database → Connection string)."
  );
}

const DIR = join(import.meta.dir, "..", "supabase", "migrations");
const sql = new SQL(DB_URL, { max: 1 });

await sql`create schema if not exists supabase_migrations`;
await sql`
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    name text,
    statements text[]
  )
`;

const aplicadas = new Set(
  (
    await sql`select version from supabase_migrations.schema_migrations`
  ).map((f: { version: string }) => f.version)
);

const archivos = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();

let nuevas = 0;
for (const archivo of archivos) {
  const version = archivo.split("_")[0];
  const nombre = archivo.replace(/^\d+_/, "").replace(/\.sql$/, "");

  if (aplicadas.has(version)) {
    console.log(`  ya aplicada  ${archivo}`);
    continue;
  }

  const contenido = await Bun.file(join(DIR, archivo)).text();
  if (contenido.trim().length === 0) {
    console.log(`  vacía        ${archivo}`);
    continue;
  }

  process.stdout.write(`  aplicando    ${archivo} ... `);
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(contenido);
      // Solo version y nombre. `statements` se deja nulo a proposito: la CLI
      // solo lo usa para `migration repair`/`squash`, y meter el SQL entero en
      // una columna text[] rompe el literal en cuanto el SQL trae comillas.
      await tx`
        insert into supabase_migrations.schema_migrations (version, name)
        values (${version}, ${nombre})
      `;
    });
    console.log("OK");
    nuevas++;
  } catch (e) {
    console.log("FALLO");
    console.error(`\n${(e as Error).message}\n`);
    await sql.end();
    process.exit(1);
  }
}

console.log(nuevas === 0 ? "\nSin migraciones nuevas." : `\n${nuevas} migración(es) aplicada(s).`);
await sql.end();
