import { expect, test, beforeAll } from "bun:test";

const BASE = "http://localhost:3000";

let hayServidor = false;

beforeAll(async () => {
  hayServidor = await fetch(`${BASE}/login`)
    .then((r) => r.ok)
    .catch(() => false);
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
