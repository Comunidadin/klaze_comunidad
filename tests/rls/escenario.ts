import { admin, comoSuperadmin, comoUsuario, limpiarUsuarios } from "./ayudas";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dos empresas completas y aisladas, montadas con la clave secreta.
 *
 * El alumno de A tiene acceso SOLO a `cursoAPublicado`: ni al borrador ni a
 * `cursoASinAcceso`. Esa distincion es deliberada — permite que las pruebas
 * separen tres fallos que se confunden con facilidad: "ve otra empresa",
 * "ve un borrador" y "ve un curso de su empresa que no compro".
 */
export interface Escenario {
  duenoA: { id: string; cliente: SupabaseClient };
  alumnoA: { id: string; cliente: SupabaseClient };
  duenoB: { id: string; cliente: SupabaseClient };
  alumnoB: { id: string; cliente: SupabaseClient };
  /** No pertenece a ninguna de las dos empresas: su acceso viene del rol. */
  superadmin: { id: string; cliente: SupabaseClient };
  comunidadA: string;
  comunidadB: string;
  cursoAPublicado: string;
  cursoABorrador: string;
  cursoASinAcceso: string;
  cursoB: string;
}

export async function montarEscenario(sufijo: string): Promise<Escenario> {
  const duenoA = await comoUsuario(`duenoa-${sufijo}@prueba.klaze`);
  const alumnoA = await comoUsuario(`alumnoa-${sufijo}@prueba.klaze`);
  const duenoB = await comoUsuario(`duenob-${sufijo}@prueba.klaze`);
  const alumnoB = await comoUsuario(`alumnob-${sufijo}@prueba.klaze`);
  const superadmin = await comoSuperadmin(`super-${sufijo}@prueba.klaze`);

  const comunidad = async (slug: string, propietario: string) => {
    const { data, error } = await admin
      .from("comunidades")
      .insert({ slug, nombre: slug, propietario_id: propietario, plan_id: "pro" })
      .select("id")
      .single();
    if (error) throw new Error(`comunidad ${slug}: ${error.message}`);
    return data.id as string;
  };

  const curso = async (comunidadId: string, slug: string, publicado: boolean) => {
    const { data, error } = await admin
      .from("cursos")
      .insert({ comunidad_id: comunidadId, slug, titulo: slug, publicado })
      .select("id")
      .single();
    if (error) throw new Error(`curso ${slug}: ${error.message}`);
    return data.id as string;
  };

  const comunidadA = await comunidad(`empresa-a-${sufijo}`, duenoA.id);
  const comunidadB = await comunidad(`empresa-b-${sufijo}`, duenoB.id);

  const cursoAPublicado = await curso(comunidadA, `a-pub-${sufijo}`, true);
  const cursoABorrador = await curso(comunidadA, `a-bor-${sufijo}`, false);
  const cursoASinAcceso = await curso(comunidadA, `a-sin-${sufijo}`, true);
  const cursoB = await curso(comunidadB, `b-pub-${sufijo}`, true);

  const inscribir = async (usuario: string, comunidadId: string, cursos: string[]) => {
    const { data, error } = await admin
      .from("inscripciones")
      .insert({
        usuario_id: usuario,
        comunidad_id: comunidadId,
        estado: "activo",
        todos_los_cursos: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(`inscripcion: ${error.message}`);
    for (const c of cursos) {
      const { error: e } = await admin
        .from("inscripcion_cursos")
        .insert({ inscripcion_id: data.id, curso_id: c });
      if (e) throw new Error(`inscripcion_cursos: ${e.message}`);
    }
  };

  // El alumno de A tiene acceso al publicado Y al borrador. Que aun asi no
  // pueda ver el borrador es justo lo que prueba que el filtro de publicacion
  // es de la base y no del acceso.
  await inscribir(alumnoA.id, comunidadA, [cursoAPublicado, cursoABorrador]);
  await inscribir(alumnoB.id, comunidadB, [cursoB]);

  return {
    duenoA, alumnoA, duenoB, alumnoB, superadmin,
    comunidadA, comunidadB,
    cursoAPublicado, cursoABorrador, cursoASinAcceso, cursoB,
  };
}

export async function desmontar(e: Escenario) {
  await admin.from("comunidades").delete().in("id", [e.comunidadA, e.comunidadB]);
  await limpiarUsuarios([
    e.duenoA.id,
    e.alumnoA.id,
    e.duenoB.id,
    e.alumnoB.id,
    e.superadmin.id,
  ]);
}
