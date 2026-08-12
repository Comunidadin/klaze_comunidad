"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Layers, Lock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { estadisticasCurso, formatDuracion } from "@/components/course/course-utils";
import { CoursePortada } from "@/components/course/course-portada";
import type { CourseConAcceso } from "@/lib/hooks/use-courses";
import { textoDeApertura } from "@/lib/goteo";

export interface CourseCardProps {
  curso: CourseConAcceso;
  /** Slug de la comunidad, para armar el link al detalle. */
  comunidadSlug: string;
  /** Solo cuando `curso.acceso === "candado-nivel"`: nombre del nivel requerido. */
  nombreNivelRequerido?: string;
}

/**
 * Mide el tamaño renderizado de un nodo (y su `border-radius` calculado) en
 * vivo, para que el perímetro SVG del progreso pueda dibujarse en píxeles
 * exactos sobre el borde real de la tarjeta — sin esto, escalar un viewBox
 * fijo con `preserveAspectRatio="none"` deformaría las esquinas.
 */
function useMedidaTarjeta<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [medida, setMedida] = useState({ width: 0, height: 0, radius: 0 });

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    function medir() {
      if (!nodo) return;
      const { width, height } = nodo.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(nodo).borderRadius) || 0;
      setMedida({ width, height, radius });
    }

    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  return { ref, ...medida };
}

const GROSOR_TRAZO = 2.5;

/**
 * Tarjeta de curso — firma visual de Comunidad del Intercambio: el borde redondeado se dibuja
 * como un perímetro SVG animado según `progresoPct`. Portada Unsplash,
 * overlay de candado cuando no hay acceso (por nivel o sin enrollment).
 */
export function CourseCard({ curso, comunidadSlug, nombreNivelRequerido }: CourseCardProps) {
  const { ref, width, height, radius } = useMedidaTarjeta<HTMLDivElement>();
  const { numLecciones, totalMin } = estadisticasCurso(curso);
  const numSubmodulos = curso.modulos.length;

  const bloqueado = curso.acceso !== "si";
  const conProgreso = !bloqueado && curso.progresoPct > 0;
  const completado = conProgreso && curso.progresoPct >= 100;
  const inset = GROSOR_TRAZO / 2;

  const tarjeta = (
    <div
      ref={ref}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 transition-shadow duration-300",
        !bloqueado && "hover:shadow-lg hover:shadow-primary/5",
        completado && "shadow-[0_0_0_1px_var(--brand)]"
      )}
    >
      {conProgreso && width > 0 && height > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 z-20"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          fill="none"
          aria-hidden="true"
        >
          <motion.rect
            x={inset}
            y={inset}
            width={Math.max(width - GROSOR_TRAZO, 0)}
            height={Math.max(height - GROSOR_TRAZO, 0)}
            rx={Math.max(radius - inset, 0)}
            className={cn("stroke-brand", completado && "drop-shadow-[0_0_5px_var(--brand)]")}
            strokeWidth={GROSOR_TRAZO}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: curso.progresoPct / 100 }}
            transition={{ duration: 1.1, ease: "easeInOut", delay: 0.1 }}
          />
        </svg>
      )}

      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
        <CoursePortada
          portadaUrl={curso.portadaUrl}
          titulo={curso.titulo}
          className={cn(
            "transition-transform duration-500",
            !bloqueado && "group-hover:scale-105",
            bloqueado && "scale-105 opacity-50 saturate-50 blur-[1px]"
          )}
        />

        {bloqueado && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 px-4 text-center backdrop-blur-[2px]">
            <span className="flex size-10 items-center justify-center rounded-full bg-background/95 text-foreground ring-1 ring-foreground/10">
              <Lock className="size-4.5" />
            </span>
            {curso.acceso === "candado-nivel" ? (
              <p className="max-w-[14rem] text-xs font-medium text-balance text-foreground">
                Se desbloquea en nivel {curso.nivelRequerido}
                {nombreNivelRequerido ? ` — ${nombreNivelRequerido}` : ""}
              </p>
            ) : curso.acceso === "candado-fecha" && curso.abreEl ? (
              // Un candado sin fecha es una puerta cerrada sin cartel, y la
              // fecha es justo lo que hace que el goteo retenga en vez de
              // frustrar.
              <p className="max-w-[14rem] text-xs font-medium text-balance text-foreground">
                {textoDeApertura(curso.abreEl, new Date())}
              </p>
            ) : (
              <>
                <p className="text-xs font-medium text-foreground">No tienes acceso</p>
                <p className="text-[11px] text-muted-foreground">
                  Valor referencial: ${curso.precioReferencial}
                </p>
              </>
            )}
          </div>
        )}

        {conProgreso && (
          <Badge
            className={cn(
              "absolute top-2 right-2 z-20 gap-1 border-0",
              completado ? "bg-brand text-brand-foreground" : "bg-background/90 text-foreground"
            )}
          >
            {completado ? (
              <>
                <CheckCircle2 className="size-3" /> Completado
              </>
            ) : (
              `${curso.progresoPct}%`
            )}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 font-display text-base leading-snug font-semibold text-foreground">
          {curso.titulo}
        </h3>
        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3.5" />
            {numSubmodulos} {numSubmodulos === 1 ? "submódulo" : "submódulos"}
          </span>
          <span className="inline-flex items-center gap-1">
            <PlayCircle className="size-3.5" />
            {numLecciones} {numLecciones === 1 ? "clase" : "clases"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatDuracion(totalMin)}
          </span>
        </div>
      </div>
    </div>
  );

  if (bloqueado) {
    return (
      <div aria-disabled="true" className="h-full cursor-not-allowed">
        {tarjeta}
      </div>
    );
  }

  return (
    <Link
      href={`/c/${comunidadSlug}/cursos/${curso.slug}`}
      className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {tarjeta}
    </Link>
  );
}
