import { cn } from "@/lib/utils";

const HEXAGONO = "polygon(50% 2%, 93% 26%, 93% 74%, 50% 98%, 7% 74%, 7% 26%)";

const TAMANOS: Record<"sm" | "md" | "lg", string> = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-sm",
  lg: "size-12 text-lg",
};

export interface LevelBadgeProps {
  /** Nivel 1-9 (ver `src/lib/levels.ts`). */
  nivel: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Badge hexagonal de nivel, acento lima — firma visual de la gamificación Comunidad del Intercambio. */
export function LevelBadge({ nivel, size = "md", className }: LevelBadgeProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", TAMANOS[size], className)}
      role="img"
      aria-label={`Nivel ${nivel}`}
      title={`Nivel ${nivel}`}
    >
      <span
        className="absolute inset-0 bg-brand drop-shadow-sm"
        style={{ clipPath: HEXAGONO }}
      />
      <span className="relative flex size-full items-center justify-center font-display font-bold tabular-nums text-brand-foreground">
        {nivel}
      </span>
    </span>
  );
}
