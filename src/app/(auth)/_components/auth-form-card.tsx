"use client";

import { motion } from "framer-motion";
import { LogoPlataforma } from "@/components/shared/logo";
import { MarcaAcademia } from "@/components/shared/marca-academia";
import { useMarcaDeLaEntrada } from "./marca-auth-context";

export interface AuthFormCardProps {
  /** Título principal (font-display), p. ej. "Bienvenido de nuevo". */
  titulo: string;
  /** Copy corto bajo el título. */
  subtitulo: string;
  children: React.ReactNode;
  /** Contenido opcional al pie (links secundarios, chips demo, etc). */
  footer?: React.ReactNode;
}

/**
 * Envoltorio común de las 3 pantallas de auth: wordmark visible solo en
 * móvil/tablet (el panel de branding cubre ese rol en desktop), título +
 * subtítulo, y una transición sutil de entrada para que el formulario no
 * aparezca "de golpe".
 */
export function AuthFormCard({ titulo, subtitulo, children, footer }: AuthFormCardProps) {
  const marca = useMarcaDeLaEntrada();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* El logo va aquí en todos los tamaños: la portada de la izquierda es
          solo video, sin marca encima (ver `AuthBrandPanel`).

          Si la URL dice a qué academia se entra, sale SU marca. Un alumno de
          Mentoría V7.0 no tiene por qué saber que la herramienta se llama
          Klaze. */}
      <div className="mb-8 flex justify-center">
        {marca.nombre ? (
          <MarcaAcademia
            nombre={marca.nombre}
            logoUrl={marca.logoUrl}
            colorAcento={marca.colorAcento}
            orientacion="vertical"
          />
        ) : (
          <LogoPlataforma href="/login" orientacion="vertical" />
        )}
      </div>

      <h1 className="text-center font-display text-xl font-bold tracking-tight text-foreground">
        {titulo}
      </h1>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">{subtitulo}</p>

      <div className="mt-7">{children}</div>

      {footer && <div className="mt-6">{footer}</div>}
    </motion.div>
  );
}
