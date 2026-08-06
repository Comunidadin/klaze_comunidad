import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { actualizarPerfil, guardarComunidad } from "../../src/lib/supabase/perfil";
import { cargarArmazon } from "../../src/lib/supabase/consultas";

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("perfil");
});

afterAll(async () => {
  await desmontar(e);
});

test("cada cual edita su propio perfil", async () => {
  await actualizarPerfil(e.alumnoA.cliente, { nombre: "Ana Real", bio: "Vendo cosas" });

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.perfil.nombre).toBe("Ana Real");
  expect(armazon.perfil.bio).toBe("Vendo cosas");
});

test("nadie puede editar el perfil de otro", async () => {
  // `actualizarPerfil` saca el id de la sesion, asi que la unica forma de
  // intentarlo es saltandose el helper. La politica tiene que filtrarlo.
  const { data } = await e.alumnoB.cliente
    .from("perfiles")
    .update({ nombre: "Secuestrada" })
    .eq("id", e.alumnoA.id)
    .select();

  expect(data ?? []).toEqual([]);

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.perfil.nombre).toBe("Ana Real");
});

test("el dueno cambia el nombre y el color de su academia", async () => {
  await guardarComunidad(e.duenoA.cliente, e.comunidadA, {
    nombre: "Academia Nueva",
    colorAcento: "#123456",
  });

  const armazon = await cargarArmazon(e.duenoA.cliente);
  expect(armazon.comunidad?.nombre).toBe("Academia Nueva");
  expect(armazon.comunidad?.colorAcento).toBe("#123456");
});

test("los nombres de nivel tambien se guardan", async () => {
  const nombres = [
    "Uno", "Dos", "Tres", "Cuatro", "Cinco",
    "Seis", "Siete", "Ocho", "Nueve",
  ];
  await guardarComunidad(e.duenoA.cliente, e.comunidadA, { nombresNiveles: nombres });

  const armazon = await cargarArmazon(e.duenoA.cliente);
  expect(armazon.comunidad?.nombresNiveles).toEqual(nombres);
});

test("un alumno no puede renombrar la academia", async () => {
  await expect(
    guardarComunidad(e.alumnoA.cliente, e.comunidadA, { nombre: "Secuestrada" })
  ).rejects.toThrow();
});

test("el dueno de B no puede tocar la academia de A", async () => {
  await expect(
    guardarComunidad(e.duenoB.cliente, e.comunidadA, { nombre: "Ajena" })
  ).rejects.toThrow();
});
