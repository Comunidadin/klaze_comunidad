import { expect, test, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";

const creados: string[] = [];
afterAll(() => limpiarUsuarios(creados));

test("7. nadie puede ascenderse a superadmin desde el navegador", async () => {
  const u = await comoUsuario("escalada@prueba.klaze");
  creados.push(u.id);

  // `user_metadata` SI es editable por el propio usuario. Esta llamada
  // funciona, y ese es justo el punto: si `es_superadmin()` leyera de ahi,
  // cualquiera se ascenderia desde la consola del navegador.
  await u.cliente.auth.updateUser({ data: { rol: "superadmin" } });

  // Pero la funcion lee `app_metadata`, que solo escribe el servidor.
  const { data: sesion } = await u.cliente.auth.getSession();
  const claims = JSON.parse(atob(sesion.session!.access_token.split(".")[1]));
  expect(claims.app_metadata?.rol ?? "alumno").not.toBe("superadmin");
});

test("7b. el superadmin de verdad se marca desde el servidor", async () => {
  const u = await comoUsuario("jefe@prueba.klaze");
  creados.push(u.id);

  const { error } = await admin.auth.admin.updateUserById(u.id, {
    app_metadata: { rol: "superadmin" },
  });
  expect(error).toBeNull();
});

test("7c. el registro publico esta cerrado", async () => {
  // El alcance es alta manual: el superadmin da de alta a las empresas y
  // los duenos invitan a sus alumnos. Nadie debe poder crearse una cuenta
  // solo por conocer la URL del proyecto.
  //
  // Esto NO se puede cerrar por SQL: es configuracion de autenticacion.
  // Panel -> Authentication -> Sign In / Providers -> Email -> desactivar
  // "Allow new users to sign up".
  const respuesta = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`,
    {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "colado@prueba.klaze",
        password: "loquesea123456",
      }),
    }
  );

  // Mientras el registro siga abierto, esta llamada crea de verdad la cuenta.
  // Se borra aqui para no dejar basura en un proyecto real cada vez que
  // alguien ejecuta las pruebas.
  if (respuesta.status === 200) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const colado = data?.users?.find((u) => u.email === "colado@prueba.klaze");
    if (colado) await admin.auth.admin.deleteUser(colado.id);
  }

  expect(respuesta.status).toBe(422);
});
