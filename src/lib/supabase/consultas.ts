import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community, Course, User, UserRole } from "@/lib/types";

export interface Armazon {
  perfil: User;
  comunidad: Community | null;
  cursos: Course[];
}

/**
 * Trae de una vez todo lo que la app necesita para pintarse: quién eres, tu
 * academia, y sus cursos con módulos y lecciones anidados.
 *
 * Es una sola carga y no una consulta por pantalla porque una academia son
 * decenas de cursos, no miles de filas. Gracias a eso los 20 hooks conservan su
 * firma síncrona y los 75 componentes cliente no se tocan. El feed, que sí
 * crece sin techo, tendrá carga propia y paginación en la rebanada 3.
 *
 * No filtra por permisos, y es deliberado: eso lo hace RLS. Si esta consulta
 * devuelve un curso es porque la base ha decidido que puedes verlo. Repetir el
 * filtro aquí duplicaría la regla en dos sitios que pueden divergir.
 */
export async function cargarArmazon(supabase: SupabaseClient): Promise<Armazon> {
  const { data: sesion } = await supabase.auth.getUser();
  const usuario = sesion.user;
  if (!usuario) throw new Error("cargarArmazon requiere una sesión activa");

  // Antes de leer nada: si hay invitaciones pendientes para este correo, se
  // convierten en acceso ahora. Si no las hay, no hace nada y no cuesta nada.
  //
  // Va aquí y no en el login por dos motivos: cubre a quien ya tenía la sesión
  // abierta cuando lo invitaron, y cubre el caso que el trigger no ve —
  // invitar a alguien que ya tenía cuenta no crea ninguna, así que el trigger
  // nunca salta.
  await supabase.rpc("aceptar_mis_invitaciones");

  const { data: perfilFila, error: errPerfil } = await supabase
    .from("perfiles")
    .select("id, nombre, avatar_url, bio, rol, puntos, creado_el")
    .eq("id", usuario.id)
    .single();
  if (errPerfil) {
    throw new Error(`No se pudo leer el perfil: ${errPerfil.message}`);
  }

  // Sin `.eq()`: RLS ya deja pasar solo la comunidad que posees o en la que
  // estás inscrito.
  const { data: comunidades } = await supabase
    .from("comunidades")
    .select(
      "id, slug, nombre, descripcion, logo_url, color_acento, propietario_id, plan_id, estado, nombres_niveles, marca_auth, creado_el"
    )
    .limit(1);
  const c = comunidades?.[0] ?? null;

  const { data: cursosFilas } = await supabase.from("cursos").select(
    `id, comunidad_id, slug, titulo, descripcion, portada_url,
     precio_referencial, nivel_requerido, publicado,
     modulos ( id, titulo, orden, portada_url,
       lecciones ( id, titulo, orden, tipo, vimeo_id, duracion_min, contenido, recursos ) )`
  );

  const perfil: User = {
    id: perfilFila.id,
    email: usuario.email ?? "",
    nombre: perfilFila.nombre,
    avatarUrl: perfilFila.avatar_url,
    bio: perfilFila.bio,
    rol: perfilFila.rol as UserRole,
    comunidadIds: c ? [c.id] : [],
    puntos: perfilFila.puntos,
    nivel: 1,
    creadoEl: perfilFila.creado_el,
  };

  const comunidad: Community | null = c
    ? {
        id: c.id,
        slug: c.slug,
        nombre: c.nombre,
        descripcion: c.descripcion,
        logoUrl: c.logo_url,
        colorAcento: c.color_acento,
        ownerId: c.propietario_id,
        plan: c.plan_id as Community["plan"],
        estado: c.estado as Community["estado"],
        nombresNiveles: c.nombres_niveles,
        // Los espacios del feed llegan en la rebanada 3, con el resto de la
        // vida social. Vacío aquí no es un olvido.
        secciones: [],
        creadoEl: c.creado_el,
        marcaAuth: c.marca_auth ?? undefined,
      }
    : null;

  // El orden de una tabla anidada no se hereda del padre y PostgREST no
  // garantiza el de las filas anidadas, así que se ordena aquí.
  const cursos: Course[] = (cursosFilas ?? []).map((f) => ({
    id: f.id,
    comunidadId: f.comunidad_id,
    slug: f.slug,
    titulo: f.titulo,
    descripcion: f.descripcion,
    portadaUrl: f.portada_url,
    precioReferencial: Number(f.precio_referencial),
    nivelRequerido: f.nivel_requerido,
    publicado: f.publicado,
    secciones: [],
    modulos: (f.modulos ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((m) => ({
        id: m.id,
        titulo: m.titulo,
        orden: m.orden,
        portadaUrl: m.portada_url ?? undefined,
        lecciones: (m.lecciones ?? [])
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((l) => ({
            id: l.id,
            titulo: l.titulo,
            orden: l.orden,
            tipo: l.tipo as Course["modulos"][number]["lecciones"][number]["tipo"],
            vimeoId: l.vimeo_id,
            duracionMin: l.duracion_min,
            contenido: l.contenido,
            recursos: l.recursos ?? [],
          })),
      })),
  }));

  return { perfil, comunidad, cursos };
}
