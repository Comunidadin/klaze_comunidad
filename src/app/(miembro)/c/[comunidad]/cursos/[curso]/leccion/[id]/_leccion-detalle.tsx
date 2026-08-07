"use client";

/**
 * Referencia estable para el caso "sin progreso". Devolver `[]` dentro del
 * selector crearía un array nuevo en cada lectura y rompería el invariante de
 * `useSyncExternalStore` en React 19 (ver CLAUDE.md).
 */
const VACIO: string[] = [];

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileDown,
  Lock,
  MessageCircle,
  PanelRightOpen,
  ChevronLeft,
  ChevronRight,
  Send,
  SearchX,
} from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses, useLesson } from "@/lib/hooks/use-courses";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { toast } from "sonner";
import { useLessonComments } from "@/lib/hooks/use-lesson-comments";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { Confetti } from "@/components/shared/confetti";
import { BloquesDeClase } from "@/components/course/bloques-clase";
import { AsistenteClase } from "@/components/course/asistente-clase";
import { LessonSidebar } from "@/components/course/lesson-sidebar";
import { leccionesOrdenadas, moduloDeLeccion } from "@/components/course/course-utils";
import { cn } from "@/lib/utils";

export interface LeccionDetalleProps {
  comunidadSlug: string;
  cursoSlug: string;
  leccionId: string;
}

export interface LeccionDetalleProps {
  comunidadSlug: string;
  cursoSlug: string;
  leccionId: string;
}

/** Renderiza `contenido` (texto plano con `\n\n` entre bloques) con tipografía
 * legible sin depender de `@tailwindcss/typography`: detecta listas
 * numeradas ("1. ...") por bloque y el resto lo trata como párrafo. */

function SeccionComentarios({ leccionId }: { leccionId: string }) {
  const { user } = useSession();
  const { comentarios, agregar } = useLessonComments(leccionId);
  const [texto, setTexto] = useState("");

  async function enviar() {
    const cuerpo = texto.trim();
    if (!user || !cuerpo) return;
    setTexto("");
    try {
      await agregar(cuerpo);
    } catch (e) {
      // Se devuelve el texto al campo: perder lo escrito por un fallo de red
      // es peor que el fallo.
      setTexto(cuerpo);
      toast.error(e instanceof Error ? e.message : "No se pudo comentar");
    }
  }

  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <MessageCircle className="size-4" /> Comentarios ({comentarios.length})
      </h2>

      <div className="space-y-4">
        {comentarios.length === 0 && (
          <p className="text-sm text-muted-foreground">Sé el primero en comentar esta clase.</p>
        )}
        {comentarios.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar size="sm">
              <AvatarImage src={c.autor.avatarUrl} alt={c.autor.nombre} />
              <AvatarFallback>{c.autor.nombre[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">{c.autor.nombre}</span>
              <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{c.cuerpo}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-3 border-t border-border pt-5">
        <Avatar size="sm" className="mt-0.5">
          <AvatarImage src={user?.avatarUrl} alt={user?.nombre ?? ""} />
          <AvatarFallback>{user?.nombre?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un comentario…"
            className="min-h-20"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={enviar} disabled={!texto.trim()}>
              <Send /> Comentar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Player de lección: video de Vimeo o contenido de texto, marcar como
 * completada, navegación anterior/siguiente (cruza módulos), recursos y
 * comentarios. Sidebar de temario en columna derecha (desktop) o `Sheet`
 * (móvil). Si el curso o la lección no existen, o el usuario no tiene
 * acceso, muestra un `EmptyState` en su lugar.
 */
export function LeccionDetalle({ comunidadSlug, cursoSlug, leccionId }: LeccionDetalleProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");
  const curso = cursos.find((c) => c.slug === cursoSlug);
  const leccionResult = useLesson(curso?.id ?? "", leccionId);
  const hydrated = useHydrated();
  const progreso = useAppStore((s) => s.armazon?.progreso ?? VACIO);

  // `armazon.progreso` ya son solo las lecciones de esta persona: RLS no deja
  // ver las de nadie más, así que no hay que filtrar por usuario.
  const leccionesCompletadasIds = useMemo(
    () => new Set(progreso),
    [progreso]
  );

  const [mostrarConfetti, setMostrarConfetti] = useState(false);
  // `null` = todavía no sembrado. Antes de hidratar, `useSession` devuelve
  // `user: null`, así que `curso.progresoPct` vale 0 aunque el progreso real
  // ya esté en 100% en localStorage — comparar contra ese 0 dispararía
  // confetti en cada recarga de un curso ya completado. Por eso ignoramos
  // toda comparación hasta el primer render post-hidratación, y ese primer
  // render solo siembra el valor real sin disparar el efecto.
  const progresoPrevioRef = useRef<number | null>(null);
  const progresoPct = curso?.progresoPct;

  useEffect(() => {
    if (!hydrated || progresoPct === undefined) return;

    if (progresoPrevioRef.current === null) {
      progresoPrevioRef.current = progresoPct;
      return;
    }

    if (progresoPrevioRef.current < 100 && progresoPct === 100) {
      setMostrarConfetti(true);
    }
    progresoPrevioRef.current = progresoPct;
  }, [hydrated, progresoPct]);

  if (!resultado) return null;
  const { community } = resultado;

  if (!curso) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="Módulo no encontrado"
        descripcion="El módulo al que pertenece esta clase no existe o fue eliminado."
        accion={{ label: "Volver a módulos", href: `/c/${comunidadSlug}/cursos` }}
        className="mx-auto max-w-lg"
      />
    );
  }

  if (curso.acceso !== "si") {
    const nombreNivel =
      curso.acceso === "candado-nivel" && curso.nivelRequerido
        ? community.nombresNiveles[curso.nivelRequerido - 1]
        : null;

    return (
      <EmptyState
        icono={Lock}
        titulo={
          curso.acceso === "candado-nivel" ? "Este módulo está bloqueado" : "No tienes acceso a este módulo"
        }
        descripcion={
          curso.acceso === "candado-nivel"
            ? `Se desbloquea en nivel ${curso.nivelRequerido}${nombreNivel ? ` — ${nombreNivel}` : ""}. Sigue participando en la comunidad para subir de nivel.`
            : `Habla con el equipo de ${community.nombre} para obtener acceso. Valor referencial: $${curso.precioReferencial}.`
        }
        accion={{ label: "Volver a módulos", href: `/c/${comunidadSlug}/cursos` }}
        className="mx-auto max-w-lg"
      />
    );
  }

  if (!leccionResult) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="Clase no encontrada"
        descripcion="La clase que buscas no existe o fue eliminada de este módulo."
        accion={{ label: "Volver al módulo", href: `/c/${comunidadSlug}/cursos/${curso.slug}` }}
        className="mx-auto max-w-lg"
      />
    );
  }

  const { leccion, completada, toggle } = leccionResult;
  const moduloActual = moduloDeLeccion(curso, leccion.id);

  const ordenGlobal = leccionesOrdenadas(curso);
  const indiceActual = ordenGlobal.findIndex((l) => l.id === leccion.id);
  const anterior = indiceActual > 0 ? ordenGlobal[indiceActual - 1] : null;
  const siguiente =
    indiceActual >= 0 && indiceActual < ordenGlobal.length - 1 ? ordenGlobal[indiceActual + 1] : null;

  const sidebar = (
    <LessonSidebar
      curso={curso}
      comunidadSlug={comunidadSlug}
      leccionActualId={leccion.id}
      leccionesCompletadasIds={leccionesCompletadasIds}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-6">
        {/* Encabezado: volver AL SUBMÓDULO, título, meta, temario móvil.
            Volvía al módulo entero, que es un nivel de más: quien sale de una
            clase espera la lista de la que venía, no la portada del módulo. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={
                moduloActual
                  ? `/c/${comunidadSlug}/cursos/${curso.slug}/modulo/${moduloActual.id}`
                  : `/c/${comunidadSlug}/cursos/${curso.slug}`
              }
              className="mb-1 inline-block text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              ← {moduloActual?.titulo ?? curso.titulo}
            </Link>
            <h1 className="text-balance font-display text-xl font-bold text-foreground sm:text-2xl">
              {leccion.titulo}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" /> {leccion.duracionMin} min
              </Badge>
              {moduloActual && <span className="truncate">{moduloActual.titulo}</span>}
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 lg:hidden">
                <PanelRightOpen /> Temario
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full gap-0 p-0 sm:max-w-sm">
              <SheetHeader className="shrink-0 border-b border-border">
                <SheetTitle>Contenido del módulo</SheetTitle>
              </SheetHeader>
              {sidebar}
            </SheetContent>
          </Sheet>
        </div>

        {/* Las piezas, en el orden en que las puso el creador: un vídeo, una
            explicación debajo, un formulario al final. */}
        {leccion.bloques.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Esta clase todavía no tiene contenido.
          </div>
        ) : (
          <BloquesDeClase bloques={leccion.bloques} />
        )}

        {/* Solo si el creador lo encendió para ESTA clase. */}
        {leccion.iaHabilitada && <AsistenteClase leccionId={leccion.id} />}

        {/* Completar + navegación */}
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
          <Button
            onClick={toggle}
            variant={completada ? "default" : "outline"}
            className={cn(completada && "bg-brand text-brand-foreground hover:bg-brand/90")}
          >
            <AnimatePresence mode="wait" initial={false}>
              {completada ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="inline-flex"
                >
                  <CheckCircle2 className="size-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="circle"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="inline-flex"
                >
                  <Circle className="size-4" />
                </motion.span>
              )}
            </AnimatePresence>
            {completada ? "Completada" : "Marcar como completada"}
          </Button>

          <div className="flex items-center gap-2">
            {anterior ? (
              <Button asChild variant="outline">
                <Link href={`/c/${comunidadSlug}/cursos/${curso.slug}/leccion/${anterior.id}`}>
                  <ChevronLeft /> Anterior
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <ChevronLeft /> Anterior
              </Button>
            )}
            {siguiente ? (
              <Button asChild>
                <Link href={`/c/${comunidadSlug}/cursos/${curso.slug}/leccion/${siguiente.id}`}>
                  Siguiente <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button disabled>
                Siguiente <ChevronRight />
              </Button>
            )}
          </div>
        </div>

        {/* Recursos */}
        {leccion.recursos.length > 0 && (
          <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
            <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
              Recursos descargables
            </h2>
            <ul className="space-y-2">
              {leccion.recursos.map((r) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileDown className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{r.nombre}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comentarios */}
        <SeccionComentarios leccionId={leccion.id} />
      </div>

      {/* Temario — desktop */}
      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <div className="max-h-[calc(100vh-7rem)] overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          {sidebar}
        </div>
      </aside>

      {mostrarConfetti && <Confetti onDone={() => setMostrarConfetti(false)} />}
    </div>
  );
}
