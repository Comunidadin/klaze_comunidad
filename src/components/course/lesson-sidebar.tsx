"use client";

import Link from "next/link";
import { CheckCircle2, Circle, FileText, Video } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { moduloDeLeccion, modulosOrdenados } from "@/components/course/course-utils";
import type { CourseConAcceso } from "@/lib/hooks/use-courses";

export interface LessonSidebarProps {
  curso: CourseConAcceso;
  comunidadSlug: string;
  leccionActualId: string;
  leccionesCompletadasIds: Set<string>;
  className?: string;
}

/**
 * Temario del curso: acordeón de módulos con sus lecciones, la lección
 * actual resaltada y un check para las completadas. Se usa tal cual en la
 * columna derecha (desktop) y dentro del `Sheet` móvil — el layout externo
 * (columna vs. hoja) lo decide quien la use.
 */
export function LessonSidebar({
  curso,
  comunidadSlug,
  leccionActualId,
  leccionesCompletadasIds,
  className,
}: LessonSidebarProps) {
  const modulos = modulosOrdenados(curso);
  const moduloActual = moduloDeLeccion(curso, leccionActualId);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="shrink-0 border-b border-border p-4">
        <h2 className="line-clamp-2 font-display text-sm font-semibold text-foreground">
          {curso.titulo}
        </h2>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Progress value={curso.progresoPct} className="h-1.5" />
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {curso.progresoPct}%
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <Accordion
          type="multiple"
          defaultValue={moduloActual ? [moduloActual.id] : modulos[0] ? [modulos[0].id] : []}
        >
          {modulos.map((modulo) => (
            <AccordionItem key={modulo.id} value={modulo.id} className="border-b-0">
              <AccordionTrigger className="px-2 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:no-underline">
                {modulo.titulo}
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <ul className="space-y-0.5">
                  {modulo.lecciones.map((leccion) => {
                    const activa = leccion.id === leccionActualId;
                    const completada = leccionesCompletadasIds.has(leccion.id);
                    const TipoIcon = leccion.tipo === "video" ? Video : FileText;
                    return (
                      <li key={leccion.id}>
                        <Link
                          href={`/c/${comunidadSlug}/cursos/${curso.slug}/leccion/${leccion.id}`}
                          aria-current={activa ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            activa
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          {completada ? (
                            <CheckCircle2 className="size-4 shrink-0 text-accent" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                          )}
                          <TipoIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              completada && !activa && "text-muted-foreground"
                            )}
                          >
                            {leccion.titulo}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
