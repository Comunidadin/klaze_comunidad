"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Lock,
  Play,
  PlayCircle,
  RotateCcw,
  SearchX,
  Video,
} from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useSession } from "@/lib/hooks/use-session";
import { useKlazeStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { formatDuracion, leccionesOrdenadas } from "@/components/course/course-utils";
import type { Course, CourseModule, Lesson } from "@/lib/types";

export interface CursoDetalleProps {
  comunidadSlug: string;
  cursoSlug: string;
}

function moduloDeLeccion(curso: Course, leccionId: string): CourseModule | undefined {
  return curso.modulos.find((m) => m.lecciones.some((l) => l.id === leccionId));
}

/** Módulos ordenados, cada uno con sus lecciones ordenadas y duración total. */
function modulosOrdenados(curso: Course): CourseModule[] {
  return [...curso.modulos]
    .sort((a, b) => a.orden - b.orden)
    .map((m) => ({ ...m, lecciones: [...m.lecciones].sort((x, y) => x.orden - y.orden) }));
}

/**
 * Detalle de un curso: hero con progreso global y CTA "continuar donde
 * quedaste", acordeón de módulos/lecciones. Si el curso no existe o el
 * usuario no tiene acceso, muestra un `EmptyState` en su lugar — nunca la
 * estructura interna del curso.
 */
export function CursoDetalle({ comunidadSlug, cursoSlug }: CursoDetalleProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");
  const { user } = useSession();
  const progreso = useKlazeStore((s) => s.progreso);

  const curso = cursos.find((c) => c.slug === cursoSlug);

  const leccionesCompletadasIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(progreso.filter((p) => p.userId === user.id).map((p) => p.leccionId));
  }, [progreso, user]);

  if (!resultado) return null;
  const { community } = resultado;

  if (!curso) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="Curso no encontrado"
        descripcion="El curso que buscas no existe o fue eliminado."
        accion={{ label: "Volver a cursos", href: `/c/${comunidadSlug}/cursos` }}
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
        titulo={curso.acceso === "candado-nivel" ? "Este curso está bloqueado" : "No tienes acceso a este curso"}
        descripcion={
          curso.acceso === "candado-nivel"
            ? `Se desbloquea en nivel ${curso.nivelRequerido}${nombreNivel ? ` — ${nombreNivel}` : ""}. Sigue participando en la comunidad para subir de nivel.`
            : `Habla con el equipo de ${community.nombre} para obtener acceso. Valor referencial: $${curso.precioReferencial}.`
        }
        accion={{ label: "Volver a cursos", href: `/c/${comunidadSlug}/cursos` }}
        className="mx-auto max-w-lg"
      />
    );
  }

  const modulos = modulosOrdenados(curso);
  const lecciones = leccionesOrdenadas(curso);
  const numCompletadas = lecciones.filter((l) => leccionesCompletadasIds.has(l.id)).length;
  const primeraPendiente = lecciones.find((l) => !leccionesCompletadasIds.has(l.id));

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

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-muted">
        <div className="relative aspect-[16/9] w-full sm:aspect-[3/1]">
          <Image
            src={curso.portadaUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <Link
            href={`/c/${comunidadSlug}/cursos`}
            className="mb-2 inline-block text-xs font-medium text-white/70 hover:text-white hover:underline"
          >
            ← Todos los cursos
          </Link>
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
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Link href={`/c/${comunidadSlug}/cursos/${curso.slug}/leccion/${ctaLeccion.id}`}>
                  <CtaIcon /> {ctaLabel}
                </Link>
              </Button>
            )}

            <div className="flex min-w-36 flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <motion.div
                  className="h-full rounded-full bg-accent"
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

      {/* Módulos */}
      <div className="rounded-2xl bg-card px-4 ring-1 ring-foreground/10 sm:px-6">
        <Accordion
          type="multiple"
          defaultValue={moduloActivo ? [moduloActivo.id] : modulos[0] ? [modulos[0].id] : []}
        >
          {modulos.map((modulo) => {
            const duracionModulo = modulo.lecciones.reduce((acc, l) => acc + l.duracionMin, 0);
            return (
              <AccordionItem key={modulo.id} value={modulo.id}>
                <AccordionTrigger>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-display text-sm font-semibold text-foreground">
                      {modulo.titulo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {modulo.lecciones.length}{" "}
                      {modulo.lecciones.length === 1 ? "lección" : "lecciones"} ·{" "}
                      {formatDuracion(duracionModulo)}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1">
                    {modulo.lecciones.map((leccion) => {
                      const completada = leccionesCompletadasIds.has(leccion.id);
                      const TipoIcon = leccion.tipo === "video" ? Video : FileText;
                      return (
                        <li key={leccion.id}>
                          <Link
                            href={`/c/${comunidadSlug}/cursos/${curso.slug}/leccion/${leccion.id}`}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {completada ? (
                              <CheckCircle2 className="size-4 shrink-0 text-accent" />
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
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
