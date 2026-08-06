import { expect, test, afterAll } from "bun:test";
import { admin, comoAnonimo, limpiarUsuarios } from "./ayudas";
import { crearAcademia } from "../../scripts/crear-academia";

const creados: string[] = [];
afterAll(async () => {
  await admin.from("comunidades").delete().eq("slug", "acme-prueba");
  await limpiarUsuarios(creados);
});

test("crear una academia deja comunidad, dueno y perfil correctos", async () => {
  const r = await crearAcademia({
    email: "jefe-acme@prueba.klaze",
    empresa: "ACME Prueba",
    slug: "acme-prueba",
  });
  creados.push(r.usuarioId);

  expect(r.yaExistia).toBe(false);

  const { data: com } = await admin
    .from("comunidades")
    .select("nombre, propietario_id, plan_id")
    .eq("id", r.comunidadId)
    .single();
  expect(com?.nombre).toBe("ACME Prueba");
  expect(com?.propietario_id).toBe(r.usuarioId);
  expect(com?.plan_id).toBe("pro");

  const { data: perfil } = await admin
    .from("perfiles")
    .select("rol")
    .eq("id", r.usuarioId)
    .single();
  expect(perfil?.rol).toBe("creador");
});

test("repetir el alta no duplica", async () => {
  const r = await crearAcademia({
    email: "jefe-acme@prueba.klaze",
    empresa: "ACME Prueba",
    slug: "acme-prueba",
  });
  expect(r.yaExistia).toBe(true);
});

test("la marca de la academia se lee sin sesion", async () => {
  // La pantalla de login muestra la portada de la academia antes de que
  // exista cuenta, asi que esta consulta tiene que funcionar sin sesion.
  const anon = comoAnonimo();
  const { data } = await anon.rpc("marca_publica", { p_slug: "acme-prueba" });
  expect(data?.[0]?.nombre).toBe("ACME Prueba");
});
