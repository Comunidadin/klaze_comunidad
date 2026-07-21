"use client";

import { motion } from "framer-motion";
import { Flame, Quote } from "lucide-react";

const TESTIMONIO = {
  cita:
    "Migré a mis 480 alumnas en una tarde y dejé de pagar Kajabi, Discord y Zoom por separado.",
  nombre: "Carolina Beltrán",
  rol: "Fundadora de Cocina sin Miedo",
  avatarUrl: "https://i.pravatar.cc/150?u=testimonio-carolina-beltran",
};

/**
 * Panel izquierdo del split-screen de auth: branding índigo con claim de
 * producto, un "logro" de muestra (conecta con la gamificación real de
 * Klaze) y un testimonial. Oculto en móvil/tablet, visible desde `lg`.
 * Toda la paleta usa tokens (`primary`, `primary-foreground`, `accent`)
 * para que el contraste se mantenga correcto en light y dark mode.
 */
export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
      <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-primary-foreground/10 blur-3xl" />

      <div className="relative flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15 font-display text-sm font-bold text-primary-foreground ring-1 ring-primary-foreground/25">
          K
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-primary-foreground">
          KLAZE
        </span>
      </div>

      <div className="relative max-w-md">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="font-display text-4xl leading-[1.1] font-bold tracking-tight text-primary-foreground xl:text-[2.75rem]"
        >
          Tu conocimiento, convertido en comunidad.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="mt-4 text-base text-primary-foreground/75"
        >
          Cursos en video, foro activo, eventos en vivo y niveles que
          enganchan — todo con tu marca, sin escribir una línea de código.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
          className="mt-8 inline-flex items-center gap-2.5 rounded-2xl bg-primary-foreground/10 px-4 py-3 ring-1 ring-primary-foreground/15 backdrop-blur-sm"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Flame className="size-4" />
          </span>
          <span className="text-sm text-primary-foreground">
            <span className="block font-semibold">Nivel 7 · Constructor</span>
            <span className="block text-primary-foreground/60">
              1.240 pts esta semana
            </span>
          </span>
        </motion.div>
      </div>

      <motion.figure
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        className="relative rounded-2xl bg-primary-foreground/10 p-5 ring-1 ring-primary-foreground/15 backdrop-blur-sm"
      >
        <Quote className="size-5 text-accent" />
        <blockquote className="mt-2 text-sm leading-relaxed text-primary-foreground/90">
          &ldquo;{TESTIMONIO.cita}&rdquo;
        </blockquote>
        <figcaption className="mt-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar mock (pravatar) sin dominio configurado en next/image */}
          <img
            src={TESTIMONIO.avatarUrl}
            alt={TESTIMONIO.nombre}
            className="size-9 rounded-full ring-2 ring-primary-foreground/20"
          />
          <span className="text-sm">
            <span className="block font-medium text-primary-foreground">
              {TESTIMONIO.nombre}
            </span>
            <span className="block text-primary-foreground/60">
              {TESTIMONIO.rol}
            </span>
          </span>
        </figcaption>
      </motion.figure>
    </div>
  );
}
