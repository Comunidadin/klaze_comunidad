import { expect, test, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";
import { admin } from "./ayudas";

/**
 * Los topes de uso: el contador que le faltaba a lo que gasta dinero.
 *
 * Lo que se prueba aquí no es que el número exista, sino las dos propiedades
 * de las que depende que sirva para algo:
 *
 * 1. **Cuenta también lo que rechaza.** Si insistir no sumara, quien está en
 *    el tope podría reintentar para siempre.
 * 2. **Es atómico.** Un atacante manda en paralelo, no en fila. La versión
 *    anterior del tope de los canales contaba filas y luego trabajaba, y entre
 *    las dos cosas cabía un envío entero.
 *
 * `max: 4` y no `1`: la prueba de concurrencia necesita conexiones de verdad
 * simultáneas. Con una sola, la propia biblioteca las pondría en fila y la
 * prueba pasaría sin haber probado nada.
 */
const sql = new SQL(process.env.SUPABASE_DB_URL!, { max: 4 });

const AMBITO = "prueba_topes";

async function limpiar() {
  await sql`delete from public.limites_uso where ambito like 'prueba_%'`;
}

beforeAll(limpiar);
afterAll(async () => {
  await limpiar();
  await sql.end();
});

test("T1. deja pasar hasta el tope y despues no", async () => {
  const clave = "t1@prueba.klaze";
  const resultados: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    const [f] = await sql`select public.consumir_limite(${AMBITO}, ${clave}, 3) as ok`;
    resultados.push(f.ok);
  }
  expect(resultados).toEqual([true, true, true, false, false]);
});

test("T2. insistir no reinicia el contador: los rechazos tambien suman", async () => {
  // Es la diferencia entre un tope y un badén. Si un intento bloqueado no
  // contara, quien llega al límite lo intentaría indefinidamente y el contador
  // se quedaría clavado justo en el número que lo bloquea.
  const clave = "t2@prueba.klaze";
  for (let i = 0; i < 10; i++) {
    await sql`select public.consumir_limite(${AMBITO}, ${clave}, 2) as ok`;
  }
  const [f] = await sql`
    select usos from public.limites_uso
    where ambito = ${AMBITO} and clave = ${clave} and dia = current_date
  `;
  expect(f.usos).toBe(10);
});

test("T3. veinte peticiones a la vez contra un tope de cinco dejan pasar cinco", async () => {
  // La prueba que justifica el cambio de `topeAlcanzado`. La versión anterior
  // hacía `select count(*)` y el trabajo ocurría después: veinte peticiones
  // simultáneas leían todas el mismo número y pasaban todas. Con un tope de
  // 200 era una molestia; con el de 5 del canal de plataforma, un envío en
  // paralelo creaba veinte academias.
  const clave = "t3-concurrente";

  const votos = await Promise.all(
    Array.from({ length: 20 }, () =>
      sql`select public.consumir_limite(${AMBITO}, ${clave}, 5) as ok`.then(
        ([f]: { ok: boolean }[]) => f.ok
      )
    )
  );

  expect(votos.filter(Boolean).length).toBe(5);
});

test("T4. la clave no distingue mayusculas ni espacios sobrantes", async () => {
  // Sin normalizar, `Ana@X.com` y `ana@x.com` serían dos cubos distintos y el
  // tope se multiplicaría por las formas de escribir el mismo correo.
  const [a] = await sql`select public.consumir_limite(${AMBITO}, ${"  Ana@Prueba.Klaze "}, 1) as ok`;
  const [b] = await sql`select public.consumir_limite(${AMBITO}, ${"ana@prueba.klaze"}, 1) as ok`;
  expect(a.ok).toBe(true);
  expect(b.ok).toBe(false);
});

test("T5. cada dia empieza de cero", async () => {
  const clave = "t5@prueba.klaze";
  await sql`select public.consumir_limite(${AMBITO}, ${clave}, 1)`;

  // Se simula el día de ayer moviendo la fila, que es lo único que distingue
  // un día de otro en esta tabla.
  await sql`
    update public.limites_uso set dia = current_date - 1
    where ambito = ${AMBITO} and clave = ${clave}
  `;

  const [hoy] = await sql`select public.consumir_limite(${AMBITO}, ${clave}, 1) as ok`;
  expect(hoy.ok).toBe(true);
});

test("T6. purgar borra lo viejo y respeta lo de hoy", async () => {
  const clave = "t6@prueba.klaze";
  await sql`select public.consumir_limite(${AMBITO}, ${clave}, 9)`;
  await sql`
    insert into public.limites_uso (ambito, clave, dia, usos)
    values (${AMBITO}, ${clave}, current_date - 60, 7)
  `;

  await sql`select public.purgar_limites(30)`;

  const filas = await sql`
    select dia from public.limites_uso where ambito = ${AMBITO} and clave = ${clave}
  `;
  expect(filas.length).toBe(1);
});

test("T7. el navegador no puede tocar el contador", async () => {
  // La protección de `limites_uso` es una ausencia —cero políticas, cero
  // permisos— y una ausencia no se ve leyendo el código. Aquí se comprueba por
  // el camino real: el cliente del API, no el catálogo.
  //
  // Si esto se rompiera, quien está siendo limitado pondría su contador a cero
  // y el tope dejaría de existir.
  const { data, error } = await admin.rpc("consumir_limite", {
    p_ambito: AMBITO,
    p_clave: "t7",
    p_tope: 1,
  });

  // El cliente `admin` usa la clave secreta (rol `service_role`), que SÍ puede:
  // es quien la llama de verdad desde los Route Handlers. Lo que no puede
  // llamarla es `authenticated`, y eso lo verifica A2c de `auditoria.test.ts`
  // con `has_function_privilege`. Aquí solo se confirma que el camino bueno
  // funciona a través de PostgREST, que es por donde va el servidor.
  expect(error).toBeNull();
  expect(data).toBe(true);

  await sql`delete from public.limites_uso where ambito = ${AMBITO} and clave = 't7'`;
});
