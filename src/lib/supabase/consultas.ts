import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community, Course, Lesson, User, UserRole } from "@/lib/types";
import type { GoteoModo } from "@/lib/goteo";
import { nivelPorPuntos } from "@/lib/levels";

export interface Armazon {
  perfil: User;
  comunidad: Community | null;
  cursos: Course[];
  /**
   * Ids de las lecciones que esta persona ha completado.
   *
   * RLS ya limita las filas a las propias, así que no hace falta filtrar por
   * usuario aquí: si llega, es tuya.
   */
  progreso: string[];
  /**
   * Cuándo entró esta persona a la academia, en ISO, o `null` si no está
   * inscrita.
   *
   * Es el reloj del goteo por días. Viaja en el armazón porque la tarjeta de
   * un módulo cerrado tiene que poder decir «se abre el martes», y sin esta
   * fecha solo podría decir «cerrado».
   */
  entradaEl: string | null;
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

  const CAMPOS_COMUNIDAD =
    "id, slug, nombre, descripcion, logo_url, color_acento, propietario_id, plan_id, estado, nombres_niveles, marca_auth, nombre_ia, avatar_ia, creado_el";

  // Primero la que POSEES, y solo si no posees ninguna, la que estudias.
  //
  // Antes esto era un `.limit(1)` a secas, confiando en que «RLS ya deja pasar
  // solo la tuya». Es falso para un superadmin: su política le deja ver TODAS
  // las academias de la plataforma, así que Postgres le devolvía la primera que
  // le viniera bien — la de otro. Con una sola academia en la base nunca se
  // notó; con dos, el panel de creador enseñaba la ajena.
  const { data: propias } = await supabase
    .from("comunidades")
    .select(CAMPOS_COMUNIDAD)
    .eq("propietario_id", usuario.id)
    .limit(1);

  let c = propias?.[0] ?? null;

  if (!c) {
    // La del alumno, alcanzada por su inscripción. Se pregunta por el id en vez
    // de leer `comunidades` a pelo por lo mismo de arriba: el resultado tiene
    // que salir de algo suyo, no del orden de la tabla.
    const { data: suya } = await supabase
      .from("inscripciones")
      .select("comunidad_id")
      .eq("usuario_id", usuario.id)
      .limit(1);

    if (suya?.[0]) {
      const { data: filas } = await supabase
        .from("comunidades")
        .select(CAMPOS_COMUNIDAD)
        .eq("id", suya[0].comunidad_id)
        .limit(1);
      c = filas?.[0] ?? null;
    }
  }

  // La fecha de entrada de esta persona a la academia, que es el reloj del
  // goteo por días. Se pregunta aquí y no en el bloque de arriba porque el
  // dueño también está inscrito en la suya —`crearAcademia` le inscribe para
  // que «Ver como alumno» le enseñe algo— y así el camino es el mismo para los
  // dos.
  let entradaEl: string | null = null;
  if (c) {
    const { data: mia } = await supabase
      .from("inscripciones")
      .select("creado_el")
      .eq("usuario_id", usuario.id)
      .eq("comunidad_id", c.id)
      .maybeSingle();
    entradaEl = mia?.creado_el ?? null;
  }

  const { data: progresoFilas } = await supabase.from("progreso").select("leccion_id");

  // Filtrado por la academia elegida, y por el mismo motivo: sin el `.eq()` un
  // superadmin se descargaba los cursos de todas las academias de la
  // plataforma para pintar los de una.
  const { data: cursosFilas } = c
    ? await supabase
        .from("cursos")
        .select(
          `id, comunidad_id, slug, titulo, descripcion, portada_url,
     precio_referencial, nivel_requerido, publicado, orden,
     goteo_modo, goteo_dias, goteo_desde,
     modulos ( id, titulo, orden, portada_url, publicado,
       lecciones ( id, titulo, orden, duracion_min, recursos, portada_url, bloques, ia_habilitada, ia_contexto ) )`
        )
        .eq("comunidad_id", c.id)
    : { data: [] };

  const perfil: User = {
    id: perfilFila.id,
    email: usuario.email ?? "",
    nombre: perfilFila.nombre,
    avatarUrl: perfilFila.avatar_url,
    bio: perfilFila.bio,
    rol: perfilFila.rol as UserRole,
    comunidadIds: c ? [c.id] : [],
    puntos: perfilFila.puntos,
    nivel: nivelPorPuntos(perfilFila.puntos),
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
        nombreIa: c.nombre_ia ?? undefined,
        avatarIa: c.avatar_ia ?? undefined,
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
    orden: f.orden ?? 0,
    goteoModo: (f.goteo_modo ?? "ninguno") as GoteoModo,
    goteoDias: f.goteo_dias ?? null,
    goteoDesde: f.goteo_desde ?? null,
    secciones: [],
    modulos: (f.modulos ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((m) => ({
        id: m.id,
        titulo: m.titulo,
        orden: m.orden,
        portadaUrl: m.portada_url ?? undefined,
        publicado: m.publicado ?? true,
        lecciones: (m.lecciones ?? [])
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((l) => ({
            id: l.id,
            titulo: l.titulo,
            orden: l.orden,
            portadaUrl: l.portada_url ?? undefined,
            duracionMin: l.duracion_min,
            bloques: (l.bloques ?? []) as Lesson["bloques"],
            iaHabilitada: l.ia_habilitada ?? false,
            iaContexto: l.ia_contexto ?? undefined,
            recursos: l.recursos ?? [],
          })),
      })),
  }));

  // Y los propios cursos por su `orden`, igual que sus módulos y sus lecciones.
  // Se hace aquí, en el único sitio que los carga, para que ninguna pantalla
  // tenga que acordarse: el classroom del alumno y la lista del panel enseñan
  // el mismo temario o no sirve de nada haberlo ordenado.
  cursos.sort((a, b) => a.orden - b.orden);

  const progreso = ((progresoFilas ?? []) as { leccion_id: string }[]).map(
    (p) => p.leccion_id
  );

  return { perfil, comunidad, cursos, progreso, entradaEl };
}
