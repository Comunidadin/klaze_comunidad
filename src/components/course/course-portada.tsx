"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface CoursePortadaProps {
  portadaUrl: string;
  /** Título del curso — su inicial es el contenido del fallback de gradiente. */
  titulo: string;
  className?: string;
}

/**
 * Portada de un curso con fallback de gradiente índigo + inicial: se activa
 * cuando `portadaUrl` está vacía (borrador recién creado desde
 * `/admin/cursos`, antes de subir una imagen) o cuando la URL pegada a mano
 * no carga (dominio caído, link roto). Siempre se posiciona `absolute
 * inset-0` — el llamador solo necesita un contenedor `relative` de tamaño
 * definido (igual que antes con `next/image fill`).
 *
 * Usa `<img>` en vez de `next/image` a propósito: a diferencia de las
 * portadas mock (siempre Unsplash, declarado en `next.config.ts`), esta URL
 * la escribe el creador a mano en el diálogo "Nueva vitrina" y puede ser
 * cualquier dominio — `next/image` lanza un error en runtime para hosts no
 * declarados en `remotePatterns`, así que un dominio no configurado
 * tumbaría la tarjeta/hero entero en vez de mostrar el fallback.
 */
export function CoursePortada({ portadaUrl, titulo, className }: CoursePortadaProps) {
  const [fallo, setFallo] = useState(false);
  const mostrarImagen = portadaUrl.trim().length > 0 && !fallo;
  const inicial = titulo.trim().charAt(0).toUpperCase() || "?";

  if (mostrarImagen) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={portadaUrl}
        alt=""
        onError={() => setFallo(true)}
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex size-full items-center justify-center bg-gradient-to-br from-primary to-primary/60",
        className
      )}
    >
      <span className="font-display text-4xl font-bold text-primary-foreground">{inicial}</span>
    </div>
  );
}
