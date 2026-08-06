import { expect, test, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";

const creados: string[] = [];
afterAll(() => limpiarUsuarios(creados));

test("la clave secreta puede crear y autenticar un usuario", async () => {
  const { id, cliente } = await comoUsuario("conexion@prueba.klaze");
  creados.push(id);

  const { data } = await cliente.auth.getUser();
  expect(data.user?.email).toBe("conexion@prueba.klaze");
});

test("apuntamos al proyecto con nuestro esquema aplicado", async () => {
  // Sustituye a la comprobacion de arranque ("la tabla aun no existe"), que
  // dejo de valer en cuanto se aplico la primera migracion. Ahora confirma lo
  // contrario: que el proyecto al que apuntamos es el que hemos migrado.
  const { error } = await admin.from("comunidades").select("id").limit(1);
  expect(error).toBeNull();

  const { data } = await admin.from("planes").select("id").order("id");
  expect((data ?? []).map((p) => p.id)).toEqual(["pro", "scale", "starter"]);
});
