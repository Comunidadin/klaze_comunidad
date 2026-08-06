import { expect, test, afterAll } from "bun:test";
import { comoUsuario, limpiarUsuarios } from "./ayudas";

const creados: string[] = [];
afterAll(() => limpiarUsuarios(creados));

test("crear una cuenta crea su perfil automaticamente", async () => {
  const { id, cliente } = await comoUsuario("perfil@prueba.klaze");
  creados.push(id);

  const { data } = await cliente.from("perfiles").select("*").eq("id", id).single();
  expect(data?.id).toBe(id);
  expect(data?.rol).toBe("alumno");
});

test("nadie puede editar el perfil de otro", async () => {
  const a = await comoUsuario("a@prueba.klaze");
  const b = await comoUsuario("b@prueba.klaze");
  creados.push(a.id, b.id);

  const { data } = await b.cliente
    .from("perfiles")
    .update({ nombre: "secuestrado" })
    .eq("id", a.id)
    .select();

  // 0 filas: RLS no le deja ni ver la fila, asi que no hay nada que actualizar.
  expect(data).toEqual([]);
});
