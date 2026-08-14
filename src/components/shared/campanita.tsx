"use client";

import Link from "next/link";
import { Bell, BookOpen, Megaphone, MessageCircle } from "lucide-react";
import { useNotificaciones, type Notificacion } from "@/lib/hooks/use-notificaciones";
import { tiempoRelativo } from "@/lib/fechas-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONO: Record<Notificacion["tipo"], typeof Bell> = {
  comentario: MessageCircle,
  anuncio: Megaphone,
  clase: BookOpen,
};

/**
 * La campanita del área de alumno: respuestas a lo tuyo, anuncios y módulos
 * recién desbloqueados. El contador se apaga al abrirla; la lista se queda
 * mientras esté abierta.
 */
export function Campanita({
  comunidadId,
  comunidadSlug,
}: {
  comunidadId: string;
  comunidadSlug: string;
}) {
  const { notificaciones, marcarVisto, sinVer } = useNotificaciones(
    comunidadId,
    comunidadSlug
  );

  return (
    <DropdownMenu onOpenChange={(abierto) => abierto && marcarVisto()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            sinVer > 0
              ? `Notificaciones: ${sinVer} sin ver`
              : "Notificaciones"
          }
        >
          <Bell className="size-4" />
          {sinVer > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {sinVer > 9 ? "9+" : sinVer}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Novedades</DropdownMenuLabel>
        {notificaciones.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nada nuevo desde tu última visita.
          </p>
        ) : (
          notificaciones.slice(0, 12).map((n) => {
            const Icono = ICONO[n.tipo];
            return (
              <DropdownMenuItem key={n.id} asChild>
                <Link href={n.href} className="flex items-start gap-2.5 py-2">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icono className="size-3.5 text-muted-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug text-pretty text-foreground">
                      {n.texto}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tiempoRelativo(n.fecha)}
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
