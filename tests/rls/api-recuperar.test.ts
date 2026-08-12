import { expect, test, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";

const BASE = "http://localhost:3000";

let hayServidor = false;

/**
 * Las pruebas comparten cubo de tope con todo lo demás que corra desde esta
 * máquina: sin `cf-connecting-ip` ni `x-forwarded-for`, `ipDe` devuelve
 * "desconocida" y todas las peticiones locales caen en la misma cuenta.
 *
 * Sin este borrado, correr la suite unas cuantas veces en un día agotaría el
 * tope y las pruebas empezarían a fallar por algo que no es el código —el peor
 * tipo de prueba inestable, la que acaba con alguien desactivándola.
 */
const sql = new SQL(process.env.SUPABASE_DB_URL!, { max: 1 });

async function limpiarTopes() {
  await sql`
    delete from public.limites_uso
    where ambito in ('recuperar_ip', 'recuperar_email')
  `;
}

beforeAll(async () => {
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
  if (hayServidor) await limpiarTopes();
});

afterAll(async () => {
  if (hayServidor) await limpiarTopes();
  await sql.end();
});

function saltar(): boolean {
  if (!hayServidor) {
    console.log("SALTADA: arranca `bun run dev` para probar el Route Handler");
    return true;
  }
  return false;
}

async function pedir(email: unknown) {
  return fetch(`${BASE}/api/recuperar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

test("responde lo mismo exista o no la cuenta", async () => {
  if (saltar()) return;

  // Es lo que impide averiguar quien tiene cuenta preguntando uno a uno. Si
  // una de las dos respuestas se distinguiera de la otra --- por el codigo,
  // por el cuerpo o por tardar bastante mas --- ese seria el agujero.
  const existe = await pedir("joffrellerena1996@gmail.com");
  const noExiste = await pedir("no-existe-jamas-12345@prueba.klaze");

  expect(existe.status).toBe(noExiste.status);
  expect(await existe.json()).toEqual(await noExiste.json());
});

test("sin correo responde 400", async () => {
  if (saltar()) return;
  const r = await pedir(undefined);
  expect(r.status).toBe(400);
});

test("no hace falta sesion para pedirlo", async () => {
  if (saltar()) return;
  // Quien ha perdido la contrasena no puede iniciar sesion: exigirsela seria
  // pedirle justo lo que ha venido a recuperar.
  const r = await pedir("cualquiera@prueba.klaze");
  expect(r.ok).toBe(true);
});

test("pasarse del tope se responde igual que no pasarse", async () => {
  if (saltar()) return;

  // El tope existe para que un bucle de tres lineas no queme la cuota de
  // Resend --- y, mucho peor, la reputacion del dominio remitente: cuando eso
  // pasa dejan de llegar los correos de acceso de toda la gente que si pago.
  //
  // Pero un 429 aqui diria "has llegado al limite de ESE correo", o sea "ese
  // correo existe", y devolveria por la ventana la enumeracion de usuarios que
  // la primera prueba de este archivo protege. Asi que el tope corta el envio
  // y calla: desde fuera, pasarse y no pasarse son indistinguibles.
  await limpiarTopes();

  const victima = "tope-recuperar@prueba.klaze";
  const primera = await pedir(victima);
  const cuerpoPrimera = await primera.json();

  // Muy por encima de los 5 por correo y los 20 por IP.
  for (let i = 0; i < 25; i++) await pedir(victima);

  const pasada = await pedir(victima);
  expect(pasada.status).toBe(primera.status);
  expect(await pasada.json()).toEqual(cuerpoPrimera);

  await limpiarTopes();
});

test("el tope por IP frena aunque cambie el correo en cada intento", async () => {
  if (saltar()) return;

  // Contar solo por correo no seria un tope: quien manda en bucle inventa una
  // direccion distinta cada vez y no repite ninguna nunca.
  await limpiarTopes();

  for (let i = 0; i < 25; i++) await pedir(`suelto-${i}@prueba.klaze`);

  const [fila] = await sql`
    select usos from public.limites_uso
    where ambito = 'recuperar_ip' and dia = current_date
  `;
  expect(fila.usos).toBeGreaterThanOrEqual(20);

  // Y por encima del tope deja de crear filas por correo: la comprobacion de
  // la IP va primero justamente para que una reventada no llene la tabla con
  // una fila por cada direccion inventada.
  const porCorreo = await sql`
    select count(*)::int as n from public.limites_uso
    where ambito = 'recuperar_email' and dia = current_date
  `;
  expect(porCorreo[0].n).toBeLessThan(25);

  await limpiarTopes();
});
