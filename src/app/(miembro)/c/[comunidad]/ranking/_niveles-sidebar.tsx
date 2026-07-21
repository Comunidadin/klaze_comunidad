"use client";

import { Heart, Lock } from "lucide-react";
import { useCourses } from "@/lib/hooks/use-courses";
import { LevelBadge } from "@/components/shared/level-badge";
import { Separator } from "@/components/ui/separator";
import { NIVEL_MAXIMO, puntosParaNivel } from "@/lib/levels";
import { cn } from "@/lib/utils";

export interface NivelesSidebarProps {
  comunidadId: string;
  nombresNiveles: string[];
  miNivel: number;
}

/**
 * Tarjeta "Cómo ganar puntos": regla de puntos + escalera de los 9 niveles
 * con su umbral, resaltando el nivel actual del usuario. Si la comunidad
 * tiene cursos con candado por nivel (`nivelRequerido`), agrega la nota de
 * qué se desbloquea en cada nivel — derivado de `useCourses`, nunca
 * hardcodeado.
 */
export function NivelesSidebar({ comunidadId, nombresNiveles, miNivel }: NivelesSidebarProps) {
  const { cursos } = useCourses(comunidadId);

  const cursosPorNivel = new Map<number, string[]>();
  for (const curso of cursos) {
    if (curso.nivelRequerido === null) continue;
    const lista = cursosPorNivel.get(curso.nivelRequerido) ?? [];
    lista.push(curso.titulo);
    cursosPorNivel.set(curso.nivelRequerido, lista);
  }

  return (
    <div className="space-y-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">
          Cómo ganar puntos
        </h2>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-muted/50 p-3">
          <Heart className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-pretty text-muted-foreground">
            Cada <span className="font-medium text-foreground">like recibido</span> en un post o
            comentario suma <span className="font-medium text-foreground">1 punto</span>.
          </p>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="font-display text-sm font-semibold text-foreground">
          Niveles de la comunidad
        </h3>
        <ul className="mt-3 space-y-1">
          {Array.from({ length: NIVEL_MAXIMO }, (_, i) => i + 1).map((nivel) => {
            const esActual = nivel === miNivel;
            const alcanzado = nivel <= miNivel;
            const nombre = nombresNiveles[nivel - 1] ?? `Nivel ${nivel}`;
            const cursosDesbloqueados = cursosPorNivel.get(nivel);

            return (
              <li
                key={nivel}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
                  esActual && "bg-accent/15 ring-1 ring-accent/40"
                )}
              >
                <LevelBadge nivel={nivel} size="sm" className={cn(!alcanzado && "opacity-40")} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm",
                      alcanzado ? "text-foreground" : "text-muted-foreground",
                      esActual && "font-semibold"
                    )}
                  >
                    {nombre}
                    {esActual && <span className="ml-1.5 text-xs text-primary">(tú)</span>}
                  </p>
                  {cursosDesbloqueados && cursosDesbloqueados.length > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Lock className="size-3 shrink-0" aria-hidden="true" />
                      Desbloquea {cursosDesbloqueados.join(", ")}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {puntosParaNivel(nivel)} pts
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
