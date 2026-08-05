"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import type { CourseConAcceso } from "@/lib/hooks/use-courses";
import { cn } from "@/lib/utils";

export interface CourseTilesProps {
  cursos: CourseConAcceso[];
  /** Prefijo del `id` que llevan las tarjetas ancla en la página. */
  anclaPrefijo: string;
}

function Tile({ curso, anclaPrefijo }: { curso: CourseConAcceso; anclaPrefijo: string }) {
  const [portadaFallo, setPortadaFallo] = useState(false);
  const tieneAcceso = curso.acceso === "si";

  return (
    <a
      href={`#${anclaPrefijo}-${curso.slug}`}
      className="group relative isolate flex aspect-16/10 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border transition-shadow outline-none hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="absolute inset-0 bg-linear-to-br from-primary to-brand" />
      {curso.portadaUrl && !portadaFallo && (
        // eslint-disable-next-line @next/next/no-img-element -- URL libre del creador; next/image exigiría allowlist de dominios
        <img
          src={curso.portadaUrl}
          alt=""
          aria-hidden="true"
          onError={() => setPortadaFallo(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105",
            tieneAcceso ? "grayscale" : "grayscale brightness-75"
          )}
        />
      )}
      {tieneAcceso && <div className="absolute inset-0 bg-brand mix-blend-color" />}
      <div className="absolute inset-0 bg-black/70" />

      <span className="relative flex items-center gap-1.5 px-3 text-center font-display text-sm font-bold tracking-tight text-balance text-white">
        {!tieneAcceso && <Lock className="size-3.5 shrink-0 text-white/60" aria-hidden="true" />}
        {curso.titulo}
      </span>
    </a>
  );
}

/**
 * Franja de accesos rápidos del classroom: una tarjeta por curso, arriba de
 * todo, para saltar a su banner sin recorrer la página.
 *
 * Son anclas dentro de la misma página en vez de enlaces al curso a
 * propósito: así funcionan igual para los cursos bloqueados, que no tienen
 * a dónde navegar, y ninguna tarjeta lleva a una pantalla que el guard de
 * acceso vaya a rechazar.
 */
export function CourseTiles({ cursos, anclaPrefijo }: CourseTilesProps) {
  if (cursos.length === 0) return null;

  return (
    <nav aria-label="Accesos rápidos a los cursos">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cursos.map((curso) => (
          <li key={curso.id}>
            <Tile curso={curso} anclaPrefijo={anclaPrefijo} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
