import { expect, test, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";

/**
 * Los cinco hallazgos MEDIO de la auditoría del 12 de agosto.
 *
 * Cuatro de los cinco son endurecimiento: cosas que hoy no dejaban pasar a
 * nadie, pero que quitaban el margen para el siguiente error. Esa clase de
 * arreglo es justo la que se deshace sin querer meses después —nadie recuerda
 * por qué estaba—, así que cada uno se queda aquí escrito como algo que se
 * rompe si alguien lo deshace.
 */
/**
 * `sql` se usa SOLO para leer el catálogo. Ninguna sentencia que pueda fallar
 * pasa por aquí: con `bun:sql` y una sola conexión, un `insert` rechazado la
 * deja en estado de error y todo lo que venga detrás se queda esperando. Las
 * escrituras que deben fallar van por `admin`, que habla HTTP y devuelve el
 * error como dato en vez de lanzarlo.
 */
const sql = new SQL(process.env.SUPABASE_DB_URL!, { max: 1 });

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("endurece");
});

afterAll(async () => {
  await desmontar(e);
  await sql.end();
});

/* --- MEDIO-1: el slug ---------------------------------------------------- */

test("M1. la base rechaza un slug que no cabe en una URL", async () => {
  // Lo que esto impide: el slug acaba dentro de `href="…/login/{slug}"` en el
  // correo de bienvenida. Con comillas dentro, el dueño de una academia
  // inyectaba HTML en el bloque que Klaze presenta como el de confianza —el
  // único sitio del correo donde el alumno espera un enlace legítimo.
  //
  // Y la limpieza del formulario no bastaba: RLS deja al propietario escribir
  // su fila, así que un `PATCH` directo se saltaba la pantalla entera. Por eso
  // esta prueba escribe por el API y no por la pantalla: es el camino que el
  // atacante usaría.
  const malos = [
    'x" onmouseover="alto',
    "<script>",
    "CON-MAYUSCULAS",
    "con espacios",
    "-empieza-en-guion",
    "termina-en-guion-",
    "",
  ];

  for (const slug of malos) {
    const { error } = await admin.from("comunidades").insert({
      slug,
      nombre: "prueba de slug",
      propietario_id: e.duenoA.id,
      plan_id: "starter",
    });

    // Se mira el nombre de la restricción y no solo "hubo error": con otro
    // fallo por medio —un campo obligatorio, una clave repetida— la prueba
    // pasaría sin haber probado nada de lo que dice probar.
    expect(error?.message ?? "").toContain("comunidades_slug_formato");
  }
});

test("M1b. y tambien lo rechaza al renombrar una academia existente", async () => {
  // El camino real del ataque no es crear una academia con el slug malo: es
  // cambiarle el slug a la tuya antes de invitar a nadie. El trigger
  // `congelar_slug_con_alumnos` solo frena eso cuando YA hay alumnos.
  const { data: nueva } = await admin
    .from("comunidades")
    .insert({
      slug: "endurece-sin-alumnos",
      nombre: "Sin alumnos todavía",
      propietario_id: e.duenoA.id,
      plan_id: "starter",
    })
    .select("id")
    .single();

  try {
    const { error } = await admin
      .from("comunidades")
      .update({ slug: 'malo" onload="x' })
      .eq("id", nueva!.id);

    expect(error?.message ?? "").toContain("comunidades_slug_formato");

    // Y uno bueno sí entra: sin esto, la restricción podría estar rechazándolo
    // todo y la prueba de arriba seguiría verde.
    const { error: bueno } = await admin
      .from("comunidades")
      .update({ slug: "endurece-renombrada" })
      .eq("id", nueva!.id);
    expect(bueno).toBeNull();
  } finally {
    await admin.from("comunidades").delete().eq("id", nueva!.id);
  }
});

/* --- MEDIO-2: nada para el anónimo --------------------------------------- */

test("M2. ninguna politica de `public` alcanza al rol anonimo", async () => {
  // `to public` en Postgres no significa "políticas públicas": significa TODOS
  // LOS ROLES, `anon` incluido. Cuatro se habían saltado el patrón que siguen
  // las otras 19.
  const conPublic = await sql`
    select tablename, policyname
    from pg_policies
    where schemaname = 'public' and 'public' = any(roles)
    order by 1, 2
  `;
  expect(conPublic).toEqual([]);
});

test("M2b. `anon` no tiene ningun permiso sobre `public`", async () => {
  // Supabase concede todo a `anon` sobre cada tabla nueva de `public` por
  // privilegios por defecto. Con RLS delante no pasaba ninguna fila, pero la
  // única barrera era que cada condición mirase `auth.uid()`.
  const permisos = await sql`
    select table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'
    order by 1, 2
  `;
  expect(permisos).toEqual([]);
});

test("M2c. una tabla nueva tampoco los hereda", async () => {
  // Esta es la que de verdad cierra M2b: sin cambiar los privilegios por
  // defecto, la próxima `create table` volvería a conceder todo a `anon` y
  // haría falta acordarse de revocarlo cada vez. Acordarse no es un mecanismo.
  await sql`create table if not exists public.z_prueba_privilegios (id int)`;
  try {
    const permisos = await sql`
      select privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'z_prueba_privilegios'
        and grantee = 'anon'
    `;
    expect(permisos).toEqual([]);
  } finally {
    await sql`drop table if exists public.z_prueba_privilegios`;
  }
});

test("M2d. y el miembro sigue viendo lo suyo", async () => {
  // Recrear cuatro políticas es donde se rompe el acceso de todo el mundo sin
  // enterarse. Las condiciones tienen que haber quedado idénticas: solo cambió
  // el rol al que se aplican.
  const cuerpos = await sql`
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'comunidades: los miembros la ven',
        'comunidades: el propietario edita la suya',
        'cursos: los gestiona el propietario',
        'modulos: via su curso'
      )
    order by 1, 2
  `;
  expect(cuerpos.length).toBe(4);

  const porNombre = Object.fromEntries(
    cuerpos.map((c: { policyname: string; qual: string }) => [c.policyname, c.qual])
  );
  // `inscrito_en` y NO `pertenece_a`: si suspender una academia quitara
  // también la lectura de su fila, la app no podría distinguir "suspendida" de
  // "no existe" y enseñaría "Comunidad no encontrada".
  expect(porNombre["comunidades: los miembros la ven"]).toContain("inscrito_en");
  expect(porNombre["cursos: los gestiona el propietario"]).toContain("es_propietario_de");
  expect(porNombre["modulos: via su curso"]).toContain("cubre_curso");
});

/* --- MEDIO-3: los SVG ---------------------------------------------------- */

test("M3. el bucket publico ya no admite SVG", async () => {
  // Un SVG es XML y puede llevar `<script>`. No robaría la sesión de nadie
  // —vive en el dominio de Supabase, otro origen— pero sí permitiría alojar
  // una página que ejecuta código en un dominio que los alumnos reconocen.
  //
  // Se comprueba en el bucket y no en el componente: la lista del navegador da
  // un error legible, pero la que manda es esta, que no depende de que el
  // navegador se porte bien.
  const [b] = await sql`
    select allowed_mime_types from storage.buckets where id = 'publico'
  `;
  expect(b.allowed_mime_types).not.toContain("image/svg+xml");
  // Y las tres que sí hacen falta siguen ahí: quitar de más rompería subir
  // cualquier imagen, que es peor que el problema.
  expect(b.allowed_mime_types).toContain("image/webp");
  expect(b.allowed_mime_types).toContain("image/png");
  expect(b.allowed_mime_types).toContain("image/jpeg");
});

test("M3b. el bucket sigue con su tope de tamano", async () => {
  const [b] = await sql`select file_size_limit from storage.buckets where id = 'publico'`;
  expect(Number(b.file_size_limit)).toBe(5 * 1024 * 1024);
});

/* --- Y que nada de esto haya roto lo de siempre --------------------------- */

test("M4. el catalogo de planes se sigue leyendo con sesion", async () => {
  // La comprobación de que revocar a `anon` no se llevó por delante a
  // `authenticated`. `planes` es la tabla con la política más abierta del
  // proyecto —`using (true)`, porque es un catálogo de tarifas— así que es la
  // primera que se notaría.
  const { data, error } = await admin.from("planes").select("id").limit(1);
  expect(error).toBeNull();
  expect((data ?? []).length).toBeGreaterThan(0);

  const [p] = await sql`
    select has_table_privilege('authenticated', 'public.planes', 'SELECT') as puede
  `;
  expect(p.puede).toBe(true);
});
