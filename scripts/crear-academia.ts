/**
 * Da de alta una academia: la cuenta del dueño, su perfil como creador y la
 * comunidad.
 *
 * Es un comando y no una pantalla porque las pantallas de alta del superadmin
 * son trabajo posterior, y aquí solo hace falta arrancar: sin este paso la base
 * se queda vacía para siempre y la app no tiene nada que leer.
 *
 *   bun run crear-academia -- --email jefe@empresa.com --empresa "Mi Empresa" --slug mi-empresa
 *
 * La cuenta se crea SIN contraseña: se entra por enlace de correo. Y el correo
 * importa — mientras Resend no tenga un dominio verificado, solo entrega al
 * correo de la propia cuenta de Resend.
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

/** Los 9 nombres de nivel por defecto, en orden (nivel 1..9). */
const NIVELES_POR_DEFECTO = [
  "Novato",
  "Aprendiz",
  "Practicante",
  "Competente",
  "Avanzado",
  "Experto",
  "Maestro",
  "Mentor",
  "Leyenda",
];

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

  // Idempotente por slug: repetir el comando no duplica la academia. Importa
  // porque es lo primero que uno reejecuta cuando algo sale a medias.
  const { data: existente } = await supabase
    .from("comunidades")
    .select("id, propietario_id")
    .eq("slug", op.slug)
    .maybeSingle();

  if (existente) {
    return {
      comunidadId: existente.id,
      usuarioId: existente.propietario_id,
      yaExistia: true,
    };
  }

  // Reutiliza la cuenta si ya existe: puede haberla dejado un intento anterior
  // que creo el usuario y fallo al crear la comunidad.
  const { data: lista } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  let usuarioId = lista?.users?.find(
    (u) => u.email?.toLowerCase() === op.email.toLowerCase()
  )?.id;

  if (!usuarioId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: op.email,
      email_confirm: true,
    });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    if (!data.user) throw new Error("Supabase no devolvio usuario al crearlo");
    usuarioId = data.user.id;
  }

  // El trigger `on_auth_user_created` del cimiento ya creo el perfil; aqui
  // solo hace falta marcar el rol.
  const { error: errRol } = await supabase
    .from("perfiles")
    .update({ rol: "creador" })
    .eq("id", usuarioId);
  if (errRol) throw new Error(`No se pudo marcar el rol: ${errRol.message}`);

  const { data: com, error: errCom } = await supabase
    .from("comunidades")
    .insert({
      slug: op.slug,
      nombre: op.empresa,
      propietario_id: usuarioId,
      plan_id: "pro",
      nombres_niveles: NIVELES_POR_DEFECTO,
    })
    .select("id")
    .single();
  if (errCom) throw new Error(`No se pudo crear la comunidad: ${errCom.message}`);

  return { comunidadId: com.id, usuarioId, yaExistia: false };
}

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
    console.log(`La academia "${slug}" ya existia. No se ha tocado nada.`);
  } else {
    console.log("Academia creada.");
    console.log(`  comunidad: ${r.comunidadId}`);
    console.log(`  dueno:     ${r.usuarioId}`);
    console.log(`\nEntra en /login con ${email} y te llegara el enlace de acceso.`);
  }
  process.exit(0);
}
