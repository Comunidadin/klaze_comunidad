# Rebanada 2 — Alumnos: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan
> casillas (`- [ ]`).

**Objetivo:** que el dueño invite a un alumno real, ese alumno entre con un solo
clic, vea solo sus cursos, y su progreso se guarde entre dispositivos.

**Arquitectura:** las invitaciones y los accesos viven en Postgres con RLS. El
único código de servidor es un Route Handler que genera el enlace de acceso y
manda el correo, porque ambas cosas necesitan la clave secreta. La aceptación
tiene dos caminos al mismo sitio: el trigger existente (rápido) y una función
llamada en cada login (completa).

**Stack:** Supabase, `@supabase/supabase-js`, Resend, Zustand, `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-06-rebanada-2-alumnos-design.md`

## Restricciones globales

- **No hay Docker.** Migraciones con `bun run db:push` al proyecto alojado.
- **Proyecto:** ref `rwqfktltjuztmgggzlqt`. Dominio verificado en Resend:
  `pr.comunidaddelintercambio.com`.
- **Secretos solo de servidor:** `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`,
  `RESEND_FROM`. Ninguna con prefijo `NEXT_PUBLIC_`.
- **RLS en toda tabla nueva, en su misma migración.** `grant` explícito aparte.
- **Toda función `security definer`** lleva `set search_path = ''` y esquema
  explícito en las tablas.
- **Selectores de Zustand:** seleccionar crudo, derivar con `useMemo` fuera.
- **Copy en español.**
- **Antes de cada commit:** `bun run build`, `bun run lint` y `bun run test:rls`.

### Aviso de entorno

La carpeta está sincronizada con iCloud, que resuelve conflictos creando copias
`nombre 2.ext`. Ya aparecieron ocho. Si algo se comporta de forma imposible,
comprobar primero:

```bash
find . -name "* 2.*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.next/*"
```

`aplicar-migraciones.ts` ya falla en voz alta si detecta sellos repetidos.

---

### Tarea 1: Invitaciones en la base

**Archivos:**
- Modificar: `src/lib/hooks/use-invitations.ts`
- Modificar: `src/app/(creador)/admin/accesos/page.tsx`
- Modificar: `src/lib/store.ts` (retirar `crearInvitaciones`, `invitaciones`, `proximoInviteId`, `INVITACION_DEMO`)
- Crear: `src/lib/supabase/invitaciones.ts`
- Crear: `tests/rls/invitaciones-admin.test.ts`

**Interfaces:**
- Produce: `crearInvitaciones(supabase, comunidadId, emails, cursoIds): Promise<InvitacionCreada[]>`
  con `InvitacionCreada = { id: string; token: string; email: string }`
- Produce: `listarInvitaciones(supabase, comunidadId): Promise<Invitation[]>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/invitaciones-admin.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { crearInvitaciones, listarInvitaciones } from "../../src/lib/supabase/invitaciones";

let e: Escenario;
beforeAll(async () => { e = await montarEscenario("invadmin"); });
afterAll(async () => { await desmontar(e); });

test("el dueno crea invitaciones con cursos concretos", async () => {
  const creadas = await crearInvitaciones(
    e.duenoA.cliente, e.comunidadA, ["nuevo1@prueba.klaze"], [e.cursoAPublicado]
  );
  expect(creadas.length).toBe(1);
  expect(creadas[0].token.length).toBeGreaterThanOrEqual(40);

  const lista = await listarInvitaciones(e.duenoA.cliente, e.comunidadA);
  expect(lista.map((i) => i.email)).toContain("nuevo1@prueba.klaze");
});

test("un alumno no puede crear invitaciones", async () => {
  await expect(
    crearInvitaciones(e.alumnoA.cliente, e.comunidadA, ["colado@prueba.klaze"], "todos")
  ).rejects.toThrow();
});

test("el dueno de B no ve las invitaciones de A", async () => {
  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["solo-a@prueba.klaze"], "todos");
  const listaB = await listarInvitaciones(e.duenoB.cliente, e.comunidadB);
  expect(listaB.map((i) => i.email)).not.toContain("solo-a@prueba.klaze");
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `src/lib/supabase/invitaciones.ts`.

- [ ] **Paso 3: Escribir el acceso a datos**

Crear `src/lib/supabase/invitaciones.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invitation } from "@/lib/types";

export interface InvitacionCreada {
  id: string;
  token: string;
  email: string;
}

/**
 * Crea una invitación por correo. El token lo genera la base
 * (`encode(gen_random_bytes(32),'hex')`), no el cliente: es el secreto que
 * protege la pantalla de invitación y no debe depender de quién la pida.
 *
 * `cursoIds` acepta la lista concreta o `"todos"`, igual que el modelo
 * anterior, para no cambiar la interfaz de la pantalla de admin.
 */
export async function crearInvitaciones(
  supabase: SupabaseClient,
  comunidadId: string,
  emails: string[],
  cursoIds: string[] | "todos"
): Promise<InvitacionCreada[]> {
  const todos = cursoIds === "todos";

  const { data, error } = await supabase
    .from("invitaciones")
    .insert(
      emails.map((email) => ({
        email: email.trim().toLowerCase(),
        comunidad_id: comunidadId,
        todos_los_cursos: todos,
      }))
    )
    .select("id, token, email");

  if (error) throw new Error(`No se pudo crear la invitación: ${error.message}`);

  if (!todos && cursoIds.length > 0) {
    const filas = data.flatMap((inv) =>
      cursoIds.map((curso_id) => ({ invitacion_id: inv.id, curso_id }))
    );
    const { error: errCursos } = await supabase.from("invitacion_cursos").insert(filas);
    if (errCursos) {
      throw new Error(`No se pudieron asignar los cursos: ${errCursos.message}`);
    }
  }

  return data as InvitacionCreada[];
}

export async function listarInvitaciones(
  supabase: SupabaseClient,
  comunidadId: string
): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitaciones")
    .select("token, email, comunidad_id, todos_los_cursos, estado, creada_el, invitacion_cursos(curso_id)")
    .eq("comunidad_id", comunidadId)
    .order("creada_el", { ascending: false });

  if (error) throw new Error(`No se pudieron leer las invitaciones: ${error.message}`);

  return (data ?? []).map((f) => ({
    token: f.token,
    email: f.email,
    comunidadId: f.comunidad_id,
    cursoIds: f.todos_los_cursos
      ? ("todos" as const)
      : (f.invitacion_cursos ?? []).map((c: { curso_id: string }) => c.curso_id),
    estado: f.estado as Invitation["estado"],
    creadaEl: f.creada_el,
  }));
}
```

- [ ] **Paso 4: Migrar el hook**

Reescribir `src/lib/hooks/use-invitations.ts`. `crear` pasa a ser asíncrono —
escribir en un servidor no es instantáneo y fingir que sí produce interfaces que
mienten:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { crearInvitaciones, listarInvitaciones } from "@/lib/supabase/invitaciones";
import type { Invitation } from "@/lib/types";

export interface UseInvitationsResult {
  invitaciones: Invitation[];
  cargando: boolean;
  crear: (emails: string[], cursoIds: string[] | "todos") => Promise<void>;
}

export function useInvitations(comunidadId: string): UseInvitationsResult {
  const [invitaciones, setInvitaciones] = useState<Invitation[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    if (!comunidadId) {
      setInvitaciones([]);
      setCargando(false);
      return;
    }
    const lista = await listarInvitaciones(crearClienteNavegador(), comunidadId);
    setInvitaciones(lista);
    setCargando(false);
  }, [comunidadId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const crear = useCallback(
    async (emails: string[], cursoIds: string[] | "todos") => {
      await crearInvitaciones(crearClienteNavegador(), comunidadId, emails, cursoIds);
      await recargar();
    },
    [comunidadId, recargar]
  );

  return { invitaciones, cargando, crear };
}
```

- [ ] **Paso 5: Adaptar la pantalla**

En `src/app/(creador)/admin/accesos/page.tsx`, el manejador que llama a `crear`
pasa a `async` y espera. Localizarlo con:

```bash
grep -n "crear(" "src/app/(creador)/admin/accesos/page.tsx"
```

La función que lo envuelve se marca `async` y la llamada se antepone con
`await`, dentro de un `try/catch` que muestre `toast.error(e.message)`.

- [ ] **Paso 6: Retirar del store**

Quitar de `src/lib/store.ts`: el campo `invitaciones`, `proximoInviteId`, la
acción `crearInvitaciones` y la constante `INVITACION_DEMO`. Comprobar que no
queda nada:

```bash
grep -rn "proximoInviteId\|INVITACION_DEMO\|s.invitaciones" src
```

`aceptarInvitacion` se retira en la Tarea 3, no aquí: la pantalla de invitación
todavía la usa.

- [ ] **Paso 7: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(invitaciones): crear y listar invitaciones en Postgres"
```

---

### Tarea 2: Enviar la invitación por correo

**Archivos:**
- Crear: `src/app/api/invitaciones/route.ts`
- Modificar: `.env.example`
- Crear: `tests/rls/api-invitaciones.test.ts`

**Interfaces:**
- Consume: `crearInvitaciones` de la Tarea 1.
- Produce: `POST /api/invitaciones` con cuerpo
  `{ comunidadId, email, token }` → `{ ok: true, enlace: string }`

- [ ] **Paso 1: Añadir las variables a `.env.example`**

```
# Servidor únicamente. NUNCA con prefijo NEXT_PUBLIC_.
SUPABASE_SECRET_KEY=
RESEND_API_KEY=
RESEND_FROM="Mentoría V7.0 <acceso@pr.comunidaddelintercambio.com>"
```

Y las mismas tres en `.env.local` con sus valores reales.

- [ ] **Paso 2: Escribir la prueba que falla**

Crear `tests/rls/api-invitaciones.test.ts`. Necesita el servidor levantado
(`bun run dev`), así que la prueba lo comprueba y avisa en vez de fallar de
forma críptica:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { crearInvitaciones } from "../../src/lib/supabase/invitaciones";

const BASE = "http://localhost:3000";
let e: Escenario;
let hayServidor = false;

beforeAll(async () => {
  hayServidor = await fetch(`${BASE}/login`).then(() => true).catch(() => false);
  if (!hayServidor) return;
  e = await montarEscenario("apiinv");
});
afterAll(async () => {
  if (hayServidor) await desmontar(e);
});

async function sesionDe(cliente: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } }) {
  const { data } = await cliente.auth.getSession();
  return data.session!.access_token;
}

test("rechaza a quien no es dueno de esa comunidad", async () => {
  if (!hayServidor) { console.log("SALTADA: arranca `bun run dev`"); return; }

  const [inv] = await crearInvitaciones(
    e.duenoA.cliente, e.comunidadA, ["victima@prueba.klaze"], "todos"
  );

  // El alumno de A pide que se envie una invitacion de la comunidad A.
  const r = await fetch(`${BASE}/api/invitaciones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await sesionDe(e.alumnoA.cliente)}`,
    },
    body: JSON.stringify({
      comunidadId: e.comunidadA, email: "victima@prueba.klaze", token: inv.token,
    }),
  });

  expect(r.status).toBe(403);
});

test("sin sesion, rechaza", async () => {
  if (!hayServidor) { console.log("SALTADA: arranca `bun run dev`"); return; }

  const r = await fetch(`${BASE}/api/invitaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comunidadId: e.comunidadA, email: "x@prueba.klaze", token: "x" }),
  });

  expect(r.status).toBe(401);
});
```

- [ ] **Paso 3: Ejecutar y ver que falla**

En una terminal: `bun run dev`. En otra: `bun run test:rls`
Esperado: FALLA con 404 — la ruta no existe.

- [ ] **Paso 4: Escribir el Route Handler**

Crear `src/app/api/invitaciones/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Genera el enlace de acceso de una invitación y lo manda por correo.
 *
 * Es el ÚNICO código de servidor del proyecto, y existe porque hacen falta dos
 * cosas que el navegador no puede: la clave secreta de Supabase para crear la
 * cuenta del invitado, y la de Resend para enviar.
 *
 * OJO — aquí RLS NO protege nada: la clave secreta se salta todas las
 * políticas. El permiso hay que comprobarlo a mano, y es exactamente el tipo de
 * sitio donde se olvida. Por eso lo primero que hace es verificar que quien
 * llama es el dueño de esa comunidad.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM;

  if (!url || !secreta || !resendKey || !remitente) {
    return NextResponse.json(
      { error: "Faltan variables de servidor (SUPABASE_SECRET_KEY, RESEND_API_KEY, RESEND_FROM)" },
      { status: 500 }
    );
  }

  const cabecera = request.headers.get("authorization");
  const jwt = cabecera?.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!jwt) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const admin = createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: quien, error: errorQuien } = await admin.auth.getUser(jwt);
  if (errorQuien || !quien.user) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  const { comunidadId, email, token } = (await request.json()) as {
    comunidadId?: string;
    email?: string;
    token?: string;
  };
  if (!comunidadId || !email || !token) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // La comprobación que RLS no hace por nosotros.
  const { data: comunidad } = await admin
    .from("comunidades")
    .select("nombre, propietario_id")
    .eq("id", comunidadId)
    .single();

  if (!comunidad || comunidad.propietario_id !== quien.user.id) {
    return NextResponse.json({ error: "No es tu academia" }, { status: 403 });
  }

  const origen = new URL(request.url).origin;
  const destino = `${origen}/invitacion/${token}`;

  // `invite` crea la cuenta si no existe; si ya existe, se cae a `magiclink`,
  // que no la crea. Las dos aterrizan en la misma pantalla con sesión.
  let enlace: string | null = null;
  for (const tipo of ["invite", "magiclink"] as const) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: tipo,
      email,
      options: { redirectTo: destino },
    });
    if (!error && data?.properties?.action_link) {
      enlace = data.properties.action_link;
      break;
    }
  }

  if (!enlace) {
    return NextResponse.json(
      { error: "No se pudo generar el enlace de acceso" },
      { status: 500 }
    );
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remitente,
      to: [email],
      subject: `Tu acceso a ${comunidad.nombre}`,
      html: `
        <p>Te han dado acceso a <strong>${comunidad.nombre}</strong>.</p>
        <p><a href="${enlace}">Entrar a la academia</a></p>
        <p style="color:#666;font-size:13px">
          El enlace caduca en 24 horas. Si caducó, pide uno nuevo a quien te invitó.
        </p>`,
    }),
  });

  if (!respuesta.ok) {
    // La invitación NO se borra: sin ella, quien invita se queda sin forma de
    // recuperar al alumno. Se devuelve el enlace para poder copiarlo a mano.
    return NextResponse.json(
      { ok: false, enlace, error: "La invitación se creó, pero el correo no salió." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, enlace });
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Con `bun run dev` corriendo: `bun run test:rls`
Esperado: las dos pruebas PASAN (403 y 401).

- [ ] **Paso 6: Conectar la pantalla**

En `accesos/page.tsx`, tras crear las invitaciones, llamar a la ruta por cada
una y guardar el enlace devuelto para el botón de copiar:

```ts
const supabase = crearClienteNavegador();
const { data: sesion } = await supabase.auth.getSession();

for (const inv of creadas) {
  const r = await fetch("/api/invitaciones", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sesion.session?.access_token}`,
    },
    body: JSON.stringify({ comunidadId: community.id, email: inv.email, token: inv.token }),
  });
  const cuerpo = await r.json();
  if (!r.ok) toast.error(cuerpo.error ?? "No se pudo enviar el correo");
  enlacesPorEmail.set(inv.email, cuerpo.enlace);
}
```

Mostrar junto a cada invitación un botón **Copiar enlace** que use
`navigator.clipboard.writeText(enlace)`. Es el mismo enlace del correo: existe
porque los correos se pierden y se marcan como spam.

- [ ] **Paso 7: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(invitaciones): enviar por Resend y copiar enlace"
```

---

### Tarea 3: Aceptación robusta

Cierra el agujero de las cuentas que ya existen.

**Archivos:**
- Crear: `supabase/migrations/<ts>_aceptar_mis_invitaciones.sql`
- Modificar: `src/lib/supabase/consultas.ts`
- Reescribir: `src/app/(auth)/invitacion/[token]/_invitation-screen.tsx`
- Modificar: `src/lib/hooks/use-invitation.ts`
- Modificar: `src/lib/store.ts` (retirar `aceptarInvitacion`, `usuariosCreados`, `enrollmentsExtra`)
- Crear: `tests/rls/aceptar-invitacion.test.ts`

**Interfaces:**
- Produce: función SQL `public.aceptar_mis_invitaciones()` → `integer`
  (cuántas inscripciones creó o reactivó).

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/aceptar-invitacion.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin, comoUsuario, limpiarUsuarios } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { crearInvitaciones } from "../../src/lib/supabase/invitaciones";

let e: Escenario;
const extra: string[] = [];
beforeAll(async () => { e = await montarEscenario("aceptar"); });
afterAll(async () => { await limpiarUsuarios(extra); await desmontar(e); });

test("invitar a alguien que YA tiene cuenta tambien le da acceso", async () => {
  // Este es el caso que el trigger no cubre: no se crea ninguna cuenta nueva,
  // asi que `z_aceptar_invitaciones` no salta.
  const ya = await comoUsuario("ya-existia@prueba.klaze");
  extra.push(ya.id);

  await crearInvitaciones(
    e.duenoA.cliente, e.comunidadA, ["ya-existia@prueba.klaze"], [e.cursoAPublicado]
  );

  const { data: cuantas } = await ya.cliente.rpc("aceptar_mis_invitaciones");
  expect(cuantas).toBe(1);

  const { data: cursos } = await ya.cliente.from("cursos").select("id");
  expect((cursos ?? []).map((c) => c.id)).toContain(e.cursoAPublicado);
});

test("llamarla dos veces no duplica inscripciones", async () => {
  const ya = await comoUsuario("doble@prueba.klaze");
  extra.push(ya.id);

  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["doble@prueba.klaze"], "todos");
  await ya.cliente.rpc("aceptar_mis_invitaciones");
  await ya.cliente.rpc("aceptar_mis_invitaciones");

  const { data } = await admin
    .from("inscripciones").select("id").eq("usuario_id", ya.id);
  expect(data?.length).toBe(1);
});

test("no puede aceptar invitaciones de otro correo", async () => {
  await crearInvitaciones(e.duenoA.cliente, e.comunidadA, ["ajeno@prueba.klaze"], "todos");

  const { data: cuantas } = await e.alumnoB.cliente.rpc("aceptar_mis_invitaciones");
  expect(cuantas).toBe(0);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe la función `aceptar_mis_invitaciones`.

- [ ] **Paso 3: Crear la migración**

```bash
supabase migration new aceptar_mis_invitaciones
```

```sql
-- Convierte en inscripciones las invitaciones pendientes del correo de quien
-- llama. Devuelve cuantas creo o reactivo.
--
-- Existe porque `z_aceptar_invitaciones` corre AL CREARSE una cuenta, y hay un
-- caso donde no se crea ninguna: invitar a alguien que ya la tiene (porque
-- estudia en otra academia, o porque se le invito antes). Ahi el trigger no
-- salta, la persona entra y no ve nada — sin error y sin pista.
--
-- Se llama en cada inicio de sesion. Es idempotente, asi que llamarla de mas
-- no cuesta nada. El trigger se queda: es mas rapido. Esta lo respalda: es mas
-- completa.
create function public.aceptar_mis_invitaciones() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  mi_email text;
  inv record;
  nueva_inscripcion uuid;
  total integer := 0;
begin
  select email into mi_email from auth.users where id = auth.uid();
  if mi_email is null then return 0; end if;

  for inv in
    select * from public.invitaciones
    where lower(email) = lower(mi_email) and estado = 'pendiente'
  loop
    insert into public.inscripciones
      (usuario_id, comunidad_id, estado, todos_los_cursos)
    values (auth.uid(), inv.comunidad_id, 'activo', inv.todos_los_cursos)
    on conflict (usuario_id, comunidad_id)
      do update set estado = 'activo',
                    todos_los_cursos = excluded.todos_los_cursos
    returning id into nueva_inscripcion;

    insert into public.inscripcion_cursos (inscripcion_id, curso_id)
    select nueva_inscripcion, ic.curso_id
    from public.invitacion_cursos ic
    where ic.invitacion_id = inv.id
    on conflict do nothing;

    update public.invitaciones set estado = 'aceptada' where id = inv.id;
    total := total + 1;
  end loop;

  return total;
end;
$$;

grant execute on function public.aceptar_mis_invitaciones() to authenticated;
```

- [ ] **Paso 4: Aplicar y ejecutar**

```bash
bun run db:push
bun run test:rls
```
Esperado: las tres pruebas PASAN.

- [ ] **Paso 5: Llamarla en cada inicio de sesión**

En `src/lib/supabase/consultas.ts`, dentro de `cargarArmazon`, justo después de
obtener el usuario y **antes** de leer comunidad y cursos:

```ts
  // Antes de leer nada: si hay invitaciones pendientes para este correo, se
  // convierten en acceso ahora. Si no las hay, no hace nada y no cuesta nada.
  // Va aquí y no en el login para cubrir también a quien ya tenía sesión
  // abierta cuando lo invitaron.
  await supabase.rpc("aceptar_mis_invitaciones");
```

- [ ] **Paso 6: Reescribir la pantalla de invitación**

`_invitation-screen.tsx` deja de pedir nombre y contraseña: cuando se llega ahí
desde el enlace del correo, la sesión **ya existe** y el acceso también. Pasa a
ser una bienvenida.

Sigue usando `useInvitation(token)`, que lee con `invitacion_publica`. Cambios:

- Quitar el formulario, el estado `nombre`/`password` y la llamada a
  `aceptarInvitacion`.
- Botón único: **Entrar a la academia** → `router.replace(\`/c/${comunidad.slug}/cursos\`)`.
- Si `useInvitation` devuelve `null` (token inexistente o ya aceptado), mostrar
  el mensaje que ya existe para ese caso, sin distinguir cuál de los dos es.

- [ ] **Paso 7: Migrar `use-invitation.ts`**

Pasa de leer del store a llamar a la función pública:

```ts
const { data } = await crearClienteNavegador()
  .rpc("invitacion_publica", { p_token: token });
```

Devuelve `{ email, comunidad_nombre, comunidad_logo, comunidad_color, todos_los_cursos, cursos }`.
Adaptar `UseInvitationResult` a esa forma; ya no hay `Community` completa
porque la función solo devuelve la marca — que es todo lo que la pantalla pinta.

- [ ] **Paso 8: Retirar del store**

Quitar `aceptarInvitacion`, `usuariosCreados` y `enrollmentsExtra`. Comprobar:

```bash
grep -rn "aceptarInvitacion\|usuariosCreados\|enrollmentsExtra" src
```

- [ ] **Paso 9: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(invitaciones): aceptacion robusta para cuentas ya existentes"
```

---

### Tarea 4: Alumnos — listar y suspender

**Archivos:**
- Crear: `src/lib/supabase/alumnos.ts`
- Modificar: `src/lib/hooks/use-members.ts`, `src/lib/hooks/use-users.ts`
- Modificar: `src/app/(creador)/admin/alumnos/page.tsx`
- Modificar: `src/lib/store.ts` (retirar `cambiarEstadoAlumno`, `estadoOverrides`)
- Crear: `tests/rls/alumnos.test.ts`

**Interfaces:**
- Produce: `listarAlumnos(supabase, comunidadId): Promise<AlumnoEnComunidad[]>`
  con `AlumnoEnComunidad = { usuarioId, nombre, avatarUrl, puntos, estado, todosLosCursos, cursoIds }`
- Produce: `cambiarEstadoAlumno(supabase, usuarioId, comunidadId, estado): Promise<void>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/alumnos.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { listarAlumnos, cambiarEstadoAlumno } from "../../src/lib/supabase/alumnos";

let e: Escenario;
beforeAll(async () => { e = await montarEscenario("alumnos"); });
afterAll(async () => { await desmontar(e); });

test("el dueno ve a sus alumnos y no a los de otra empresa", async () => {
  const lista = await listarAlumnos(e.duenoA.cliente, e.comunidadA);
  const ids = lista.map((a) => a.usuarioId);
  expect(ids).toContain(e.alumnoA.id);
  expect(ids).not.toContain(e.alumnoB.id);
});

test("suspender corta el acceso a las lecciones, no solo el estado", async () => {
  await cambiarEstadoAlumno(e.duenoA.cliente, e.alumnoA.id, e.comunidadA, "suspendido");

  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  expect(data ?? []).toEqual([]);

  await cambiarEstadoAlumno(e.duenoA.cliente, e.alumnoA.id, e.comunidadA, "activo");
  const { data: tras } = await e.alumnoA.cliente.from("cursos").select("id");
  expect((tras ?? []).length).toBeGreaterThan(0);
});

test("el dueno de B no puede suspender a un alumno de A", async () => {
  await cambiarEstadoAlumno(e.duenoB.cliente, e.alumnoA.id, e.comunidadA, "suspendido");

  // RLS no lanza: filtra. La escritura no afecta a ninguna fila, y el alumno
  // de A sigue entrando. Comprobarlo por el efecto, no por el error.
  const { data } = await e.alumnoA.cliente.from("cursos").select("id");
  expect((data ?? []).length).toBeGreaterThan(0);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `src/lib/supabase/alumnos.ts`.

- [ ] **Paso 3: Escribir el acceso a datos**

Crear `src/lib/supabase/alumnos.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AlumnoEnComunidad {
  usuarioId: string;
  nombre: string;
  avatarUrl: string;
  puntos: number;
  estado: "invitado" | "activo" | "suspendido";
  todosLosCursos: boolean;
  cursoIds: string[];
}

export async function listarAlumnos(
  supabase: SupabaseClient,
  comunidadId: string
): Promise<AlumnoEnComunidad[]> {
  const { data, error } = await supabase
    .from("inscripciones")
    .select(
      "usuario_id, estado, todos_los_cursos, perfiles(nombre, avatar_url, puntos), inscripcion_cursos(curso_id)"
    )
    .eq("comunidad_id", comunidadId);

  if (error) throw new Error(`No se pudieron leer los alumnos: ${error.message}`);

  return (data ?? []).map((f) => ({
    usuarioId: f.usuario_id,
    nombre: f.perfiles?.nombre ?? "",
    avatarUrl: f.perfiles?.avatar_url ?? "",
    puntos: f.perfiles?.puntos ?? 0,
    estado: f.estado,
    todosLosCursos: f.todos_los_cursos,
    cursoIds: (f.inscripcion_cursos ?? []).map((c: { curso_id: string }) => c.curso_id),
  }));
}

/**
 * Suspender aquí no es cosmético: `privado.pertenece_a` exige inscripción
 * ACTIVA, así que esta escritura corta el acceso a los cursos y las lecciones
 * en la propia base. Ninguna pantalla tiene que acordarse de comprobarlo.
 *
 * No borra el progreso: al reactivar, el alumno vuelve donde lo dejó.
 */
export async function cambiarEstadoAlumno(
  supabase: SupabaseClient,
  usuarioId: string,
  comunidadId: string,
  estado: AlumnoEnComunidad["estado"]
): Promise<void> {
  const { error } = await supabase
    .from("inscripciones")
    .update({ estado })
    .eq("usuario_id", usuarioId)
    .eq("comunidad_id", comunidadId);

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
}
```

- [ ] **Paso 4: Migrar los hooks y la pantalla**

`useMembers(comunidadId, cursoId?)` conserva su forma de retorno
`{ miembros: MemberConEstado[] }` pero se alimenta de `listarAlumnos`. El
progreso por alumno se calcula igual que hoy, sobre los cursos del armazón.

En `alumnos/page.tsx`, el manejador de suspender/reactivar pasa a `async`,
llama a `cambiarEstadoAlumno` y recarga la lista.

**`useUsuarios` necesita atención aparte.** Devuelve
`{ resolver: (userId: string) => User }` y hoy se alimenta de
`usuariosCreados`, que la Tarea 3 retira. Su único consumidor real es
`src/components/community/comment-thread.tsx` — una pantalla de la **rebanada
3**, donde todavía no hay comentarios que resolver.

No se migra a fondo aquí: se le cambia la fuente para que no quede roto.
`resolver` pasa a buscar entre los alumnos de la comunidad actual (que la
Tarea 4 ya trae) y el perfil propio del armazón, con un respaldo explícito
para quien no encuentre:

```ts
const DESCONOCIDO: User = {
  id: "", email: "", nombre: "Usuario", avatarUrl: "", bio: "",
  rol: "alumno", comunidadIds: [], puntos: 0, nivel: 1, creadoEl: "",
};
```

Devolver un marcador visible en vez de `undefined` evita que el hilo de
comentarios reviente cuando llegue la rebanada 3 con autores que aún no estén
en la lista cargada.

- [ ] **Paso 5: Retirar del store**

```bash
grep -rn "cambiarEstadoAlumno\|estadoOverrides\|resolverEstadoEnrollment" src
```

Quitar los tres. `resolverEstadoEnrollment` deja de tener sentido: el estado ya
no es un override sobre un mock, es una columna.

- [ ] **Paso 6: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(alumnos): listar y suspender desde la base"
```

---

### Tarea 5: Progreso en la base

**Archivos:**
- Crear: `src/lib/supabase/progreso.ts`
- Modificar: `src/lib/supabase/consultas.ts` (incluir progreso en el armazón)
- Modificar: `src/lib/hooks/use-courses.ts` (`useLesson`)
- Modificar: `src/lib/store.ts` (retirar `progreso`, `toggleLeccionCompleta`)
- Crear: `tests/rls/progreso.test.ts`

**Interfaces:**
- Produce: `marcarLeccion(supabase, leccionId, completada): Promise<void>`
- Produce: `Armazon` gana `progreso: string[]` (ids de lecciones completadas).

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/progreso.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { marcarLeccion } from "../../src/lib/supabase/progreso";
import { cargarArmazon } from "../../src/lib/supabase/consultas";

let e: Escenario;
let leccionId: string;

beforeAll(async () => {
  e = await montarEscenario("progreso");
  const { data: mod } = await admin.from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "M", orden: 1 })
    .select("id").single();
  const { data: lec } = await admin.from("lecciones")
    .insert({ modulo_id: mod!.id, titulo: "L", orden: 1, tipo: "texto" })
    .select("id").single();
  leccionId = lec!.id;
});
afterAll(async () => { await desmontar(e); });

test("marcar una leccion se guarda y se relee", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.progreso).toContain(leccionId);
});

test("desmarcar la quita", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);
  await marcarLeccion(e.alumnoA.cliente, leccionId, false);

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.progreso).not.toContain(leccionId);
});

test("el progreso de un alumno no lo ve otro", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  const armazonB = await cargarArmazon(e.alumnoB.cliente);
  expect(armazonB.progreso).not.toContain(leccionId);
});

test("suspender no borra el progreso", async () => {
  await marcarLeccion(e.alumnoA.cliente, leccionId, true);

  await admin.from("inscripciones")
    .update({ estado: "suspendido" }).eq("usuario_id", e.alumnoA.id);
  await admin.from("inscripciones")
    .update({ estado: "activo" }).eq("usuario_id", e.alumnoA.id);

  const armazon = await cargarArmazon(e.alumnoA.cliente);
  expect(armazon.progreso).toContain(leccionId);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `src/lib/supabase/progreso.ts`.

- [ ] **Paso 3: Escribir el acceso a datos**

Crear `src/lib/supabase/progreso.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Marca o desmarca una lección para el usuario de la sesión.
 *
 * El `usuario_id` no se pasa como parámetro a propósito: sale de la sesión, y
 * la política de `progreso` exige que coincida con `auth.uid()`. Así no existe
 * ninguna forma de escribir progreso a nombre de otro, ni por error.
 */
export async function marcarLeccion(
  supabase: SupabaseClient,
  leccionId: string,
  completada: boolean
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const usuarioId = sesion.user?.id;
  if (!usuarioId) throw new Error("marcarLeccion requiere sesión activa");

  const { error } = completada
    ? await supabase
        .from("progreso")
        .upsert({ usuario_id: usuarioId, leccion_id: leccionId })
    : await supabase
        .from("progreso")
        .delete()
        .eq("usuario_id", usuarioId)
        .eq("leccion_id", leccionId);

  if (error) throw new Error(`No se pudo guardar el progreso: ${error.message}`);
}
```

- [ ] **Paso 4: Incluir el progreso en el armazón**

En `consultas.ts`, añadir a la interfaz y a la consulta:

```ts
export interface Armazon {
  perfil: User;
  comunidad: Community | null;
  cursos: Course[];
  /** Ids de las lecciones completadas por esta persona. */
  progreso: string[];
}
```

```ts
  const { data: progresoFilas } = await supabase.from("progreso").select("leccion_id");
  const progreso = (progresoFilas ?? []).map((p) => p.leccion_id as string);
```

Y devolverlo en el objeto. RLS ya limita las filas a las propias.

- [ ] **Paso 5: Migrar `useLesson` y retirar del store**

`useLesson` lee `armazon.progreso` en vez de `s.progreso`, y su `toggle` pasa a
asíncrono: llama a `marcarLeccion` y luego refresca el armazón.

Retirar del store `progreso` y `toggleLeccionCompleta`. Comprobar:

```bash
grep -rn "toggleLeccionCompleta\|s.progreso" src
```

`useCourses` y `useMembers` calculan porcentajes sobre `armazon.progreso`.

- [ ] **Paso 6: Verificar y commitear**

```bash
bun run build && bun run lint && bun run test:rls
git add -A
git commit -m "feat(progreso): guardar el avance de lecciones en la base"
```

---

### Tarea 6: Comprobación de extremo a extremo

Ninguna prueba automática sustituye a invitar a una persona real.

- [ ] **Paso 1: Invitar a un correo tuyo alternativo**

Con `bun run dev`: entrar como dueño, ir a `/admin/accesos`, invitar a un correo
distinto del de la cuenta, eligiendo **un solo curso**.

- [ ] **Paso 2: Comprobar que llega**

El correo debe llegar desde `acceso@pr.comunidaddelintercambio.com`. Si cae en
spam, anotarlo: es reputación del dominio, no del código.

- [ ] **Paso 3: Entrar desde otro navegador**

Abrir el enlace en una ventana privada. Debe aterrizar en la bienvenida y, al
entrar, mostrar **solo el curso asignado**.

- [ ] **Paso 4: Marcar una lección y cambiar de dispositivo**

Marcarla como vista, abrir el móvil con el mismo enlace y comprobar que sigue
marcada. Es lo que hoy es imposible.

- [ ] **Paso 5: Suspender y comprobar**

Desde `/admin/alumnos`, suspender. Recargar la ventana del alumno: los cursos
deben desaparecer. Reactivar: vuelven, **y la lección sigue marcada**.

- [ ] **Paso 6: Commit final**

```bash
git add -A
git commit -m "docs: rebanada 2 verificada de extremo a extremo"
```

---

## Autorrevisión frente a la spec

| Sección de la spec | Tarea |
|---|---|
| §1 Criterio de terminación (6 pasos) | 6 los recorre todos |
| §3 Un correo, un clic | 2 (generateLink + envío), 3 (pantalla) |
| §3 Botón copiar enlace | 2, paso 6 |
| §3 Agujero de cuentas existentes | 3 (`aceptar_mis_invitaciones`) |
| §4 Route Handler, comprobación de dueño | 2 (prueba de 403 incluida) |
| §4 Remitente configurable | 2, paso 1 |
| §4 Si el envío falla, la invitación se queda | 2, paso 4 (502 con enlace) |
| §5 Migración de las 4 acciones del store | 1, 3, 4, 5 |
| §5 Suspender no borra progreso | 5 (prueba explícita) |
| §6 Pruebas 1-8 | 3 (1,2,3), 4 (4,7), 5 (5,6), 2 (8) |

**Hueco detectado y cerrado:** la prueba 7 de la spec ("un alumno no puede crear
invitaciones en su propia comunidad") no tenía tarea propia. Está cubierta en la
Tarea 1, segunda prueba.

**Nota sobre la prueba 4 de la spec** ("suspender revoca el acceso a las
lecciones"): la Tarea 4 la comprueba sobre `cursos`. Añadir en esa misma prueba
una lectura de `lecciones` tras suspender, que debe volver vacía — cursos y
lecciones tienen políticas distintas y podrían divergir.
