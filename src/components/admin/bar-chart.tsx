"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BarChartDatum {
  etiqueta: string;
  valor: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** Si se pasa, envuelve el gráfico en un `Card` con este título. */
  titulo?: string;
  /** Sufijo del tooltip nativo, ej. "%" o " clases". */
  sufijo?: string;
  className?: string;
}

const ALTURA_PX = 176;
/** Altura mínima visible (%) para que una barra en 0 siga siendo un "trazo", no desaparezca del todo. */
const ALTURA_MIN_PCT = 3;

/**
 * Gráfico de barras sin librería: cada barra es un `<div>` cuya altura anima
 * de 0% al valor final al montar (`framer-motion`), escalada contra el
 * máximo del set de datos. El tooltip es el atributo `title` nativo del
 * navegador — sin JS de hover custom. Reutilizado por `/admin/reportes`
 * ("Clases completadas por semana" y "% de avance por vitrina").
 */
export function BarChart({ data, titulo, sufijo = "", className }: BarChartProps) {
  const maximo = Math.max(1, ...data.map((d) => d.valor));

  const grafico = (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {data.map((d, i) => {
        const pct = Math.max(ALTURA_MIN_PCT, Math.round((d.valor / maximo) * 100));
        return (
          <div
            key={`${d.etiqueta}-${i}`}
            className="flex min-w-11 flex-1 flex-col items-center gap-2"
          >
            <span className="text-xs font-semibold tabular-nums text-foreground">{d.valor}</span>
            <div
              className="flex w-full items-end justify-center"
              style={{ height: ALTURA_PX }}
              title={`${d.etiqueta}: ${d.valor}${sufijo}`}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.035 }}
                className="w-full max-w-11 rounded-t-md bg-primary dark:bg-primary/90"
              />
            </div>
            <span
              className="max-w-20 truncate text-center text-[11px] text-muted-foreground"
              title={d.etiqueta}
            >
              {d.etiqueta}
            </span>
          </div>
        );
      })}
    </div>
  );

  if (!titulo) {
    return <div className={className}>{grafico}</div>;
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>{grafico}</CardContent>
    </Card>
  );
}
