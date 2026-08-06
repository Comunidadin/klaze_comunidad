import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community, Plan } from "@/lib/types";
import { nombreVisible } from "@/lib/nombre-visible";

export interface DuenoPlataforma {
  id: string;
  nombre: string;
  email: string;
}

export interface AcademiaPlataforma {
  comunidad: Community;
  dueno: DuenoPlataforma;
  plan: Plan;
  /** Inscripciones de cualquier estado — mismo criterio que la tabla de admin. */
  miembros: number;
}

export interface CreadorPlataforma {
  id: string;
  nombre: string;
  email: string;
  academias: Community[];
}

export interface DatosPlataforma {
  academias: AcademiaPlataforma[];
  creadores: CreadorPlataforma[];
  planes: Plan[];
}

/**
 * OJO con `perfiles!comunidades_propietario_id_fkey`: el nombre de la clave
 * foránea es obligatorio. `comunidades` y `perfiles` tienen más de un camino
 * entre sí, y sin él PostgREST falla con "more than one relationship was
 * found" y se cae la consulta entera.
 *
 * `inscripciones ( count )` cuenta sin traer las filas. Con una academia de mil
 * alumnos, traerlas para hacer `.length` sería absurdo.
 */
const CAMPOS = `
  id, slug, nombre, descripcion, logo_url, color_acento, propietario_id,
  plan_id, estado, nombres_niveles, marca_auth, creado_el,
  perfiles!comunidades_propietario_id_fkey ( id, nombre, email ),
  planes ( id, nombre, precio_mes, max_comunidades, max_alumnos, max_cursos, destacado ),
  inscripciones ( count )
`;

/** El perfil pudo borrarse y la academia seguir viva. */
const DUENO_DESCONOCIDO: DuenoPlataforma = {
  id: "",
  nombre: "Sin dueño",
  email: "",
};

function unico<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

interface FilaPlan {
  id: string;
  nombre: string;
  precio_mes: number | string;
  max_comunidades: number;
  max_alumnos: number;
  max_cursos: number;
  destacado: boolean;
}

function aPlan(f: FilaPlan): Plan {
  return {
    id: f.id as Plan["id"],
    nombre: f.nombre,
    // `numeric` de Postgres llega como cadena por el JSON: sin `Number` el
    // precio se concatenaría en vez de sumarse.
    precioMes: Number(f.precio_mes),
    limites: {
      comunidades: f.max_comunidades,
      alumnos: f.max_alumnos,
      cursos: f.max_cursos,
    },
    destacado: f.destacado,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- la fila anidada de
   PostgREST no tiene tipo generado. Se normaliza aquí y no sale del archivo. */
function aComunidad(f: any): Community {
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion ?? "",
    logoUrl: f.logo_url ?? "",
    colorAcento: f.color_acento ?? "",
    ownerId: f.propietario_id,
    plan: f.plan_id as Community["plan"],
    estado: f.estado as Community["estado"],
    nombresNiveles: f.nombres_niveles ?? [],
    // `secciones` es obligatorio en el tipo pero vive en su propia tabla, y
    // ninguna pantalla de /plataforma las usa: traerlas sería una consulta más
    // para pintar nada.
    secciones: [],
    marcaAuth: f.marca_auth ?? undefined,
    creadoEl: f.creado_el,
  };
}

/**
 * Todo lo que pinta `/plataforma`, en tres consultas paralelas.
 *
 * Solo el superadmin ve algo aquí: las políticas de `comunidades` y `perfiles`
 * filtran por `es_superadmin()`. A un creador le devuelve su propia academia y
 * poco más, que es correcto — la pantalla no es suya y el guard de ruta ya lo
 * manda a `/admin`.
 */
export async function leerPlataforma(
  supabase: SupabaseClient
): Promise<DatosPlataforma> {
  const [comunidades, planes, perfiles] = await Promise.all([
    supabase.from("comunidades").select(CAMPOS).order("creado_el", { ascending: false }),
    supabase.from("planes").select("*").order("precio_mes", { ascending: true }),
    supabase.from("perfiles").select("id, nombre, email, rol"),
  ]);

  if (comunidades.error) {
    throw new Error(`No se pudieron leer las academias: ${comunidades.error.message}`);
  }
  if (planes.error) {
    throw new Error(`No se pudieron leer los planes: ${planes.error.message}`);
  }
  if (perfiles.error) {
    throw new Error(`No se pudieron leer los perfiles: ${perfiles.error.message}`);
  }

  const listaPlanes = ((planes.data ?? []) as FilaPlan[]).map(aPlan);

  const academias: AcademiaPlataforma[] = ((comunidades.data ?? []) as any[]).map((f) => {
    const perfil = unico<{ id: string; nombre: string; email: string }>(f.perfiles);
    const plan = unico<FilaPlan>(f.planes);
    const cuenta = unico<{ count: number }>(f.inscripciones);
    return {
      comunidad: aComunidad(f),
      dueno: perfil
        ? {
            id: perfil.id,
            nombre: nombreVisible(perfil.nombre ?? "", perfil.email ?? ""),
            email: perfil.email ?? "",
          }
        : DUENO_DESCONOCIDO,
      plan: plan ? aPlan(plan) : listaPlanes[0],
      miembros: cuenta?.count ?? 0,
    };
  });

  const creadores: CreadorPlataforma[] = ((perfiles.data ?? []) as any[])
    .filter((p) => p.rol === "creador" || p.rol === "superadmin")
    .map((p) => ({
      id: p.id,
      nombre: nombreVisible(p.nombre ?? "", p.email ?? ""),
      email: p.email ?? "",
      academias: academias
        .filter((a) => a.comunidad.ownerId === p.id)
        .map((a) => a.comunidad),
    }))
    // Un superadmin que no posee ninguna academia no es un creador: sale de la
    // lista para que la cuenta de "creadores" no se infle sola.
    .filter((c) => c.academias.length > 0);

  return { academias, creadores, planes: listaPlanes };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Suspende o reactiva una academia.
 *
 * Suspender revoca acceso real (ver la migración `suspension_revoca_acceso`):
 * ni el creador ni sus alumnos entran mientras lo esté.
 *
 * Lanza si la política lo rechaza. RLS no lanza —filtra— así que sin esta
 * comprobación un creador vería "suspendida" sin que pasara nada.
 */
export async function cambiarEstadoComunidad(
  supabase: SupabaseClient,
  comunidadId: string,
  estado: "activa" | "suspendida"
): Promise<void> {
  const { data, error } = await supabase
    .from("comunidades")
    .update({ estado })
    .eq("id", comunidadId)
    .select("id");

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo cambiar el estado: no tienes permiso");
  }
}

/** Guarda un plan. Solo el superadmin: la política de `planes` es `es_superadmin()`. */
export async function guardarPlan(
  supabase: SupabaseClient,
  plan: Plan
): Promise<void> {
  const { data, error } = await supabase
    .from("planes")
    .update({
      nombre: plan.nombre,
      precio_mes: plan.precioMes,
      max_comunidades: plan.limites.comunidades,
      max_alumnos: plan.limites.alumnos,
      max_cursos: plan.limites.cursos,
      destacado: plan.destacado,
    })
    .eq("id", plan.id)
    .select("id");

  if (error) throw new Error(`No se pudo guardar el plan: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar el plan: no tienes permiso");
  }
}
