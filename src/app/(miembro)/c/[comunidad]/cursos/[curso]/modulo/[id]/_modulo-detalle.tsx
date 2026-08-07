"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Clock, Play, SearchX } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useHydrated } from "@/lib/hooks/use-session";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CoursePortada } from "@/components/course/course-portada";
import {
  modulosOrdenados,
  progresoDeModulo,
  leccionParaSeguirDeModulo,
  formatDuracion,
} from "@/components/course/course-utils";
import { cn } from "@/lib/utils";

/**
 * Referencia estable para el caso "sin progreso". Devolver `[]` dentro del
 * selector crearía un array nuevo en cada lectura y rompería el invariante de
 * `useSyncExternalStore` en React 19 (ver CLAUDE.md).
 */
const VACIO: string[] = [];

export interface ModuloDetalleProps {
  comunidadSlug: string;
  cursoSlug: string;
  moduloId: string;
}

function ModuloSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-48 w-full rounded-3xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Pantalla de un módulo: su portada, su progreso y sus lecciones.
 *
 * Existe para que cada módulo tenga **dirección propia**. Antes las lecciones
 * se desplegaban dentro de la portada del curso, y con las filas horizontales
 * eso se rompe: pulsar una tarjeta empujaba hacia abajo todo lo que había
 * debajo y se perdía el sitio donde estabas. Además ahora se puede mandar a
 * alguien el enlace de un módulo concreto, que antes no existía.
 */
export function ModuloDetalle({ comunidadSlug, cursoSlug, moduloId }: ModuloDetalleProps) {
  const hydrated = useHydrated();
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");
  const progresoIds = useAppStore((s) => s.armazon?.progreso ?? VACIO);

  const curso = cursos.find((c) => c.slug === cursoSlug);
  const completadasIds = useMemo(() => new Set(progresoIds), [progresoIds]);

  const { modulo, numero } = useMemo(() => {
    if (!curso) return { modulo: undefined, numero: 0 };
    const lista = modulosOrdenados(curso);
    const i = lista.findIndex((m) => m.id === moduloId);
    return { modulo: lista[i], numero: i + 1 };
  }, [curso, moduloId]);

  if (!hydrated) return <ModuloSkeleton />;

  const volver = `/c/${comunidadSlug}/cursos`;

  // El acceso lo decide la base; aquí solo se explica. Un curso que no cubre tu
  // acceso llega sin módulos, así que `modulo` sale `undefined` igual que si el
  // identificador fuera inventado — y en ambos casos la salida es la misma.
  if (!curso || !modulo) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="No encontramos este módulo"
        descripcion="Puede que se haya movido, o que no esté incluido en tu acceso."
        accion={{ label: "Volver a los cursos", href: volver }}
      />
    );
  }

  const progreso = progresoDeModulo(modulo, completadasIds);
  const siguiente = leccionParaSeguirDeModulo(modulo, completadasIds);
  const totalMin = modulo.lecciones.reduce((acc, l) => acc + l.duracionMin, 0);
  const empezado = progreso.completadas > 0;

  return (
    <div className="space-y-6">
      <Link
        href={volver}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {curso.titulo}
      </Link>

      <div className="relative overflow-hidden rounded-3xl bg-muted">
        <div className="relative aspect-[16/9] w-full sm:aspect-[3/1]">
          <CoursePortada portadaUrl={modulo.portadaUrl ?? ""} titulo={modulo.titulo} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <p className="text-xs font-medium tracking-wider text-white/70 uppercase">
            Módulo {numero}
          </p>
          <h1 className="mt-1 max-w-2xl text-balance font-display text-2xl font-bold text-white sm:text-3xl">
            {modulo.titulo}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {siguiente && (
              <Button asChild size="lg">
                <Link href={`/c/${comunidadSlug}/cursos/${cursoSlug}/leccion/${siguiente.id}`}>
                  <Play /> {empezado ? "Continuar" : "Empezar módulo"}
                </Link>
              </Button>
            )}

            {progreso.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${progreso.pct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-white/80">
                  {progreso.completadas} de {progreso.total} · {progreso.pct}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {modulo.lecciones.length === 0 ? (
        <EmptyState
          icono={Clock}
          titulo="Todavía no hay lecciones"
          descripcion="Este módulo aún se está preparando. Vuelve pronto."
        />
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">
              Lecciones
            </h2>
            <span className="text-xs text-muted-foreground">
              {formatDuracion(totalMin)} en total
            </span>
          </div>

          {/* Tarjetas y no lista: dentro de un módulo, la miniatura es lo que
              distingue una clase de otra de un vistazo. 16:9 porque son
              vídeos —el 2:3 vertical es de los módulos— y sin portada propia
              cae en la del módulo antes que en el degradado. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulo.lecciones.map((leccion, i) => {
              const vista = completadasIds.has(leccion.id);
              return (
                <Link
                  key={leccion.id}
                  href={`/c/${comunidadSlug}/cursos/${cursoSlug}/leccion/${leccion.id}`}
                  className="group overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <CoursePortada
                      portadaUrl={leccion.portadaUrl ?? modulo.portadaUrl ?? ""}
                      titulo={leccion.titulo}
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                    <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {vista ? (
                      <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
                        <CheckCircle2 className="size-3.5" />
                      </span>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-black">
                          <Play className="size-5 fill-current" />
                        </span>
                      </span>
                    )}

                    <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
                      {leccion.duracionMin} min
                    </span>
                  </div>

                  <div className="p-3">
                    <h3
                      className={cn(
                        "line-clamp-2 text-sm leading-snug",
                        vista ? "text-muted-foreground" : "font-medium text-foreground"
                      )}
                    >
                      {leccion.titulo}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
