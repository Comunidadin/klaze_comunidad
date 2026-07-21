"use client";

import { CalendarPlus, Clock, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuracion } from "@/components/course/course-utils";
import { diaNumero, formatHora, mesAbreviado } from "@/lib/format-fecha";
import { descargarICS } from "@/lib/ics";
import { cn } from "@/lib/utils";
import type { CommunityEvent } from "@/lib/types";

export interface EventCardProps {
  evento: CommunityEvent;
  /** El evento ya terminó: se atenúa visualmente y oculta el CTA de sala. */
  pasado?: boolean;
}

/**
 * Tarjeta de evento del calendario de comunidad — bloque de fecha estilo
 * "boleto" (número de día grande + mes) a la izquierda, detalle y acciones a
 * la derecha. El bloque de fecha es la firma visual de esta pantalla: en un
 * calendario la fecha es literalmente el dato más importante.
 */
export function EventCard({ evento, pasado = false }: EventCardProps) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5",
        pasado && "opacity-60"
      )}
    >
      <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted sm:h-18 sm:w-16">
        <span className="font-display text-xl leading-none font-bold tabular-nums text-foreground sm:text-2xl">
          {diaNumero(evento.fechaInicio)}
        </span>
        <span className="mt-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {mesAbreviado(evento.fechaInicio)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-balance text-foreground">
            {evento.titulo}
          </h3>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{evento.descripcion}</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          <span>
            {formatHora(evento.fechaInicio)} · {formatDuracion(evento.duracionMin)}
          </span>
          {pasado && <span className="text-muted-foreground/70">· Finalizado</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => descargarICS(evento)}>
            <CalendarPlus /> Agregar a mi calendario
          </Button>
          {!pasado && (
            <Button
              size="sm"
              onClick={() => window.open(evento.urlSala, "_blank", "noopener,noreferrer")}
            >
              <Video /> Entrar a la sala
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
