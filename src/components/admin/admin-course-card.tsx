"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayCircle, Trash2, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { estadisticasCurso } from "@/components/course/course-utils";
import { CoursePortada } from "@/components/course/course-portada";
import { DialogoEliminarModulo } from "@/components/admin/eliminar-modulo";
import type { CourseConAdmin } from "@/lib/hooks/use-admin-courses";

export interface AdminCourseCardProps {
  curso: CourseConAdmin;
}

/**
 * Tarjeta de curso para `/admin/cursos` — variante propia en vez de una prop
 * `variante="admin"` en `CourseCard` (T7): esa tarjeta está construida
 * alrededor de `CourseConAcceso` (candado por nivel, anillo de progreso,
 * bloqueo) que no tiene sentido en el admin, y forzar ambos casos en un
 * mismo componente hubiera significado un ternario por cada sección
 * (portada, overlay, footer). Comparten igual el mismo lenguaje visual
 * (portada 16:9, radios, ring-1, `CoursePortada` con su fallback) para que
 * ambas listas de cursos se sientan de la misma familia.
 */
export function AdminCourseCard({ curso }: AdminCourseCardProps) {
  const { numLecciones } = estadisticasCurso(curso);
  const [confirmando, setConfirmando] = useState(false);

  return (
    // El botón de eliminar es HERMANO del enlace, no hijo. Un `<button>` dentro
    // de un `<a>` es HTML inválido: el navegador puede reordenar el árbol, y
    // los lectores de pantalla anuncian un solo control donde hay dos.
    <div className="group relative h-full">
      <Link
        href={`/admin/cursos/${curso.id}`}
        className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
            <CoursePortada
              portadaUrl={curso.portadaUrl}
              titulo={curso.titulo}
              className="transition-transform duration-500 group-hover:scale-105"
            />

            <Badge
              className={cn(
                "absolute top-2 right-2 z-10 border-0",
                curso.publicado
                  ? "bg-brand text-brand-foreground"
                  : "bg-background/90 text-foreground"
              )}
            >
              {curso.publicado ? "Publicado" : "Borrador"}
            </Badge>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 p-4">
            <h3 className="line-clamp-2 font-display text-base leading-snug font-semibold text-foreground">
              {curso.titulo}
            </h3>
            <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <PlayCircle className="size-3.5" />
                {numLecciones} {numLecciones === 1 ? "clase" : "clases"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users2 className="size-3.5" />
                {curso.numAlumnos} {curso.numAlumnos === 1 ? "alumno" : "alumnos"}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Siempre visible, no solo al pasar el ratón: en una tableta no hay
          ratón que pasar, y un botón que solo existe con hover no existe. */}
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Eliminar el módulo ${curso.titulo}`}
        className="absolute top-2 left-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Trash2 className="size-4" />
      </button>

      <DialogoEliminarModulo
        curso={curso}
        numAlumnos={curso.numAlumnos}
        abierto={confirmando}
        onOpenChange={setConfirmando}
        // Nada que hacer: al recargar el armazón, esta tarjeta desaparece de la
        // cuadrícula sola.
        onEliminado={() => setConfirmando(false)}
      />
    </div>
  );
}
