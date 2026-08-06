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

test("apuntamos a una base sin nuestras tablas todavia", async () => {
  // Pasa PORQUE la tabla aún no existe. Confirma que las migraciones se van
  // a aplicar sobre el proyecto que creemos, y no sobre otro con datos.
  const { error } = await admin.from("comunidades").select("*");
  expect(error?.code).toBe("PGRST205");
});
