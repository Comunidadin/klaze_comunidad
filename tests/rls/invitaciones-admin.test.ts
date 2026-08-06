import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import {
  crearInvitaciones,
  listarInvitaciones,
} from "../../src/lib/supabase/invitaciones";

let e: Escenario;
beforeAll(async () => {
  e = await montarEscenario("invadmin");
});
afterAll(async () => {
  await desmontar(e);
});

test("el dueno crea invitaciones con cursos concretos", async () => {
  const creadas = await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["nuevo1@prueba.klaze"],
    [e.cursoAPublicado]
  );
  expect(creadas.length).toBe(1);
  // Token aleatorio de 32 bytes en hex = 64 caracteres.
  expect(creadas[0].token.length).toBeGreaterThanOrEqual(40);

  const lista = await listarInvitaciones(e.duenoA.cliente, e.comunidadA);
  const suya = lista.find((i) => i.email === "nuevo1@prueba.klaze");
  expect(suya).toBeDefined();
  expect(suya?.cursoIds).toEqual([e.cursoAPublicado]);
});

test("invitar a toda la academia se guarda como 'todos'", async () => {
  await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["completo@prueba.klaze"],
    "todos"
  );
  const lista = await listarInvitaciones(e.duenoA.cliente, e.comunidadA);
  expect(lista.find((i) => i.email === "completo@prueba.klaze")?.cursoIds).toBe("todos");
});

test("un alumno no puede crear invitaciones", async () => {
  await expect(
    crearInvitaciones(
      e.alumnoA.cliente,
      e.comunidadA,
      ["colado@prueba.klaze"],
      "todos"
    )
  ).rejects.toThrow();
});

test("el dueno de B no ve las invitaciones de A ni pidiendolas", async () => {
  await crearInvitaciones(
    e.duenoA.cliente,
    e.comunidadA,
    ["solo-a@prueba.klaze"],
    "todos"
  );

  // Pide explicitamente las de la comunidad ajena: RLS no filtra por el `.eq`,
  // filtra por la politica, asi que esto tiene que volver vacio.
  const intruso = await listarInvitaciones(e.duenoB.cliente, e.comunidadA);
  expect(intruso).toEqual([]);
});
