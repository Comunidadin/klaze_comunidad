"use client";

import { motion } from "framer-motion";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CoursePortada } from "@/components/course/course-portada";
import type { ProgresoModulo } from "@/components/course/course-utils";
import type { CourseModule } from "@/lib/types";

export interface ModuloCardProps {
  modulo: CourseModule;
  /** Posición 1-based dentro del curso — se muestra como numeral de capítulo. */
  numero: number;
  progreso: ProgresoModulo;
  seleccionado: boolean;
  onSeleccionar: () => void;
}

/**
 * Tarjeta de portada de módulo — grid estilo Netflix/Hotmart Club: portada
 * vertical (~2:3), numeral de capítulo (el orden de los módulos sí importa:
 * es la secuencia real del temario), progreso propio del módulo y estado
 * seleccionado con anillo de acento. Reutiliza `CoursePortada` pasando
 * `portadaUrl ?? ""` — el fallback de gradiente + inicial ya contempla ese
 * caso, así que no hace falta un componente aparte para el módulo.
 */
export function ModuloCard({ modulo, numero, progreso, seleccionado, onSeleccionar }: ModuloCardProps) {
  const completo = progreso.total > 0 && progreso.pct >= 100;
  const conProgreso = progreso.pct > 0;

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      aria-pressed={seleccionado}
      className={cn(
        "group relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-2xl bg-card text-left ring-1 ring-foreground/10 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        seleccionado && "ring-2 ring-accent shadow-lg shadow-accent/15"
      )}
    >
      <CoursePortada
        portadaUrl={modulo.portadaUrl ?? ""}
        titulo={modulo.titulo}
        className="transition-transform duration-500 group-hover:scale-105"
      />

      {/* Scrim: sombreado arriba para el numeral, abajo para título/progreso */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/40" />

      <span
        className="absolute top-2 left-3 font-display text-4xl font-bold text-white/30 select-none"
        aria-hidden="true"
      >
        {String(numero).padStart(2, "0")}
      </span>

      {completo && (
        <Badge className="absolute top-2 right-2 z-10 gap-1 border-0 bg-accent text-accent-foreground">
          <CheckCircle2 className="size-3" /> Completo
        </Badge>
      )}

      <div className="relative mt-auto flex flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 font-display text-sm leading-snug font-semibold text-white">
          {modulo.titulo}
        </h3>
        <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
          <PlayCircle className="size-3 shrink-0" />
          {modulo.lecciones.length} {modulo.lecciones.length === 1 ? "lección" : "lecciones"}
        </span>

        {conProgreso && (
          <div className="mt-0.5 flex flex-col gap-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progreso.pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-medium tabular-nums text-white/70">
              {progreso.completadas}/{progreso.total} · {progreso.pct}%
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
