"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Paso 1 del duotono: gris con más contraste, para que el tinte cian no lo lave. */
const FILTRO_DUOTONO = "grayscale contrast-125 brightness-90";

export interface AuthBrandPanelProps {
  /** mp4/webm en bucle. Si falta o falla, se queda la imagen. */
  videoUrl?: string;
  /** Imagen de respaldo: cubre mientras el video carga, si falla, o si el visitante pidió reducir movimiento. */
  posterUrl?: string;
}

/**
 * Mitad izquierda del login: la portada de la comunidad, a sangre.
 *
 * Tres escalones de respaldo, de mejor a peor caso: video en bucle →
 * imagen fija → degradado de la marca. Nunca queda un hueco vacío.
 *
 * El video va silenciado, sin controles y con `playsInline` (sin esto,
 * Safari en iOS lo abre a pantalla completa en vez de reproducirlo en
 * línea). Si el visitante tiene activado "reducir movimiento" no se
 * descarga siquiera: se muestra solo la imagen. Encima va un tinte cian de
 * marca en `mix-blend-color` que lo vuelve monocromo, más un degradado
 * oscuro hacia el borde derecho para que la costura con el panel del
 * formulario no se note. Los `bg-black`/colores fijos de aquí son la
 * excepción documentada para overlays sobre video: no dependen del tema.
 */
export function AuthBrandPanel({ videoUrl, posterUrl }: AuthBrandPanelProps) {
  const reducirMovimiento = useReducedMotion();
  const [videoFallo, setVideoFallo] = useState(false);
  const [posterFallo, setPosterFallo] = useState(false);

  const mostrarVideo = Boolean(videoUrl) && !videoFallo && !reducirMovimiento;

  return (
    <div className="relative hidden overflow-hidden bg-primary lg:block">
      {/* Degradado de marca: el suelo que se ve si no hay video ni imagen. */}
      <div className="absolute inset-0 bg-linear-to-br from-primary via-primary to-brand" />

      {posterUrl && !posterFallo && (
        // eslint-disable-next-line @next/next/no-img-element -- URL libre que pega el creador; next/image exigiría allowlist de dominios
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          // Sin esto, una URL muerta deja el icono de "imagen rota" del
          // navegador flotando sobre el degradado.
          onError={() => setPosterFallo(true)}
          className={cn("absolute inset-0 size-full object-cover", FILTRO_DUOTONO)}
        />
      )}

      {mostrarVideo && (
        <video
          key={videoUrl}
          src={videoUrl}
          poster={posterUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setVideoFallo(true)}
          className={cn("absolute inset-0 size-full object-cover", FILTRO_DUOTONO)}
        />
      )}

      {/*
       * Duotono en dos pasos: el filtro de arriba ya dejó la imagen en
       * escala de grises con más contraste, y esta capa le devuelve el tono
       * cian. `mix-blend-color` toma matiz y saturación de aquí y la
       * luminosidad de lo que hay debajo, que es justo lo que mantiene las
       * sombras profundas en vez de lavar la imagen con un velo plano.
       */}
      <div className="pointer-events-none absolute inset-0 bg-brand mix-blend-color" />
      <div className="pointer-events-none absolute inset-0 bg-primary/25 mix-blend-multiply" />
      {/*
       * Viñeta suave en los bordes. Va floja a propósito: el panel del
       * formulario es blanco, y un borde muy oscuro pegado al blanco se lee
       * como un corte en vez de como una transición.
       */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/20 via-transparent to-black/15" />
    </div>
  );
}
