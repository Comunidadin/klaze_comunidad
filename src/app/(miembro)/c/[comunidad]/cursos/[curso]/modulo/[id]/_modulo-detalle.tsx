"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Circle, Clock, Play, SearchX } from "lucide-react";
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

          <ul className="divide-y divide-border overflow-hidden rounded-2xl ring-1 ring-foreground/10">
            {modulo.lecciones.map((leccion, i) => {
              const vista = completadasIds.has(leccion.id);
              return (
                <li key={leccion.id}>
                  <Link
                    href={`/c/${comunidadSlug}/cursos/${cursoSlug}/leccion/${leccion.id}`}
                    className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-accent"
                  >
                    {vista ? (
                      <CheckCircle2 className="size-4 shrink-0 text-brand" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        vista ? "text-muted-foreground" : "font-medium text-foreground"
                      )}
                    >
                      {leccion.titulo}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {leccion.duracionMin} min
                    </span>
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
