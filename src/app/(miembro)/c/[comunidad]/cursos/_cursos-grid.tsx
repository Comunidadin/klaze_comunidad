"use client";

import { useMemo } from "react";
import { GraduationCap } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses, type CourseConAcceso } from "@/lib/hooks/use-courses";
import { CourseBanner } from "@/components/course/course-banner";
import { CourseTiles } from "@/components/course/course-tiles";
import { EmptyState } from "@/components/shared/empty-state";
import { SiteFooter } from "@/components/shared/site-footer";

export interface CursosGridProps {
  comunidadSlug: string;
}

/** Prefijo de los `id` a los que saltan los accesos rápidos de arriba. */
const ANCLA = "curso";

/**
 * Classroom del área de miembros: franja de accesos rápidos, banners
 * anchos agrupados por acceso y pie de sitio.
 *
 * La separación en dos secciones —lo que ya tienes arriba, lo bloqueado
 * debajo— es la que organiza la pantalla, en vez de una grilla plana donde
 * los cursos con candado compiten por atención con los que el alumno puede
 * abrir ahora mismo. El slug de comunidad llega ya validado por
 * `MemberShell`, así que aquí asumimos `useCommunity` resuelto.
 */
export function CursosGrid({ comunidadSlug }: CursosGridProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");

  const { conAcceso, bloqueados } = useMemo(() => {
    const conAcceso: CourseConAcceso[] = [];
    const bloqueados: CourseConAcceso[] = [];
    for (const curso of cursos) {
      if (curso.acceso === "si") conAcceso.push(curso);
      else bloqueados.push(curso);
    }
    return { conAcceso, bloqueados };
  }, [cursos]);

  if (!resultado) return null;
  const { community } = resultado;

  if (cursos.length === 0) {
    return (
      <EmptyState
        icono={GraduationCap}
        titulo="Todavía no hay cursos"
        descripcion="Cuando el creador de esta comunidad publique un curso, va a aparecer aquí."
      />
    );
  }

  function nombreNivel(curso: CourseConAcceso): string | undefined {
    if (curso.acceso !== "candado-nivel" || !curso.nivelRequerido) return undefined;
    return community.nombresNiveles[curso.nivelRequerido - 1];
  }

  /** Cada curso va precedido de su nombre y lleva el `id` al que apuntan los accesos rápidos. */
  function bloqueCurso(curso: CourseConAcceso) {
    return (
      <div key={curso.id} id={`${ANCLA}-${curso.slug}`} className="scroll-mt-24">
        <p className="mb-2.5 text-sm font-medium text-muted-foreground">{curso.titulo}</p>
        <CourseBanner
          curso={curso}
          comunidadSlug={comunidadSlug}
          nombreNivelRequerido={nombreNivel(curso)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Cursos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todo lo que {community.nombre} tiene para enseñarte, en un solo lugar.
        </p>
      </div>

      <CourseTiles cursos={cursos} anclaPrefijo={ANCLA} />

      {conAcceso.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            Accede ahora
          </h2>
          <div className="space-y-6">{conAcceso.map(bloqueCurso)}</div>
        </section>
      )}

      {bloqueados.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            Amplía tu acceso
          </h2>
          <p className="-mt-2 text-sm text-muted-foreground">
            Cursos de {community.nombre} que todavía no están incluidos en tu acceso.
          </p>
          <div className="space-y-6">{bloqueados.map(bloqueCurso)}</div>
        </section>
      )}

      <SiteFooter
        comunidadSlug={comunidadSlug}
        nombreComunidad={community.nombre}
        logoUrl={community.logoUrl}
        colorAcento={community.colorAcento}
      />
    </div>
  );
}
