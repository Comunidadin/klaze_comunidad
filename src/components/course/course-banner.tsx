"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Lock, PlayCircle, Unlock } from "lucide-react";
import type { CourseConAcceso } from "@/lib/hooks/use-courses";
import {
  estadisticasCurso,
  formatDuracion,
  modulosOrdenados,
} from "@/components/course/course-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Módulos que se listan en la columna derecha antes de resumir el resto. */
const MAX_MODULOS_LISTADOS = 5;

export interface CourseBannerProps {
  curso: CourseConAcceso;
  comunidadSlug: string;
  /** Nombre del nivel que hace falta, cuando `acceso === "candado-nivel"`. */
  nombreNivelRequerido?: string;
}

function Item({ children, icono: Icono = Check }: { children: React.ReactNode; icono?: typeof Check }) {
  return (
    <li className="flex items-start gap-2 text-sm text-white/85">
      <Icono className="mt-0.5 size-4 shrink-0 text-white/55" aria-hidden="true" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

/**
 * Tarjeta ancha de un curso en el classroom — un banner con la portada de
 * fondo, el resumen del contenido en dos columnas y el estado de acceso.
 *
 * El texto va siempre en blanco sobre la portada oscurecida, no sobre los
 * tokens del tema: es la misma excepción documentada que el hero de curso y
 * el panel de auth, porque el fondo es una imagen y no cambia con el modo
 * claro/oscuro. Lo que sí cambia con el acceso es el tratamiento de esa
 * imagen: los cursos que ya tienes salen teñidos del cian de la marca, y
 * los bloqueados en gris, que es como la referencia separa lo que tienes de
 * lo que no sin necesidad de leer una etiqueta.
 */
export function CourseBanner({ curso, comunidadSlug, nombreNivelRequerido }: CourseBannerProps) {
  const [portadaFallo, setPortadaFallo] = useState(false);
  const tieneAcceso = curso.acceso === "si";
  const { numLecciones, totalMin } = estadisticasCurso(curso);
  const modulos = modulosOrdenados(curso);
  const numRecursos = modulos.reduce(
    (acc, m) => acc + m.lecciones.reduce((a, l) => a + l.recursos.length, 0),
    0
  );

  const href = `/c/${comunidadSlug}/cursos/${curso.slug}`;

  const cuerpo = (
    <>
      {/* Fondo: portada + tinte según acceso. */}
      <div className="absolute inset-0 bg-linear-to-br from-primary to-brand" />
      {curso.portadaUrl && !portadaFallo && (
        // eslint-disable-next-line @next/next/no-img-element -- URL libre del creador; next/image exigiría allowlist de dominios
        <img
          src={curso.portadaUrl}
          alt=""
          aria-hidden="true"
          onError={() => setPortadaFallo(true)}
          className={cn(
            "absolute inset-0 size-full object-cover",
            tieneAcceso ? "grayscale contrast-110" : "grayscale brightness-75"
          )}
        />
      )}
      {tieneAcceso && <div className="absolute inset-0 bg-brand mix-blend-color" />}
      {/*
       * Velo fuerte, no decorativo: las portadas las pega el creador y
       * pueden ser claras y muy cargadas, así que el texto blanco necesita
       * un suelo oscuro garantizado en TODO el ancho, no solo a la
       * izquierda. Con velos suaves la segunda tarjeta se volvía ilegible.
       */}
      <div
        className={cn(
          "absolute inset-0",
          tieneAcceso
            ? "bg-linear-to-r from-black/90 via-black/80 to-black/60"
            : "bg-linear-to-r from-black/92 via-black/85 to-black/70"
        )}
      />

      <div className="relative flex flex-col gap-6 p-6 sm:p-8">
        {/* En móvil el badge va arriba en su propia línea: compartiendo fila
            con el título lo estrangulaba a dos o tres líneas. */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="max-w-xl">
            <h3 className="font-display text-2xl leading-tight font-bold tracking-tight text-balance text-white sm:text-3xl">
              {curso.titulo}
            </h3>
            <p className="mt-3 text-sm text-pretty text-white/70">{curso.descripcion}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            {tieneAcceso ? (
              <Badge className="gap-1.5 border-0 bg-white/15 text-white backdrop-blur-sm">
                <Unlock className="size-3.5" aria-hidden="true" /> Acceso liberado
              </Badge>
            ) : (
              <Badge className="gap-1.5 border-0 bg-black/50 text-white/80 backdrop-blur-sm">
                <Lock className="size-3.5" aria-hidden="true" />
                {curso.acceso === "candado-nivel" && nombreNivelRequerido
                  ? `Nivel ${nombreNivelRequerido}`
                  : "Sin acceso"}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-wider text-white/50 uppercase">
              Contenido
            </p>
            <ul className="space-y-2">
              <Item icono={PlayCircle}>
                {modulos.length} {modulos.length === 1 ? "módulo" : "módulos"}
              </Item>
              <Item icono={PlayCircle}>
                {numLecciones} {numLecciones === 1 ? "lección" : "lecciones"} ·{" "}
                {formatDuracion(totalMin)}
              </Item>
              {numRecursos > 0 && (
                <Item>
                  {numRecursos} {numRecursos === 1 ? "recurso descargable" : "recursos descargables"}
                </Item>
              )}
            </ul>
          </div>

          {modulos.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wider text-white/50 uppercase">
                Lo que vas a ver
              </p>
              <ul className="space-y-2">
                {modulos.slice(0, MAX_MODULOS_LISTADOS).map((m) => (
                  <Item key={m.id}>{m.titulo}</Item>
                ))}
                {modulos.length > MAX_MODULOS_LISTADOS && (
                  <li className="pl-6 text-sm text-white/50">
                    y {modulos.length - MAX_MODULOS_LISTADOS} módulos más
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {tieneAcceso ? (
            <div className="flex min-w-0 max-w-xs flex-1 items-center gap-3">
              <div
                className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-white/20"
                role="progressbar"
                aria-valuenow={curso.progresoPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso de ${curso.titulo}`}
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${curso.progresoPct}%` }}
                />
              </div>
              <span className="shrink-0 text-sm tabular-nums text-white/70">
                {curso.progresoPct}% completado
              </span>
            </div>
          ) : (
            <p className="text-sm text-white/60">
              {curso.acceso === "candado-nivel" && nombreNivelRequerido
                ? `Se desbloquea al llegar a ${nombreNivelRequerido}.`
                : `Valor referencial: $${curso.precioReferencial}`}
            </p>
          )}

          {tieneAcceso ? (
            <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">
              {curso.progresoPct > 0 ? "Continuar" : "Empezar curso"}
            </span>
          ) : (
            <Button size="sm" variant="secondary" className="shrink-0" disabled>
              <Lock className="size-4" /> Pide acceso al creador
            </Button>
          )}
        </div>
      </div>
    </>
  );

  const clasesTarjeta =
    "relative isolate overflow-hidden rounded-2xl border-l-4 border-l-brand ring-1 ring-white/10";

  // Sin acceso la tarjeta no navega a ningún lado: sería un enlace a una
  // pantalla que el guard de `useLesson`/detalle va a rechazar igual.
  if (!tieneAcceso) {
    return <div className={clasesTarjeta}>{cuerpo}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        clasesTarjeta,
        "block transition-shadow outline-none hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {cuerpo}
    </Link>
  );
}
