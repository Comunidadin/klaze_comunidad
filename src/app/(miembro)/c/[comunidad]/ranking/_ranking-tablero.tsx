"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Trophy } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useGamification, type PeriodoRanking, type RankingEntry } from "@/lib/hooks/use-gamification";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { LevelBadge } from "@/components/shared/level-badge";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Podio } from "./_podio";
import { NivelesSidebar } from "./_niveles-sidebar";
import { cn } from "@/lib/utils";

export interface RankingTableroProps {
  comunidadSlug: string;
}

const PERIODOS: { value: PeriodoRanking; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "total", label: "Total" },
];

/** Esqueleto de carga inicial mientras hidrata el store persistido (mismo criterio que el Feed). */
function EsqueletoRanking() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="flex items-end justify-center gap-6">
        <Skeleton className="h-40 w-24 rounded-2xl" />
        <Skeleton className="h-52 w-28 rounded-2xl" />
        <Skeleton className="h-32 w-24 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function DeltaIndicator({ delta }: { delta: RankingEntry["delta"] }) {
  if (delta === "up") {
    return (
      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
        <ArrowUp className="size-3.5" aria-label="Subió en el ranking" />
      </span>
    );
  }
  if (delta === "down") {
    return (
      <span className="inline-flex items-center text-rose-600 dark:text-rose-400">
        <ArrowDown className="size-3.5" aria-label="Bajó en el ranking" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-muted-foreground/60">
      <Minus className="size-3.5" aria-label="Se mantuvo en el ranking" />
    </span>
  );
}

/**
 * Ranking de la comunidad: tabs de periodo (7d/30d/total), podio del top 3 y
 * lista del resto. El slug de comunidad llega ya validado por `MemberShell`,
 * así que aquí asumimos `useCommunity` resuelto.
 *
 * La barra "Tu posición" usa la variante simple sugerida por el brief:
 * sticky/fixed al fondo, siempre visible mientras el usuario tiene una
 * entrada en el ranking activo (en vez de un IntersectionObserver que
 * detecte si su fila específica salió del viewport) — con ~30 miembros mock
 * la lista es corta y el costo de "siempre visible" es bajo, y evita la
 * complejidad extra de observar una fila que puede no existir (top 3 vive en
 * el podio, no en la lista).
 */
export function RankingTablero({ comunidadSlug }: RankingTableroProps) {
  const resultado = useCommunity(comunidadSlug);
  const hydrated = useHydrated();
  const { user } = useSession();
  const [periodo, setPeriodo] = useState<PeriodoRanking>("7d");
  const { rankingPorPeriodo, miNivel } = useGamification(resultado?.community.id ?? "");
  const filaMiaRef = useRef<HTMLLIElement>(null);
  const podioRef = useRef<HTMLDivElement>(null);

  if (!resultado) return null;
  const { community } = resultado;

  const ranking = rankingPorPeriodo[periodo];
  const hayMiembrosConPuntos = rankingPorPeriodo.total.some((e) => e.puntos > 0);
  const miEntrada = user ? ranking.find((e) => e.user.id === user.id) : undefined;

  function irAMiPosicion() {
    const destino = miEntrada && miEntrada.posicion <= 3 ? podioRef.current : filaMiaRef.current;
    destino?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Ranking
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quién suma más puntos en {community.nombre} — 1 like recibido = 1 punto.
        </p>
      </div>

      {!hydrated ? (
        <EsqueletoRanking />
      ) : !hayMiembrosConPuntos ? (
        <EmptyState
          icono={Trophy}
          titulo="Todavía no hay puntos que mostrar"
          descripcion="En cuanto los miembros empiecen a recibir likes en sus posts y comentarios, el ranking se va a llenar acá."
        />
      ) : (
        <>
          <Tabs
            value={periodo}
            onValueChange={(v) => setPeriodo(v as PeriodoRanking)}
            className={cn(miEntrada && "pb-20")}
          >
            <TabsList>
              {PERIODOS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {PERIODOS.map((p) => {
              const entries = rankingPorPeriodo[p.value];
              const top3 = entries.slice(0, 3);
              const resto = entries.slice(3);

              return (
                <TabsContent key={p.value} value={p.value} className="mt-6">
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
                    <div className="min-w-0 space-y-8">
                      <div ref={p.value === periodo ? podioRef : undefined}>
                        <Podio entries={top3} miUserId={user?.id} />
                      </div>

                      {resto.length > 0 && (
                        <ul className="space-y-1.5">
                          {resto.map((entry) => {
                            const esYo = entry.user.id === user?.id;
                            return (
                              <li
                                key={entry.user.id}
                                ref={esYo && p.value === periodo ? filaMiaRef : undefined}
                                className={cn(
                                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                                  esYo
                                    ? "bg-primary/5 ring-1 ring-primary/30"
                                    : "hover:bg-muted/50"
                                )}
                              >
                                <span className="w-6 shrink-0 text-center text-sm font-medium tabular-nums text-muted-foreground">
                                  {entry.posicion}
                                </span>
                                <Avatar>
                                  <AvatarImage src={entry.user.avatarUrl} alt={entry.user.nombre} />
                                  <AvatarFallback>{entry.user.nombre[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {entry.user.nombre}
                                    {esYo && <span className="text-muted-foreground"> (tú)</span>}
                                  </p>
                                  <LevelBadge nivel={entry.nivel} size="sm" className="shrink-0" />
                                </div>
                                {p.value !== "total" && <DeltaIndicator delta={entry.delta} />}
                                <AnimatedCounter
                                  value={entry.puntos}
                                  className="w-12 shrink-0 text-right text-sm font-semibold text-foreground"
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="lg:sticky lg:top-24 lg:self-start">
                      <NivelesSidebar
                        comunidadId={community.id}
                        nombresNiveles={community.nombresNiveles}
                        miNivel={miNivel}
                      />
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>

          {miEntrada && (
            <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 sm:pb-6">
              <button
                type="button"
                onClick={irAMiPosicion}
                className="flex items-center gap-2.5 rounded-full bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/40 backdrop-blur transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">
                  Tu posición: <span className="font-semibold tabular-nums">#{miEntrada.posicion}</span>
                </span>
                <span className="opacity-60">·</span>
                <span className="inline-flex items-baseline gap-1 font-medium">
                  <AnimatedCounter value={miEntrada.puntos} className="font-semibold" /> puntos
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
