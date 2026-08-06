# Rebanada 1 — Academia y cursos de punta a punta: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan
> casillas (`- [ ]`).

**Objetivo:** que el dueño cree su academia, entre con un enlace por correo,
cargue su curso con los vídeos de Vimeo y lo vea desde el área de alumno — todo
guardado en Postgres.

**Arquitectura:** los datos del armazón (perfil, comunidad, cursos con módulos y
lecciones) se cargan de una vez al iniciar sesión y viven en el store de Zustand.
Los 20 hooks conservan su firma síncrona, así que los 75 componentes cliente no
se tocan. Las escrituras van directas a Supabase con la clave publicable, y RLS
decide qué se permite.

**Stack:** Supabase (Postgres 17), `@supabase/supabase-js`, Zustand, Resend
(SMTP de Supabase Auth), `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-06-rebanada-1-cursos-design.md`

## Restricciones globales

- **No hay Docker.** Migraciones al proyecto alojado con `bun run db:push`.
- **Proyecto:** ref `rwqfktltjuztmgggzlqt`.
- **Nunca `NEXT_PUBLIC_` para secretos.** `SUPABASE_SECRET_KEY` y
  `RESEND_API_KEY` solo en `.env.local` (ignorado por git) y en scripts.
- **Selectores de Zustand:** nada de `.filter()`/`.map()` ni objetos nuevos
  dentro del selector — crashea el invariante de `useSyncExternalStore` en React
  19. Seleccionar crudo y derivar con `useMemo` en el hook.
- **Todo layout de grupo gatea en `!hydrated`** antes de decidir un redirect.
- **Copy en español.**
- **Verificación antes de cada commit:** `bun run build`, `bun run lint` y
  `bun run test:rls` limpios.

### Corrección a la spec, aplicada aquí

La spec dice que `useSession()` conserva su firma. Es cierto para `user` y
`logout`, **no para `login`**: hoy es `login(email: string) => boolean`,
síncrono, porque valida contra un array en memoria. Un enlace por correo no
inicia sesión — la envía. Pasa a:

```ts
enviarEnlace: (email: string) => Promise<{ ok: boolean; error?: string }>
```

Único consumidor: `src/app/(auth)/login/page.tsx`.

### Prerrequisitos humanos (bloquean la Tarea 1)

1. **Configurar Resend como emisor en Supabase.** Panel → Authentication →
   Emails → SMTP Settings → *Enable Custom SMTP*:
   - Host `smtp.resend.com`, Puerto `465`, Usuario `resend`
   - Contraseña: la clave de Resend (`re_...`)
   - Sender email: `onboarding@resend.dev`, Sender name: `Klaze`
2. **Saber a qué correo va todo.** Sin dominio verificado, Resend **solo envía
   al correo de la cuenta de Resend**. La academia de la Tarea 1 debe crearse
   con ESE correo o no llegará el enlace.

---

### Tarea 1: Alta de la academia

**Archivos:**
- Crear: `scripts/crear-academia.ts`
- Crear: `tests/rls/academia.test.ts`
- Modificar: `package.json` (script `crear-academia`)

**Interfaces:**
- Produce: `crearAcademia(opciones): Promise<{ comunidadId, usuarioId, yaExistia }>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/academia.test.ts`:

```ts
import { expect, test, afterAll } from "bun:test";
import { admin, limpiarUsuarios } from "./ayudas";
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
    .from("comunidades").select("nombre, propietario_id, plan_id")
    .eq("id", r.comunidadId).single();
  expect(com?.nombre).toBe("ACME Prueba");
  expect(com?.propietario_id).toBe(r.usuarioId);
  expect(com?.plan_id).toBe("pro");

  const { data: perfil } = await admin
    .from("perfiles").select("rol").eq("id", r.usuarioId).single();
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
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `scripts/crear-academia.ts`.

- [ ] **Paso 3: Escribir el script**

Crear `scripts/crear-academia.ts`:

```ts
/**
 * Da de alta una academia: cuenta del dueño, su perfil como creador y la
 * comunidad. Es un comando y no una pantalla porque las pantallas de alta del
 * superadmin son trabajo posterior y aquí solo hace falta arrancar.
 *
 *   bun run crear-academia -- --email jefe@empresa.com --empresa "Mi Empresa" --slug mi-empresa
 */
import { createClient } from "@supabase/supabase-js";

export interface OpcionesAcademia {
  email: string;
  empresa: string;
  slug: string;
}

export interface ResultadoAcademia {
  comunidadId: string;
  usuarioId: string;
  yaExistia: boolean;
}

function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreta) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en `.env.local`."
    );
  }
  return createClient(url, secreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function crearAcademia(
  op: OpcionesAcademia
): Promise<ResultadoAcademia> {
  const supabase = clienteAdmin();

  // Idempotente por slug: repetir el comando no duplica la academia.
  const { data: existente } = await supabase
    .from("comunidades").select("id, propietario_id").eq("slug", op.slug).maybeSingle();
  if (existente) {
    return {
      comunidadId: existente.id,
      usuarioId: existente.propietario_id,
      yaExistia: true,
    };
  }

  // Reutiliza la cuenta si ya existe: puede haberse creado en un intento
  // anterior que fallo al crear la comunidad.
  const { data: lista } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let usuarioId = lista?.users?.find(
    (u) => u.email?.toLowerCase() === op.email.toLowerCase()
  )?.id;

  if (!usuarioId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: op.email,
      email_confirm: true,
    });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    usuarioId = data.user!.id;
  }

  // El trigger `on_auth_user_created` ya creo el perfil; aqui solo el rol.
  const { error: errRol } = await supabase
    .from("perfiles").update({ rol: "creador" }).eq("id", usuarioId);
  if (errRol) throw new Error(`No se pudo marcar el rol: ${errRol.message}`);

  const { data: com, error: errCom } = await supabase
    .from("comunidades")
    .insert({
      slug: op.slug,
      nombre: op.empresa,
      propietario_id: usuarioId,
      plan_id: "pro",
      nombres_niveles: [
        "Novato", "Aprendiz", "Practicante", "Competente", "Avanzado",
        "Experto", "Maestro", "Mentor", "Leyenda",
      ],
    })
    .select("id").single();
  if (errCom) throw new Error(`No se pudo crear la comunidad: ${errCom.message}`);

  return { comunidadId: com.id, usuarioId, yaExistia: false };
}

// Ejecución por linea de comandos.
if (import.meta.main) {
  const args = process.argv.slice(2);
  const valor = (nombre: string) => {
    const i = args.indexOf(`--${nombre}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const email = valor("email");
  const empresa = valor("empresa");
  const slug = valor("slug");

  if (!email || !empresa || !slug) {
    console.error(
      'Uso: bun run crear-academia -- --email jefe@empresa.com --empresa "Mi Empresa" --slug mi-empresa'
    );
    process.exit(1);
  }

  const r = await crearAcademia({ email, empresa, slug });
  if (r.yaExistia) {
    console.log(`La academia "${slug}" ya existía. No se ha tocado nada.`);
  } else {
    console.log(`Academia creada.\n  comunidad: ${r.comunidadId}\n  dueño:     ${r.usuarioId}`);
    console.log(`\nEntra en /login con ${email} y te llegará el enlace de acceso.`);
  }
  process.exit(0);
}
```

- [ ] **Paso 4: Añadir el script a package.json**

```json
"crear-academia": "bun --env-file=.env.local scripts/crear-academia.ts",
```

- [ ] **Paso 5: Ejecutar las pruebas**

Run: `bun run test:rls`
Esperado: las dos pruebas de `academia.test.ts` PASAN.

- [ ] **Paso 6: Commit**

```bash
git add scripts/crear-academia.ts tests/rls/academia.test.ts package.json
git commit -m "feat(academia): comando de alta de academia, idempotente por slug"
```

---

### Tarea 2: Carga del armazón desde Supabase

Una función que trae todo lo que la app necesita para pintarse. Todavía no la
usa nadie: se prueba sola primero.

**Archivos:**
- Crear: `src/lib/supabase/consultas.ts`
- Crear: `tests/rls/armazon.test.ts`

**Interfaces:**
- Produce: `cargarArmazon(supabase): Promise<Armazon>` con
  `Armazon = { perfil: User; comunidad: Community | null; cursos: Course[] }`
  usando los tipos existentes de `src/lib/types.ts`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/armazon.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { cargarArmazon } from "../../src/lib/supabase/consultas";

let e: Escenario;
beforeAll(async () => {
  e = await montarEscenario("armazon");
  const { data: mod } = await admin.from("modulos")
    .insert({ curso_id: e.cursoAPublicado, titulo: "Modulo 1", orden: 1 })
    .select("id").single();
  await admin.from("lecciones").insert({
    modulo_id: mod!.id, titulo: "Leccion 1", orden: 1,
    tipo: "video", vimeo_id: "123456789", duracion_min: 12,
  });
});
afterAll(async () => { await desmontar(e); });

test("el alumno recibe su comunidad y solo sus cursos", async () => {
  const armazon = await cargarArmazon(e.alumnoA.cliente);

  expect(armazon.comunidad?.id).toBe(e.comunidadA);
  const ids = armazon.cursos.map((c) => c.id);
  expect(ids).toContain(e.cursoAPublicado);
  expect(ids).not.toContain(e.cursoB);
  expect(ids).not.toContain(e.cursoABorrador);
});

test("los cursos llegan con sus modulos y lecciones anidados", async () => {
  const armazon = await cargarArmazon(e.alumnoA.cliente);
  const curso = armazon.cursos.find((c) => c.id === e.cursoAPublicado);

  expect(curso?.modulos.length).toBe(1);
  expect(curso?.modulos[0].lecciones[0].titulo).toBe("Leccion 1");
  expect(curso?.modulos[0].lecciones[0].vimeoId).toBe("123456789");
});

test("el dueno recibe tambien sus borradores", async () => {
  const armazon = await cargarArmazon(e.duenoA.cliente);
  const ids = armazon.cursos.map((c) => c.id);
  expect(ids).toContain(e.cursoABorrador);
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `src/lib/supabase/consultas.ts`.

- [ ] **Paso 3: Escribir las consultas**

Crear `src/lib/supabase/consultas.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community, Course, User } from "@/lib/types";

export interface Armazon {
  perfil: User;
  comunidad: Community | null;
  cursos: Course[];
}

/**
 * Trae de una vez todo lo que la app necesita para pintarse: quién eres, tu
 * academia, y sus cursos con módulos y lecciones.
 *
 * Es una sola carga y no una consulta por pantalla porque una academia son
 * decenas de cursos, no miles de filas — y así los 20 hooks conservan su firma
 * síncrona y los 75 componentes cliente no se tocan. El feed, que sí crece sin
 * techo, tendrá carga propia y paginación en la rebanada 3.
 *
 * No filtra por permisos: eso lo hace RLS. Si esta consulta devuelve un curso,
 * es porque la base ha decidido que puedes verlo.
 */
export async function cargarArmazon(supabase: SupabaseClient): Promise<Armazon> {
  const { data: sesion } = await supabase.auth.getUser();
  const usuario = sesion.user;
  if (!usuario) throw new Error("cargarArmazon requiere sesión activa");

  const { data: perfilFila, error: errPerfil } = await supabase
    .from("perfiles")
    .select("id, nombre, avatar_url, bio, rol, puntos, creado_el")
    .eq("id", usuario.id)
    .single();
  if (errPerfil) throw new Error(`No se pudo leer el perfil: ${errPerfil.message}`);

  // Sin `.eq()`: RLS ya deja pasar solo la comunidad que posees o en la que
  // estás inscrito. Filtrar aquí además seria duplicar la regla.
  const { data: comunidades } = await supabase
    .from("comunidades")
    .select(
      "id, slug, nombre, descripcion, logo_url, color_acento, propietario_id, plan_id, estado, nombres_niveles, marca_auth, creado_el"
    )
    .limit(1);
  const c = comunidades?.[0] ?? null;

  const { data: cursosFilas } = await supabase
    .from("cursos")
    .select(
      `id, comunidad_id, slug, titulo, descripcion, portada_url,
       precio_referencial, nivel_requerido, publicado,
       modulos ( id, titulo, orden, portada_url,
         lecciones ( id, titulo, orden, tipo, vimeo_id, duracion_min, contenido, recursos ) )`
    )
    .order("orden", { referencedTable: "modulos" });

  const perfil: User = {
    id: perfilFila.id,
    email: usuario.email ?? "",
    nombre: perfilFila.nombre,
    avatarUrl: perfilFila.avatar_url,
    bio: perfilFila.bio,
    rol: perfilFila.rol,
    comunidadIds: c ? [c.id] : [],
    puntos: perfilFila.puntos,
    nivel: 1,
    creadoEl: perfilFila.creado_el,
  };

  const comunidad: Community | null = c
    ? {
        id: c.id, slug: c.slug, nombre: c.nombre, descripcion: c.descripcion,
        logoUrl: c.logo_url, colorAcento: c.color_acento,
        ownerId: c.propietario_id, plan: c.plan_id, estado: c.estado,
        nombresNiveles: c.nombres_niveles, secciones: [],
        creadoEl: c.creado_el, marcaAuth: c.marca_auth ?? undefined,
      }
    : null;

  const cursos: Course[] = (cursosFilas ?? []).map((f) => ({
    id: f.id, comunidadId: f.comunidad_id, slug: f.slug, titulo: f.titulo,
    descripcion: f.descripcion, portadaUrl: f.portada_url,
    precioReferencial: Number(f.precio_referencial),
    nivelRequerido: f.nivel_requerido, publicado: f.publicado,
    secciones: [],
    modulos: (f.modulos ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((m) => ({
        id: m.id, titulo: m.titulo, orden: m.orden,
        portadaUrl: m.portada_url ?? undefined,
        lecciones: (m.lecciones ?? [])
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((l) => ({
            id: l.id, titulo: l.titulo, orden: l.orden, tipo: l.tipo,
            vimeoId: l.vimeo_id, duracionMin: l.duracion_min,
            contenido: l.contenido, recursos: l.recursos ?? [],
          })),
      })),
  }));

  return { perfil, comunidad, cursos };
}
```

- [ ] **Paso 4: Ejecutar las pruebas**

Run: `bun run test:rls`
Esperado: las tres pruebas de `armazon.test.ts` PASAN.

Si "los cursos llegan con sus modulos" falla con los módulos desordenados,
revisar que el `.order()` lleve `referencedTable: "modulos"`: el orden de una
tabla anidada no se hereda del padre.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/supabase/consultas.ts tests/rls/armazon.test.ts
git commit -m "feat(datos): cargarArmazon trae perfil, comunidad y cursos de Supabase"
```

---

### Tarea 3: Sesión real por enlace de correo

**Archivos:**
- Modificar: `src/lib/store.ts` (estado `armazon`, acciones `establecerArmazon`, `limpiarSesion`; retirar `login`, `logout`, `registrarCreador`, `currentUserId`)
- Modificar: `src/lib/hooks/use-session.ts`
- Modificar: `src/app/(auth)/login/page.tsx`
- Crear: `src/app/(auth)/callback/page.tsx`
- Borrar: `src/app/(auth)/registro/page.tsx`, `src/app/(auth)/recuperar/page.tsx`, `src/components/shared/user-switcher.tsx`

**Interfaces:**
- Consume: `cargarArmazon` de la Tarea 2.
- Produce: `useSession(): { user, enviarEnlace, logout }`, `useHydrated(): boolean`.

- [ ] **Paso 1: Añadir el estado del armazón al store**

En `src/lib/store.ts`, dentro del estado:

```ts
  /**
   * Datos traídos del servidor al iniciar sesión. Reemplaza a los mocks como
   * origen del armazón. `null` = todavía no cargado o sin sesión.
   *
   * NO se persiste en localStorage: son datos del servidor y guardarlos
   * significaría enseñar contenido de una sesión anterior al siguiente que
   * abra ese navegador.
   */
  armazon: Armazon | null;
  establecerArmazon: (armazon: Armazon | null) => void;
```

Implementación:

```ts
  armazon: null,
  establecerArmazon: (armazon) => set({ armazon }),
```

Y en la config de `persist`, excluirlo del `partialize` para que no vaya a
localStorage.

- [ ] **Paso 2: Reescribir `use-session.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { useAppStore } from "@/lib/store";
import type { User } from "@/lib/types";

/**
 * `true` cuando ya sabemos quién eres —o que no eres nadie— y, si hay sesión,
 * tus datos han llegado.
 *
 * Antes significaba "el store leyó de localStorage". Cambia de significado
 * pero no de firma, y por eso los 24 archivos que ya lo consultan (incluidos
 * los 4 layouts de grupo) siguen esperando correctamente sin tocarlos.
 */
export function useHydrated(): boolean {
  const [listo, setListo] = useState(false);
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);

  useEffect(() => {
    let vivo = true;
    const supabase = crearClienteNavegador();

    async function sincronizar() {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;

      if (!data.session) {
        establecerArmazon(null);
        setListo(true);
        return;
      }
      try {
        const armazon = await cargarArmazon(supabase);
        if (vivo) establecerArmazon(armazon);
      } finally {
        if (vivo) setListo(true);
      }
    }

    void sincronizar();

    // Recarga el armazón al entrar o salir: sin esto, tras iniciar sesión la
    // app se quedaría con los datos (vacíos) de antes hasta recargar a mano.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void sincronizar();
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [establecerArmazon]);

  return listo;
}

export interface UseSessionResult {
  user: User | null;
  /**
   * Envía el enlace de acceso. NO inicia sesión — eso ocurre cuando la persona
   * abre el enlace de su correo. Por eso ya no es `login()`.
   */
  enviarEnlace: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export function useSession(): UseSessionResult {
  const armazon = useAppStore((s) => s.armazon);

  const enviarEnlace = useCallback(async (email: string) => {
    const supabase = crearClienteNavegador();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await crearClienteNavegador().auth.signOut();
  }, []);

  return { user: armazon?.perfil ?? null, enviarEnlace, logout };
}
```

- [ ] **Paso 3: Reescribir la pantalla de login**

Reemplazar el cuerpo de `src/app/(auth)/login/page.tsx`. Quitar `CUENTAS_DEMO`
(los tres botones de acceso rápido), el campo de contraseña y el enlace a
`/registro`.

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { MailCheck, Send } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormCard } from "../_components/auth-form-card";

/**
 * Entrada por enlace de correo. No hay contraseña que recordar ni recuperar.
 *
 * Responde lo mismo exista o no la cuenta: si dijera "ese correo no está
 * registrado", el formulario se convertiría en una herramienta para averiguar
 * quién tiene cuenta aquí.
 */
export default function LoginPage() {
  const { enviarEnlace } = useSession();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const r = await enviarEnlace(email.trim());
    setEnviando(false);
    if (r.ok) setEnviado(true);
    else setError("No pudimos enviar el enlace. Inténtalo de nuevo en un momento.");
  }

  if (enviado) {
    return (
      <AuthFormCard titulo="Revisa tu correo" subtitulo={`Si ${email} tiene cuenta, le hemos enviado un enlace para entrar.`}>
        <div className="flex flex-col items-center gap-3 py-4 text-center text-sm text-muted-foreground">
          <MailCheck className="size-10 text-primary" aria-hidden />
          <p>El enlace caduca en una hora. Puedes cerrar esta pestaña.</p>
        </div>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard titulo="Entra a tu academia" subtitulo="Te enviamos un enlace de acceso. Sin contraseñas.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email" type="email" required autoComplete="email"
            placeholder="tu@empresa.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={enviando} className="w-full">
          <Send className="size-4" aria-hidden />
          {enviando ? "Enviando..." : "Enviarme el enlace"}
        </Button>
      </form>
    </AuthFormCard>
  );
}
```

- [ ] **Paso 4: Crear la pantalla de retorno**

Crear `src/app/(auth)/callback/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, useHydrated } from "@/lib/hooks/use-session";
import { homePorRol } from "@/lib/routes";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

/**
 * Aterrizaje del enlace de correo. `useHydrated` dispara la carga del armazón;
 * en cuanto hay usuario, se redirige según su rol.
 */
export default function CallbackPage() {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(user ? homePorRol(user) : "/login");
  }, [hydrated, user, router]);

  return <FullScreenLoader />;
}
```

Verificar antes el nombre real del componente de carga:
`grep -rn "FullScreenLoader" src/components | head -1`. Si no existe con ese
nombre, usar el que devuelva ese grep.

- [ ] **Paso 5: Borrar lo que sobra**

```bash
git rm -r "src/app/(auth)/registro" "src/app/(auth)/recuperar"
git rm src/components/shared/user-switcher.tsx
grep -rn "user-switcher\|/registro\|/recuperar" src | grep -v node_modules
```

Quitar cada referencia que aparezca. `registrarCreador`, `login`, `logout` y
`currentUserId` salen de `store.ts`.

- [ ] **Paso 6: Verificar**

```bash
bun run build && bun run lint && bun run test:rls
```
Esperado: los tres limpios.

- [ ] **Paso 7: Comprobación manual — la que ninguna prueba sustituye**

```bash
bun run crear-academia -- --email <TU-CORREO-DE-RESEND> --empresa "Mi Empresa" --slug mi-empresa
bun run dev
```

Ir a `/login`, meter ese correo, abrir el enlace del correo, y confirmar que
aterriza en `/admin`.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "feat(auth): sesion real por enlace de correo; retirar registro y user-switcher"
```

---

### Tarea 4: Los hooks de lectura pasan a leer del armazón

**Archivos:**
- Modificar: `src/lib/hooks/use-my-community.ts`, `use-community.ts`, `use-courses.ts`, `use-admin-courses.ts`, `use-marca-auth.ts`

> `useLesson` **no tiene archivo propio**: vive dentro de `use-courses.ts`. No
> busques `use-lesson.ts` — `use-lesson-comments.ts` es otra cosa y no entra en
> esta rebanada.

- [ ] **Paso 1: Migrar `useMyCommunity`**

```ts
"use client";

import { useAppStore } from "@/lib/store";
import type { Community } from "@/lib/types";

/**
 * La comunidad que administra el usuario. Sale del armazón: RLS ya decidió
 * cuál puede ver, así que aquí solo se comprueba que sea SUYA.
 */
export function useMyCommunity(): Community | null {
  const armazon = useAppStore((s) => s.armazon);
  if (!armazon?.comunidad) return null;
  return armazon.comunidad.ownerId === armazon.perfil.id ? armazon.comunidad : null;
}
```

- [ ] **Paso 2: Migrar `useCourses`**

Conservar la forma de retorno `{ cursos: CourseConAcceso[] }`. Derivar con
`useMemo` sobre `armazon.cursos` — **nunca** dentro del selector, que crashea
`useSyncExternalStore` en React 19.

```ts
export function useCourses(comunidadId: string): { cursos: CourseConAcceso[] } {
  const armazon = useAppStore((s) => s.armazon);
  const progreso = useAppStore((s) => s.progreso);

  const cursos = useMemo(() => {
    const propios = (armazon?.cursos ?? []).filter(
      (c) => c.comunidadId === comunidadId && c.publicado
    );
    return propios.map((c) => construirCursoConAcceso(c, progreso));
  }, [armazon, comunidadId, progreso]);

  return { cursos };
}
```

Mantener `construirCursoConAcceso` tal como esté hoy en el archivo: solo cambia
de dónde salen los cursos, no cómo se calcula el acceso.

- [ ] **Paso 3: Migrar `useAdminCourses` y `useAdminCourse`**

Igual, pero **sin** filtrar por `publicado`: el dueño ve sus borradores, y RLS
ya se los ha entregado.

- [ ] **Paso 4: Migrar `useCommunity` y `useLesson`**

`useCommunity(slug)` compara `armazon.comunidad.slug === slug`.
`useLesson` busca la lección recorriendo `armazon.cursos`.

- [ ] **Paso 5: Migrar `useMarcaAuth`**

Este corre **sin sesión** (es la portada del login), así que no puede leer el
armazón. Usa la función pública del cimiento:

```ts
export function useMarcaAuth(slug?: string): MarcaAuth {
  const [marca, setMarca] = useState<MarcaAuth>({});

  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    crearClienteNavegador()
      .rpc("marca_publica", { p_slug: slug })
      .then(({ data }) => {
        if (vivo && data?.[0]) {
          setMarca((data[0].marca_auth as MarcaAuth) ?? {});
        }
      });
    return () => { vivo = false; };
  }, [slug]);

  return marca;
}
```

- [ ] **Paso 6: Verificar**

```bash
bun run build && bun run lint && bun run test:rls
```

- [ ] **Paso 7: Comprobación manual**

Con la academia creada y sesión iniciada, `/admin` debe mostrar la comunidad
real. El feed y el calendario se verán **vacíos**: es lo esperado hasta la
rebanada 3, no un fallo.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "feat(datos): los hooks del armazon leen de Supabase en vez de mocks"
```

---

### Tarea 5: Guardar cursos en la base

La que hace que los enlaces de Vimeo sobrevivan a una recarga.

**Archivos:**
- Crear: `src/lib/supabase/guardar-curso.ts`
- Modificar: `src/lib/store.ts` (retirar `guardarCurso`, `cursosEditados`, `siguienteCursoId`, `siguienteModuloId`, `siguienteLeccionId`, `proximoCursoId`, `proximoModuloId`, `proximoLeccionId`)
- Modificar: `src/app/(creador)/admin/cursos/[curso]/_curso-editor.tsx`
- Crear: `tests/rls/guardar-curso.test.ts`

**Interfaces:**
- Produce: `guardarCurso(supabase, curso: Course): Promise<void>`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/rls/guardar-curso.test.ts`:

```ts
import { expect, test, beforeAll, afterAll } from "bun:test";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import { guardarCurso } from "../../src/lib/supabase/guardar-curso";
import { cargarArmazon } from "../../src/lib/supabase/consultas";
import type { Course } from "../../src/lib/types";

let e: Escenario;
beforeAll(async () => { e = await montarEscenario("guardar"); });
afterAll(async () => { await desmontar(e); });

function cursoDePrueba(id: string, comunidadId: string): Course {
  return {
    id, comunidadId, slug: "curso-guardado", titulo: "Curso guardado",
    descripcion: "", portadaUrl: "", precioReferencial: 0,
    nivelRequerido: null, publicado: true, secciones: [],
    modulos: [
      { id: crypto.randomUUID(), titulo: "Modulo 1", orden: 1, lecciones: [
        { id: crypto.randomUUID(), titulo: "Leccion 1", orden: 1, tipo: "video",
          vimeoId: "987654321", duracionMin: 5, contenido: "", recursos: [] },
      ]},
      { id: crypto.randomUUID(), titulo: "Modulo 2", orden: 2, lecciones: [] },
    ],
  };
}

test("guardar un curso conserva modulos, lecciones y el id de Vimeo", async () => {
  const curso = cursoDePrueba(crypto.randomUUID(), e.comunidadA);
  await guardarCurso(e.duenoA.cliente, curso);

  const armazon = await cargarArmazon(e.duenoA.cliente);
  const leido = armazon.cursos.find((c) => c.id === curso.id);

  expect(leido?.titulo).toBe("Curso guardado");
  expect(leido?.modulos.length).toBe(2);
  expect(leido?.modulos[0].lecciones[0].vimeoId).toBe("987654321");
});

test("guardar sin un modulo lo borra de verdad", async () => {
  const curso = cursoDePrueba(crypto.randomUUID(), e.comunidadA);
  await guardarCurso(e.duenoA.cliente, curso);

  await guardarCurso(e.duenoA.cliente, { ...curso, modulos: [curso.modulos[0]] });

  const armazon = await cargarArmazon(e.duenoA.cliente);
  const leido = armazon.cursos.find((c) => c.id === curso.id);
  expect(leido?.modulos.length).toBe(1);
});

test("un alumno no puede guardar un curso en la comunidad de su dueno", async () => {
  const curso = cursoDePrueba(crypto.randomUUID(), e.comunidadA);
  await expect(guardarCurso(e.alumnoA.cliente, curso)).rejects.toThrow();
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Run: `bun run test:rls`
Esperado: FALLA — no existe `guardar-curso.ts`.

- [ ] **Paso 3: Escribir el guardado**

Crear `src/lib/supabase/guardar-curso.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course } from "@/lib/types";

/**
 * Guarda un curso completo: él, sus módulos y sus lecciones.
 *
 * Los identificadores los pone el navegador con `crypto.randomUUID()`, no la
 * base. Eso permite que el editor monte el curso entero en memoria y lo guarde
 * de una vez, sin el baile de identificadores provisionales que haría falta si
 * los asignara Postgres al insertar.
 *
 * Borra lo que ya no está: si el editor quitó un módulo, aquí desaparece de la
 * base. Las lecciones caen solas por cascada.
 *
 * LIMITACIÓN CONOCIDA: guarda el curso entero de golpe. Con dos personas
 * editando a la vez, la última escritura gana y la otra pierde su trabajo sin
 * aviso. Aceptable mientras haya un dueño por academia (ver §9 de la spec).
 */
export async function guardarCurso(
  supabase: SupabaseClient,
  curso: Course
): Promise<void> {
  const { error: errCurso } = await supabase.from("cursos").upsert({
    id: curso.id,
    comunidad_id: curso.comunidadId,
    slug: curso.slug,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    portada_url: curso.portadaUrl,
    precio_referencial: curso.precioReferencial,
    nivel_requerido: curso.nivelRequerido,
    publicado: curso.publicado,
  });
  if (errCurso) throw new Error(`No se pudo guardar el curso: ${errCurso.message}`);

  const idsModulos = curso.modulos.map((m) => m.id);
  // `.not.in` con lista vacía genera SQL inválido, así que se separa el caso.
  const borrarModulos = supabase.from("modulos").delete().eq("curso_id", curso.id);
  const { error: errBorrar } = idsModulos.length
    ? await borrarModulos.not("id", "in", `(${idsModulos.join(",")})`)
    : await borrarModulos;
  if (errBorrar) throw new Error(`No se pudieron limpiar los módulos: ${errBorrar.message}`);

  if (curso.modulos.length === 0) return;

  const { error: errModulos } = await supabase.from("modulos").upsert(
    curso.modulos.map((m) => ({
      id: m.id, curso_id: curso.id, titulo: m.titulo,
      orden: m.orden, portada_url: m.portadaUrl ?? null,
    }))
  );
  if (errModulos) throw new Error(`No se pudieron guardar los módulos: ${errModulos.message}`);

  for (const modulo of curso.modulos) {
    const idsLecciones = modulo.lecciones.map((l) => l.id);
    const borrarLecciones = supabase.from("lecciones").delete().eq("modulo_id", modulo.id);
    const { error: errBorrarLec } = idsLecciones.length
      ? await borrarLecciones.not("id", "in", `(${idsLecciones.join(",")})`)
      : await borrarLecciones;
    if (errBorrarLec) throw new Error(`No se pudieron limpiar las lecciones: ${errBorrarLec.message}`);

    if (modulo.lecciones.length === 0) continue;

    const { error: errLec } = await supabase.from("lecciones").upsert(
      modulo.lecciones.map((l) => ({
        id: l.id, modulo_id: modulo.id, titulo: l.titulo, orden: l.orden,
        tipo: l.tipo, vimeo_id: l.vimeoId, duracion_min: l.duracionMin,
        contenido: l.contenido, recursos: l.recursos,
      }))
    );
    if (errLec) throw new Error(`No se pudieron guardar las lecciones: ${errLec.message}`);
  }
}
```

- [ ] **Paso 4: Ejecutar las pruebas**

Run: `bun run test:rls`
Esperado: las tres pruebas de `guardar-curso.test.ts` PASAN. La tercera pasa
porque RLS rechaza la escritura del alumno.

- [ ] **Paso 5: Conectar el editor**

En `_curso-editor.tsx`, sustituir `useAppStore(s => s.guardarCurso)` por una
llamada a la nueva función, y los tres generadores de identificadores por
`crypto.randomUUID()`:

```ts
const supabase = crearClienteNavegador();
await guardarCurso(supabase, cursoEditado);
// Refrescar el armazón para que el resto de la app vea el cambio:
establecerArmazon(await cargarArmazon(supabase));
```

Buscar todos los usos con:
`grep -rn "siguienteCursoId\|siguienteModuloId\|siguienteLeccionId\|guardarCurso" src`

- [ ] **Paso 6: Actualizar CLAUDE.md**

En la sección "Determinismo", sustituir el apartado de IDs de runtime:

```markdown
- **IDs creados en runtime**: `crypto.randomUUID()`. Los contadores del store
  (`siguienteCursoId`...) se retiraron al pasar a Postgres: eran deterministas
  para la demo, pero con datos reales dos personas editando a la vez generarían
  el mismo `curso-4`. La prohibición de `Math.random()` sigue en pie **para los
  seeds de `src/lib/mocks/`**, que deben seguir siendo reproducibles.
```

- [ ] **Paso 7: Verificar**

```bash
bun run build && bun run lint && bun run test:rls
```

- [ ] **Paso 8: La comprobación que define la rebanada**

Con `bun run dev`: crear un curso, añadir un módulo y una lección, pegar un
enlace de Vimeo, guardar, **recargar la página**. El curso y el vídeo siguen
ahí. Abrir la misma cuenta en otro navegador: se ve lo mismo.

- [ ] **Paso 9: Commit**

```bash
git add -A
git commit -m "feat(cursos): guardar cursos, modulos y lecciones en Postgres"
```

---

## Autorrevisión frente a la spec

| Sección de la spec | Tarea |
|---|---|
| §1 Criterio de terminación (6 pasos) | 1 (pasos 1), 3 (2), 5 (3-5), 4 (6) |
| §3 Alta de la academia | 1 |
| §4 Sesión real, retirada de /registro, /recuperar, user-switcher | 3 |
| §5 Lectura del armazón, `useHydrated` resignificado | 2 y 3 (carga), 4 (hooks) |
| §5 `useMarcaAuth` vía `marca_publica` | 4, paso 5 |
| §6 Escritura de cursos | 5 |
| §6 IDs con `crypto.randomUUID`, CLAUDE.md actualizado | 5, pasos 5-6 |
| §7 Retirada de contadores y `cursosEditados` | 5 |
| §8 Pruebas 1-5 | 1 (prueba 1), 5 (2 y 3), 2 y 5 (4), pendiente abajo |
| §9 Riesgo de edición concurrente | documentado en `guardar-curso.ts` |

**Hueco detectado y cerrado:** la prueba 5 de la spec (`marca_publica` sin
sesión sobre la academia recién creada) no tenía tarea. Se añade a la Tarea 1
como paso extra:

```ts
test("la marca de la academia se lee sin sesion", async () => {
  const anon = comoAnonimo();
  const { data } = await anon.rpc("marca_publica", { p_slug: "acme-prueba" });
  expect(data?.[0]?.nombre).toBe("ACME Prueba");
});
```

(Importar `comoAnonimo` de `./ayudas` en `academia.test.ts`.)

**Fuera de alcance, confirmado:** `admin/reportes/page.tsx` y `perfil/page.tsx`
siguen importando mocks directamente. Son las 2 violaciones restantes de
`mocks → hooks → páginas` y se corrigen en la rebanada 3, cuando migren los
datos que consumen.
