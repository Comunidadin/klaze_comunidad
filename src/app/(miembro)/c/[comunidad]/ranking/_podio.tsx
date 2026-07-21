"use client";

import { Crown } from "lucide-react";
import { LevelBadge } from "@/components/shared/level-badge";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { RankingEntry } from "@/lib/hooks/use-gamification";

export interface PodioProps {
  /** Los primeros 1-3 puestos del periodo activo (puede tener menos de 3 si la comunidad es chica). */
  entries: RankingEntry[];
  miUserId?: string;
}

// Tarjeta visual por puesto — separada del pedestal para poder alinear los
// tres pedestales por abajo (items-end) manteniendo alturas distintas.
const RANGO_ESTILOS = {
  1: {
    avatarRing: "ring-accent",
    avatarSize: "size-20 sm:size-24",
    numeral: "text-accent/25",
    pedestal: "h-28 sm:h-32 bg-accent/15 ring-accent/40 text-foreground",
    orden: "order-2",
  },
  2: {
    avatarRing: "ring-foreground/20",
    avatarSize: "size-14 sm:size-16",
    numeral: "text-muted-foreground/20",
    pedestal: "h-18 sm:h-20 bg-muted ring-border text-foreground",
    orden: "order-1",
  },
  3: {
    avatarRing: "ring-amber-600/40 dark:ring-amber-400/30",
    avatarSize: "size-14 sm:size-16",
    numeral: "text-amber-600/15 dark:text-amber-400/15",
    pedestal:
      "h-14 sm:h-16 bg-amber-500/10 ring-amber-600/25 text-foreground dark:bg-amber-400/10 dark:ring-amber-400/25",
    orden: "order-3",
  },
} as const;

/**
 * Podio del top 3: pedestales de altura decreciente (2º-1º-3º), avatar
 * grande con numeral gigante translúcido detrás, `LevelBadge` y puntos
 * animados. El acento lima queda reservado al primer puesto (corona + ring
 * + pedestal) — 2º y 3º usan plata/bronce neutros para no diluirlo.
 */
export function Podio({ entries, miUserId }: PodioProps) {
  if (entries.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {entries.map((entry) => {
        const puesto = entry.posicion as 1 | 2 | 3;
        const estilos = RANGO_ESTILOS[puesto] ?? RANGO_ESTILOS[3];
        const esPrimero = puesto === 1;
        const esYo = entry.user.id === miUserId;

        return (
          <div
            key={entry.user.id}
            className={cn("flex flex-col items-center gap-3", estilos.orden)}
          >
            <div className="flex flex-col items-center gap-1.5">
              {esPrimero && (
                <Crown className="size-5 fill-accent text-accent" aria-hidden="true" />
              )}
              <div className={cn("relative flex items-center justify-center", estilos.avatarSize)}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 -z-10 flex items-center justify-center font-display text-6xl font-bold sm:text-7xl",
                    estilos.numeral
                  )}
                >
                  {puesto}
                </span>
                <Avatar
                  className={cn(
                    estilos.avatarSize,
                    "ring-2",
                    estilos.avatarRing,
                    esYo && "ring-primary"
                  )}
                >
                  <AvatarImage src={entry.user.avatarUrl} alt={entry.user.nombre} />
                  <AvatarFallback>{entry.user.nombre[0]}</AvatarFallback>
                </Avatar>
                <LevelBadge
                  nivel={entry.nivel}
                  size={esPrimero ? "md" : "sm"}
                  className="absolute -right-1.5 -bottom-1.5"
                />
              </div>
              <p className="max-w-24 truncate text-center font-display text-sm font-semibold text-foreground sm:max-w-28">
                {entry.user.nombre}
              </p>
              {esYo && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Tú
                </span>
              )}
            </div>

            <div
              className={cn(
                "flex w-20 flex-col items-center justify-end gap-0.5 rounded-t-xl pt-3 pb-2 ring-1 sm:w-28",
                estilos.pedestal
              )}
            >
              <AnimatedCounter
                value={entry.puntos}
                className="font-display text-lg font-bold sm:text-xl"
              />
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                puntos
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
