"use client";

import { GraduationCap } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { CourseCard } from "@/components/course/course-card";
import { EmptyState } from "@/components/shared/empty-state";

export interface CursosGridProps {
  comunidadSlug: string;
}

/**
 * Grid de cursos del área de miembros. El slug de comunidad llega ya
 * validado por `MemberShell` (que muestra su propio `EmptyState` si no
 * existe), así que aquí asumimos `useCommunity` resuelto.
 */
export function CursosGrid({ comunidadSlug }: CursosGridProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Cursos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todo lo que {community.nombre} tiene para enseñarte, en un solo lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cursos.map((curso) => (
          <CourseCard
            key={curso.id}
            curso={curso}
            comunidadSlug={comunidadSlug}
            nombreNivelRequerido={
              curso.acceso === "candado-nivel" && curso.nivelRequerido
                ? community.nombresNiveles[curso.nivelRequerido - 1]
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
