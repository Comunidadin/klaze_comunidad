"use client";

import { useState } from "react";
import { vimeoEmbedUrl } from "@/lib/vimeo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface VimeoPlayerProps {
  /** ID numérico de Vimeo (ya extraído — usa `extractVimeoId` si viene de una URL). */
  vimeoId: string;
  /** Título accesible del iframe. Por defecto uno genérico en español. */
  title?: string;
  className?: string;
}

/**
 * Iframe embed responsivo (16:9) del player de Vimeo. Firma mínima a
 * propósito: la reutiliza el preview del editor admin de cursos (Task 13),
 * así que no agrega nada específico de "lección" (progreso, completada,
 * etc.) más allá del video en sí. Muestra un skeleton mientras el iframe
 * termina de cargar.
 */
export function VimeoPlayer({ vimeoId, title, className }: VimeoPlayerProps) {
  const [cargado, setCargado] = useState(false);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl bg-black",
        className
      )}
    >
      {!cargado && <Skeleton className="absolute inset-0 rounded-2xl" />}
      <iframe
        key={vimeoId}
        src={vimeoEmbedUrl(vimeoId)}
        title={title ?? "Reproductor de video de la lección"}
        onLoad={() => setCargado(true)}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-300",
          cargado ? "opacity-100" : "opacity-0"
        )}
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
