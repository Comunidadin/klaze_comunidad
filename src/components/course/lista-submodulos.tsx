"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlayCircle, Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CoursePortada } from "@/components/course/course-portada";
import { progresoDeModulo } from "@/components/course/course-utils";
import { cn } from "@/lib/utils";
import type { CourseModule } from "@/lib/types";

type Filtro = "todos" | "en-curso" | "completados";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "en-curso", etiqueta: "En curso" },
  { valor: "completados", etiqueta: "Completados" },
];

export interface ListaSubmodulosProps {
  submodulos: CourseModule[];
  completadasIds: Set<string>;
  hrefDe: (submodulo: CourseModule) => string;
  className?: string;
}

/** Quita tildes para que "trafico" encuentre "Tráfico". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Los submódulos de un módulo, en lista numerada, con buscador y filtros.
 *
 * Lista y no cuadrícula de portadas: con nueve submódulos —los que tiene la
 * academia de referencia— una fila que se desliza obliga a recorrer de lado
 * para ver lo que hay, mientras que en una lista entran todos de golpe y se
 * comparan de un vistazo por su porcentaje.
 *
 * El buscador aparece **solo si hay suficientes** para justificarlo: un
 * buscador sobre tres elementos es ruido, y enseña que los controles de esta
 * app sobran.
 */
export function ListaSubmodulos({
  submodulos,
  completadasIds,
  hrefDe,
  className,
}: ListaSubmodulosProps) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const conProgreso = useMemo(
    () =>
      submodulos.map((m) => ({ submodulo: m, progreso: progresoDeModulo(m, completadasIds) })),
    [submodulos, completadasIds]
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return conProgreso.filter(({ submodulo, progreso }) => {
      if (q && !normalizar(submodulo.titulo).includes(q)) return false;
      if (filtro === "completados") return progreso.total > 0 && progreso.pct >= 100;
      if (filtro === "en-curso") return progreso.pct > 0 && progreso.pct < 100;
      return true;
    });
  }, [conProgreso, busqueda, filtro]);

  // Con pocos, los controles ocupan más sitio del que ahorran.
  const conControles = submodulos.length >= 5;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">Submódulos</h2>
          <span className="text-sm text-muted-foreground">{submodulos.length}</span>
        </div>

        {conControles && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar submódulo"
                className="h-9 pl-8"
              />
            </div>

            <div className="flex gap-1">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setFiltro(f.valor)}
                  aria-pressed={filtro === f.valor}
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    filtro === f.valor
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {f.etiqueta}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border py-10 text-center">
          <SearchX className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {busqueda
              ? `Ningún submódulo coincide con "${busqueda}".`
              : filtro === "completados"
                ? "Todavía no has completado ninguno."
                : "No tienes ninguno empezado."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visibles.map(({ submodulo, progreso }) => {
            // El número es la posición REAL en el temario, no la de la lista
            // filtrada: buscar no debe renumerar el contenido.
            const numero = submodulos.findIndex((m) => m.id === submodulo.id) + 1;
            const completo = progreso.total > 0 && progreso.pct >= 100;

            return (
              <li key={submodulo.id}>
                <Link
                  href={hrefDe(submodulo)}
                  className="group flex items-center gap-3 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:gap-4"
                >
                  <span className="w-8 shrink-0 text-center font-display text-sm font-semibold tabular-nums text-muted-foreground sm:w-12 sm:text-base">
                    {numero}
                  </span>

                  <div className="relative aspect-video w-24 shrink-0 overflow-hidden sm:w-36">
                    <CoursePortada
                      portadaUrl={submodulo.portadaUrl ?? ""}
                      titulo={submodulo.titulo}
                    />
                  </div>

                  <div className="min-w-0 flex-1 py-3 pr-3 sm:py-4 sm:pr-4">
                    <h3 className="truncate text-sm font-medium text-foreground sm:text-base">
                      {submodulo.titulo}
                    </h3>

                    <div className="mt-1.5 flex items-center gap-2.5">
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <PlayCircle className="size-3.5" />
                        {submodulo.lecciones.length}
                      </span>

                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-500",
                            completo ? "bg-brand" : "bg-primary"
                          )}
                          style={{ width: `${progreso.pct}%` }}
                        />
                      </div>

                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {progreso.pct}%
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
