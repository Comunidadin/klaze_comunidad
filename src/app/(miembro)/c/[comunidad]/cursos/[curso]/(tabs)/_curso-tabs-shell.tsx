"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, SearchX } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { EmptyState } from "@/components/shared/empty-state";
import { CoursePortada } from "@/components/course/course-portada";
import { cn } from "@/lib/utils";

export interface CursoTabsShellProps {
  comunidadSlug: string;
  cursoSlug: string;
  children: React.ReactNode;
}

const TABS = [
  { label: "Clases", segmento: "" },
  { label: "Comunidad", segmento: "comunidad" },
  { label: "Calendario", segmento: "calendario" },
  { label: "Miembros", segmento: "miembros" },
  { label: "Ranking", segmento: "ranking" },
] as const;

/**
 * Cabecera + pestañas compartidas de un curso (Cambio 3: la comunidad social
 * pasa a vivir dentro de cada curso): "← Vitrinas" + portada pequeña/título +
 * las 5 pestañas (Lecciones/Comunidad/Calendario/Miembros/Ranking). Gatea
 * "vitrina no encontrada" / "sin acceso" UNA SOLA VEZ acá — reutiliza
 * `useCourses` (mismo criterio de `CourseConAcceso.acceso` que ya aplican
 * `CursoDetalle`/`LeccionDetalle`) — así ninguna de las 5 pestañas necesita
 * repetir ese chequeo. El reproductor de lección (`/leccion/[id]`) vive
 * fuera de este grupo de rutas a propósito (no lleva esta cabecera/pestañas)
 * y sigue resolviendo su propio gate como antes.
 */
export function CursoTabsShell({ comunidadSlug, cursoSlug, children }: CursoTabsShellProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");
  const pathname = usePathname();

  if (!resultado) return null;
  const { community } = resultado;

  const curso = cursos.find((c) => c.slug === cursoSlug);
  const base = `/c/${comunidadSlug}/cursos/${cursoSlug}`;

  if (!curso) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="Vitrina no encontrada"
        descripcion="La vitrina que buscas no existe o fue eliminado."
        accion={{ label: "Volver a vitrinas", href: `/c/${comunidadSlug}/cursos` }}
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
        titulo={curso.acceso === "candado-nivel" ? "Esta vitrina está bloqueado" : "No tienes acceso a esta vitrina"}
        descripcion={
          curso.acceso === "candado-nivel"
            ? `Se desbloquea en nivel ${curso.nivelRequerido}${nombreNivel ? ` — ${nombreNivel}` : ""}. Sigue participando en la comunidad para subir de nivel.`
            : `Habla con el equipo de ${community.nombre} para obtener acceso. Valor referencial: $${curso.precioReferencial}.`
        }
        accion={{ label: "Volver a vitrinas", href: `/c/${comunidadSlug}/cursos` }}
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
          ← Cursos
        </Link>
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg">
            <CoursePortada portadaUrl={curso.portadaUrl} titulo={curso.titulo} />
          </div>
          <h1 className="min-w-0 truncate font-display text-xl font-bold tracking-tight text-foreground">
            {curso.titulo}
          </h1>
        </div>

        <nav className="mt-4 flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const href = tab.segmento ? `${base}/${tab.segmento}` : base;
            const activo =
              tab.segmento === "comunidad"
                ? pathname === href || (pathname?.startsWith(`${href}/`) ?? false)
                : pathname === href;
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  activo && "bg-primary/10 text-primary"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
