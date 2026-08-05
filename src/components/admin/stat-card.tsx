import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardDelta {
  /** Cambio respecto al periodo anterior. Positivo = mejora, negativo = baja. */
  valor: number;
  /** Texto tras el número, p. ej. "vs. semana pasada". Default genérico. */
  etiqueta?: string;
}

export interface StatCardProps {
  titulo: string;
  valor: string | number;
  delta?: StatCardDelta;
  icono?: LucideIcon;
  className?: string;
}

/**
 * Tarjeta de métrica del admin: número tabular grande + delta opcional con
 * flecha/color. Firma mínima a propósito — la reutilizan T14 (reportes) y
 * T15 (panel de plataforma), que le pasan deltas reales con más contexto
 * temporal; el dashboard de T12 la usa sin `delta` para la mayoría de sus
 * tarjetas porque los mocks no tienen una serie histórica que comparar.
 */
export function StatCard({ titulo, valor, delta, icono: Icono, className }: StatCardProps) {
  const esPositivo = delta !== undefined && delta.valor >= 0;

  return (
    <Card className={cn(className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{titulo}</p>
          <p className="mt-1.5 font-display text-3xl font-bold tabular-nums text-foreground">
            {valor}
          </p>
          {delta && (
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 text-xs font-medium",
                esPositivo ? "text-brand" : "text-destructive"
              )}
            >
              {esPositivo ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {esPositivo ? "+" : ""}
              {delta.valor} {delta.etiqueta ?? "vs. periodo anterior"}
            </p>
          )}
        </div>
        {Icono && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icono className="size-4.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
