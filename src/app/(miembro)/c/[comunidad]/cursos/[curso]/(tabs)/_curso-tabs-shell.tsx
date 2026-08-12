"use client";

import Link from "next/link";
import { Lock, SearchX } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { EmptyState } from "@/components/shared/empty-state";
import { CoursePortada } from "@/components/course/course-portada";
import { textoDeApertura } from "@/lib/goteo";

export interface CursoTabsShellProps {
  comunidadSlug: string;
  cursoSlug: string;
  children: React.ReactNode;
}

/**
 * Cabecera + pestañas compartidas de un curso (Cambio 3: la comunidad social
 * pasa a vivir dentro de cada curso): "← Módulos" + portada pequeña/título +
 * las 5 pestañas (Lecciones/Comunidad/Calendario/Miembros/Ranking). Gatea
 * "módulo no encontrado" / "sin acceso" UNA SOLA VEZ acá — reutiliza
 * `useCourses` (mismo criterio de `CourseConAcceso.acceso` que ya aplican
 * `CursoDetalle`/`LeccionDetalle`) — así ninguna de las 5 pestañas necesita
 * repetir ese chequeo. El reproductor de lección (`/leccion/[id]`) vive
 * fuera de este grupo de rutas a propósito (no lleva esta cabecera/pestañas)
 * y sigue resolviendo su propio gate como antes.
 */
export function CursoTabsShell({ comunidadSlug, cursoSlug, children }: CursoTabsShellProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");

  if (!resultado) return null;
  const { community } = resultado;

  const curso = cursos.find((c) => c.slug === cursoSlug);

  if (!curso) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="Módulo no encontrado"
        descripcion="El módulo que buscas no existe o fue eliminado."
        accion={{ label: "Volver a módulos", href: `/c/${comunidadSlug}/cursos` }}
        className="mx-auto max-w-lg"
      />
    );
  }

  // El caso concreto gana al genérico: sin esto, un alumno con goteo por
  // fecha caería en «No tienes acceso» con el precio de compra — y este
  // alumno ya pagó, solo tiene que esperar a que se abra.
  if (curso.acceso === "candado-fecha" && curso.abreEl) {
    return (
      <EmptyState
        icono={Lock}
        titulo="Este módulo todavía no está abierto"
        descripcion={`${textoDeApertura(curso.abreEl, new Date())}. Vuelve cuando se abra para ver sus clases.`}
        accion={{ label: "Volver a módulos", href: `/c/${comunidadSlug}/cursos` }}
        className="mx-auto max-w-lg"
      />
    );
  }

  if (curso.acceso !== "si") {
    const nombreNivel =
      curso.acceso === "candado-nivel" && curso.nivelRequerido
        ? community.nombresNiveles[curso.nivelRequerido - 1]
        : null;

    return (
      <EmptyState
        icono={Lock}
        titulo={curso.acceso === "candado-nivel" ? "Este módulo está bloqueado" : "No tienes acceso a este módulo"}
        descripcion={
          curso.acceso === "candado-nivel"
            ? `Se desbloquea en nivel ${curso.nivelRequerido}${nombreNivel ? ` — ${nombreNivel}` : ""}. Sigue participando en la comunidad para subir de nivel.`
            : `Habla con el equipo de ${community.nombre} para obtener acceso. Valor referencial: $${curso.precioReferencial}.`
        }
        accion={{ label: "Volver a módulos", href: `/c/${comunidadSlug}/cursos` }}
        className="mx-auto max-w-lg"
      />
    );
  }

  return (
    <div>
      <div className="mb-6 border-b border-border pb-4">
        <Link
          href={`/c/${comunidadSlug}/cursos`}
          className="mb-2 inline-block text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Módulos
        </Link>
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg">
            <CoursePortada portadaUrl={curso.portadaUrl} titulo={curso.titulo} />
          </div>
          <h1 className="min-w-0 truncate font-display text-xl font-bold tracking-tight text-foreground">
            {curso.titulo}
          </h1>
        </div>

      </div>

      {children}
    </div>
  );
}
