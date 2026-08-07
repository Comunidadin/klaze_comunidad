"use client";

/**
 * Referencia estable para el caso "sin progreso". Devolver `[]` dentro del
 * selector crearía un array nuevo en cada lectura y rompería el invariante de
 * `useSyncExternalStore` en React 19 (ver CLAUDE.md).
 */
const VACIO: string[] = [];

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  leccionesOrdenadas,
  modulosOrdenados,
  primeraLeccionPendiente,
  progresoDeModulo,
} from "@/components/course/course-utils";
import { CoursePortada } from "@/components/course/course-portada";
import { ModuloCard } from "@/components/course/modulo-card";
import { FilaCursos } from "@/components/course/fila-cursos";
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

      {/* Módulos: fila deslizante, y cada tarjeta lleva a su propia pantalla.
          Antes desplegaban sus lecciones aquí abajo; con la portada de la
          academia ya en filas, mantener dos comportamientos distintos para la
          misma tarjeta confundía más de lo que ahorraba. */}
      <FilaCursos titulo="Módulos">
        {modulos.map((modulo, indice) => (
          <div key={modulo.id} className="w-36 shrink-0 snap-start sm:w-44 lg:w-48">
            <ModuloCard
              modulo={modulo}
              numero={indice + 1}
              progreso={progresoDeModulo(modulo, leccionesCompletadasIds)}
              href={`/c/${comunidadSlug}/cursos/${curso.slug}/modulo/${modulo.id}`}
            />
          </div>
        ))}
      </FilaCursos>

    </div>
  );
}
