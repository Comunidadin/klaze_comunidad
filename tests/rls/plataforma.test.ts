import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import {
  leerPlataforma,
  cambiarEstadoComunidad,
  guardarPlan,
} from "../../src/lib/supabase/plataforma";

let e: Escenario;

beforeAll(async () => {
  e = await montarEscenario("plat");
});

afterAll(async () => {
  await desmontar(e);
});

test("el superadmin ve las dos academias con dueno, plan y miembros", async () => {
  const { academias } = await leerPlataforma(e.superadmin.cliente);
  const ids = academias.map((a) => a.comunidad.id);
  expect(ids).toContain(e.comunidadA);
  expect(ids).toContain(e.comunidadB);

  const a = academias.find((x) => x.comunidad.id === e.comunidadA)!;
  expect(a.dueno.id).toBe(e.duenoA.id);
  expect(a.plan.id).toBe("pro");
  expect(a.miembros).toBe(1);
});

test("el plan llega con sus tres limites y el precio como numero", async () => {
  // `precio_mes` es `numeric`: llega como cadena por el JSON. Sin `Number`, dos
  // precios se concatenarian en vez de sumarse.
  const { planes } = await leerPlataforma(e.superadmin.cliente);
  const pro = planes.find((p) => p.id === "pro")!;
  expect(typeof pro.precioMes).toBe("number");
  expect(typeof pro.limites.comunidades).toBe("number");
  expect(typeof pro.limites.alumnos).toBe("number");
  expect(typeof pro.limites.cursos).toBe("number");
});

test("un creador no ve la academia ajena", async () => {
  const { academias } = await leerPlataforma(e.duenoA.cliente);
  const ids = academias.map((x) => x.comunidad.id);
  expect(ids).not.toContain(e.comunidadB);
});

test("un alumno no puede suspender una academia", async () => {
  await expect(
    cambiarEstadoComunidad(e.alumnoA.cliente, e.comunidadA, "suspendida")
  ).rejects.toThrow();
});

test("un creador tampoco puede suspender la suya", async () => {
  // Suspender es del superadmin. Si el creador pudiera, se dejaria fuera solo
  // y sin forma de volver: reactivar tampoco seria suyo.
  await expect(
    cambiarEstadoComunidad(e.duenoA.cliente, e.comunidadA, "suspendida")
  ).rejects.toThrow();
});

test("el superadmin suspende y reactiva", async () => {
  await cambiarEstadoComunidad(e.superadmin.cliente, e.comunidadA, "suspendida");
  const { academias } = await leerPlataforma(e.superadmin.cliente);
  expect(
    academias.find((a) => a.comunidad.id === e.comunidadA)?.comunidad.estado
  ).toBe("suspendida");

  await cambiarEstadoComunidad(e.superadmin.cliente, e.comunidadA, "activa");
});

test("un alumno no puede editar un plan", async () => {
  const { planes } = await leerPlataforma(e.superadmin.cliente);
  const pro = planes.find((p) => p.id === "pro")!;
  await expect(
    guardarPlan(e.alumnoA.cliente, { ...pro, precioMes: 1 })
  ).rejects.toThrow();
});

test("el superadmin edita un plan y el cambio se lee", async () => {
  const { planes } = await leerPlataforma(e.superadmin.cliente);
  const pro = planes.find((p) => p.id === "pro")!;

  await guardarPlan(e.superadmin.cliente, {
    ...pro,
    precioMes: 88,
    limites: { ...pro.limites, comunidades: 7 },
  });

  const despues = await leerPlataforma(e.superadmin.cliente);
  const guardado = despues.planes.find((p) => p.id === "pro")!;
  expect(guardado.precioMes).toBe(88);
  // El limite de comunidades no tenia columna hasta esta rebanada: se editaba
  // en la pantalla y se guardaba en el vacio. Esta linea es la que lo vigila.
  expect(guardado.limites.comunidades).toBe(7);

  // Se restaura: el proyecto es real y compartido, y dejar el plan a 88
  // envenenaria la siguiente ejecucion y el panel del usuario.
  await guardarPlan(e.superadmin.cliente, pro);

  const restaurado = await leerPlataforma(e.superadmin.cliente);
  expect(restaurado.planes.find((p) => p.id === "pro")?.precioMes).toBe(
    pro.precioMes
  );
});
