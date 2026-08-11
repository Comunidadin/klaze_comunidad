"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEspacios } from "@/lib/hooks/use-espacios";
import { cn } from "@/lib/utils";

export interface EspaciosSidebarProps {
  comunidadId: string;
  comunidadSlug: string;
  /** Curso al que pertenecen estos espacios (Cambio 3: la comunidad social vive dentro de cada curso). */
  /** Cierra el `Sheet` móvil al navegar a un espacio — no aplica en el desktop fijo. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * Nav de "espacios" del feed de un curso, agrupados por sección con título —
 * columna izquierda del layout de 3 columnas de la pestaña Comunidad (ver
 * docstring de `Feed`). Reutilizada tal cual dentro del `Sheet` móvil, así
 * que no asume que vive en una barra fija: quien la posiciona (`Feed`)
 * decide sticky/ancho.
 */
export function EspaciosSidebar({
  comunidadId,
  comunidadSlug,
  onNavigate,
  className,
}: EspaciosSidebarProps) {
  const { secciones } = useEspacios(comunidadId);
  const pathname = usePathname();

  return (
    <nav aria-label="Espacios del curso" className={cn("space-y-5", className)}>
      {secciones.map((seccion) => (
        <div key={seccion.id}>
          <h3 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {seccion.titulo}
          </h3>
          <ul className="mt-1.5 space-y-0.5">
            {seccion.espacios.map((espacio) => {
              const href = `/c/${comunidadSlug}/comunidad/espacio/${espacio.slug}`;
              const activo = pathname === href;
              return (
                <li key={espacio.id}>
                  <Link
                    href={href}
                    aria-current={activo ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      activo && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <span className="shrink-0" aria-hidden="true">
                      {espacio.icono}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{espacio.nombre}</span>
                    {espacio.noLeidos > 0 && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {espacio.noLeidos}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
