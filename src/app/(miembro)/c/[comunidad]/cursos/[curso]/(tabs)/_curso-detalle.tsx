"use client";

/**
 * Referencia estable para el caso "sin progreso". Devolver `[]` dentro del
 * selector crearía un array nuevo en cada lectura y rompería el invariante de
 * `useSyncExternalStore` en React 19 (ver CLAUDE.md).
 */
const VACIO: string[] = [];

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Play,
  PlayCircle,
  RotateCcw,
  Video,
} from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDuracion,
  leccionesOrdenadas,
  moduloDeLeccion,
  modulosOrdenados,
  primeraLeccionPendiente,
  progresoDeModulo,
} from "@/components/course/course-utils";
import { CoursePortada } from "@/components/course/course-portada";
import { ModuloCard } from "@/components/course/modulo-card";
import type { Lesson } from "@/lib/types";

export interface CursoDetalleProps {
  comunidadSlug: string;
  cursoSlug: string;
}

/**
 * Pestaña "Lecciones": hero con progreso global y CTA "continuar donde
 * quedaste", grid de portadas de módulo (estilo Netflix/Hotmart Club) con
 * progreso por módulo. Clic en una tarjeta selecciona ese módulo y muestra
 * su lista de lecciones debajo, con scroll suave hasta el panel.
 *
 * `CursoTabsShell` (layout de `(tabs)`) ya garantiza que el curso existe y
 * que el usuario tiene acceso antes de renderizar esta pestaña — acá se
 * asume `curso` resuelto, sin repetir ese chequeo.
 */
export function CursoDetalle({ comunidadSlug, cursoSlug }: CursoDetalleProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");
  const progreso = useAppStore((s) => s.armazon?.progreso ?? VACIO);

  const curso = cursos.find((c) => c.slug === cursoSlug);

  // `armazon.progreso` ya son solo las lecciones de esta persona: RLS no deja
  // ver las de nadie más, así que no hay que filtrar por usuario.
  const leccionesCompletadasIds = useMemo(
    () => new Set(progreso),
    [progreso]
  );

  // Módulo seleccionado en el grid de portadas — la lista de lecciones de
  // abajo se sincroniza con él. `null` hasta que se siembra el default (ver
  // más abajo, mismo patrón de "ajustar estado durante el render" que el
  // editor de cursos).
  const [moduloSeleccionadoId, setModuloSeleccionadoId] = useState<string | null>(null);
  const leccionesPanelRef = useRef<HTMLDivElement>(null);

  if (!resultado || !curso) return null;

  const modulos = modulosOrdenados(curso);
  const lecciones = leccionesOrdenadas(curso);
  const numCompletadas = lecciones.filter((l) => leccionesCompletadasIds.has(l.id)).length;
  const primeraPendiente = primeraLeccionPendiente(curso, leccionesCompletadasIds) ?? undefined;

  let ctaLabel = "Comenzar curso";
  let ctaIcon = Play;
  let ctaLeccion: Lesson | undefined = lecciones[0];

  if (numCompletadas > 0 && primeraPendiente) {
    ctaLabel = "Continuar donde quedaste";
    ctaIcon = PlayCircle;
    ctaLeccion = primeraPendiente;
  } else if (numCompletadas > 0 && !primeraPendiente) {
    ctaLabel = "Volver a ver";
    ctaIcon = RotateCcw;
    ctaLeccion = lecciones[0];
  }

  const CtaIcon = ctaIcon;
  const moduloActivo = ctaLeccion ? moduloDeLeccion(curso, ctaLeccion.id) : undefined;

  // Primera carga: selecciona el módulo con la primera lección pendiente (o
  // el primero del curso si no hay progreso todavía).
  if (moduloSeleccionadoId === null && modulos.length > 0) {
    setModuloSeleccionadoId(moduloActivo?.id ?? modulos[0].id);
  }

  function seleccionarModulo(id: string) {
    setModuloSeleccionadoId(id);
    leccionesPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const moduloSeleccionado = modulos.find((m) => m.id === moduloSeleccionadoId) ?? modulos[0];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-muted">
        <div className="relative aspect-[16/9] w-full sm:aspect-[3/1]">
          <CoursePortada portadaUrl={curso.portadaUrl} titulo={curso.titulo} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <h1 className="max-w-2xl text-balance font-display text-2xl font-bold text-white sm:text-3xl">
            {curso.titulo}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-pretty text-white/80 sm:line-clamp-2">
            {curso.descripcion}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4 sm:gap-6">
            {ctaLeccion && (
              <Button
                asChild
                size="lg"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <Link href={`/c/${comunidadSlug}/cursos/${curso.slug}/leccion/${ctaLeccion.id}`}>
                  <CtaIcon /> {ctaLabel}
                </Link>
              </Button>
            )}

            <div className="flex min-w-36 flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <motion.div
                  className="h-full rounded-full bg-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${curso.progresoPct}%` }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-white/85">
                {numCompletadas}/{lecciones.length} lecciones · {curso.progresoPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de módulos — portadas verticales estilo Netflix/Hotmart Club */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground">Módulos</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {modulos.map((modulo, indice) => (
            <ModuloCard
              key={modulo.id}
              modulo={modulo}
              numero={indice + 1}
              progreso={progresoDeModulo(modulo, leccionesCompletadasIds)}
              seleccionado={modulo.id === moduloSeleccionado?.id}
              onSeleccionar={() => seleccionarModulo(modulo.id)}
            />
          ))}
        </div>
      </div>

      {/* Lecciones del módulo seleccionado */}
      {moduloSeleccionado && (
        <div
          ref={leccionesPanelRef}
          className="scroll-mt-24 rounded-2xl bg-card px-4 ring-1 ring-foreground/10 sm:px-6"
        >
          <div className="flex flex-col gap-0.5 py-4">
            <span className="font-display text-sm font-semibold text-foreground">
              {moduloSeleccionado.titulo}
            </span>
            <span className="text-xs text-muted-foreground">
              {moduloSeleccionado.lecciones.length}{" "}
              {moduloSeleccionado.lecciones.length === 1 ? "lección" : "lecciones"} ·{" "}
              {formatDuracion(moduloSeleccionado.lecciones.reduce((acc, l) => acc + l.duracionMin, 0))}
            </span>
          </div>
          <ul className="space-y-1 pb-4">
            {moduloSeleccionado.lecciones.map((leccion) => {
              const completada = leccionesCompletadasIds.has(leccion.id);
              const TipoIcon = leccion.tipo === "video" ? Video : FileText;
              return (
                <li key={leccion.id}>
                  <Link
                    href={`/c/${comunidadSlug}/cursos/${curso.slug}/leccion/${leccion.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {completada ? (
                      <CheckCircle2 className="size-4 shrink-0 text-brand" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <TipoIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-foreground",
                        completada && "text-muted-foreground line-through decoration-muted-foreground/50"
                      )}
                    >
                      {leccion.titulo}
                    </span>
                    <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
                      <Clock className="size-3" />
                      {leccion.duracionMin} min
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
