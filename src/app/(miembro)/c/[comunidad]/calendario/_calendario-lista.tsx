"use client";

import { CalendarX2 } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useEvents } from "@/lib/hooks/use-events";
import { useAhora } from "@/lib/hooks/use-ahora";
import { EventCard } from "@/components/community/event-card";
import { EmptyState } from "@/components/shared/empty-state";
import { claveDia, formatFechaGrupo } from "@/lib/format-fecha";
import type { CommunityEvent } from "@/lib/types";

export interface CalendarioListaProps {
  comunidadSlug: string;
}

interface GrupoDia {
  clave: string;
  fechaInicio: string;
  eventos: CommunityEvent[];
}

/** Agrupa una lista ya ordenada cronológicamente en bloques por día calendario, preservando el orden. */
function agruparPorDia(eventos: CommunityEvent[]): GrupoDia[] {
  const grupos = new Map<string, GrupoDia>();
  for (const evento of eventos) {
    const clave = claveDia(evento.fechaInicio);
    const existente = grupos.get(clave);
    if (existente) {
      existente.eventos.push(evento);
    } else {
      grupos.set(clave, { clave, fechaInicio: evento.fechaInicio, eventos: [evento] });
    }
  }
  return [...grupos.values()];
}

/**
 * Lista de eventos DE LA ACADEMIA, agrupada por día (a propósito, no un grid
 * de calendario — con 4-5 eventos al mes un grid solo agrega ceremonia sin
 * ayudar a escanear).
 *
 * Fue por curso (Cambio 3) y quedó fósil al subir los eventos a la academia:
 * esta pantalla esperaba un `cursoSlug` que su ruta ya no tiene, no
 * encontraba el curso y devolvía `null` — la pestaña Calendario en blanco.
 */
export function CalendarioLista({ comunidadSlug }: CalendarioListaProps) {
  const resultado = useCommunity(comunidadSlug);
  const { eventos } = useEvents(resultado?.community.id ?? "");
  const ahora = useAhora();

  if (!resultado) return null;
  const { community } = resultado;

  if (eventos.length === 0) {
    return (
      <EmptyState
        icono={CalendarX2}
        titulo="Todavía no hay eventos"
        descripcion={`Cuando el creador de ${community.nombre} programe una sesión en vivo, va a aparecer aquí.`}
      />
    );
  }

  const finDe = (e: CommunityEvent) => new Date(e.fechaInicio).getTime() + e.duracionMin * 60_000;
  // `useEvents` ya entrega los eventos ordenados cronológicamente (ascendente).
  const proximos = eventos.filter((e) => finDe(e) >= ahora);
  const pasados = eventos.filter((e) => finDe(e) < ahora);

  const gruposProximos = agruparPorDia(proximos);
  const gruposPasados = agruparPorDia(pasados);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Calendario
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sesiones en vivo, talleres y mentorías de {community.nombre}.
        </p>
      </div>

      {gruposProximos.length === 0 && gruposPasados.length > 0 && (
        <EmptyState
          icono={CalendarX2}
          titulo="No hay próximos eventos"
          descripcion="Todavía no hay nuevas sesiones programadas. Revisa los eventos pasados más abajo."
          className="mb-10"
        />
      )}

      {gruposProximos.length > 0 && (
        <div className="space-y-7">
          {gruposProximos.map((grupo) => (
            <section key={grupo.clave}>
              <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
                {formatFechaGrupo(grupo.fechaInicio)}
              </h2>
              <div className="space-y-3">
                {grupo.eventos.map((evento) => (
                  <EventCard key={evento.id} evento={evento} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {gruposPasados.length > 0 && (
        <div className="mt-10 space-y-7">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Eventos pasados
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {gruposPasados.map((grupo) => (
            <section key={grupo.clave}>
              <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
                {formatFechaGrupo(grupo.fechaInicio)}
              </h2>
              <div className="space-y-3">
                {grupo.eventos.map((evento) => (
                  <EventCard key={evento.id} evento={evento} pasado />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
