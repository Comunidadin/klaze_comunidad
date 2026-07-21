"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/shared/logo";

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="mb-8 lg:hidden">
        <Logo href="/login" />
      </div>

      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {titulo}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitulo}</p>

      <div className="mt-7">{children}</div>

      {footer && <div className="mt-6">{footer}</div>}
    </motion.div>
  );
}
