"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, Clock, Pencil, Plus, Trash2, Video } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useEvents } from "@/lib/hooks/use-events";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { guardarEvento, eliminarEvento } from "@/lib/supabase/eventos";
import { useAdminCourses } from "@/lib/hooks/use-admin-courses";
import { useAhora } from "@/lib/hooks/use-ahora";
import { formatDuracion } from "@/components/course/course-utils";
import { diaNumero, formatHora, mesAbreviado } from "@/lib/format-fecha";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CommunityEvent } from "@/lib/types";

function EventosSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

interface FormularioEvento {
  titulo: string;
  descripcion: string;
  fecha: string; // "YYYY-MM-DD", input type=date
  hora: string; // "HH:mm", input type=time
  duracionMin: string;
  urlSala: string;
  /** Curso al que pertenece el evento (Cambio 3 — obligatorio en `CommunityEvent`). */
  cursoId: string;
}

const FORMULARIO_VACIO: FormularioEvento = {
  titulo: "",
  descripcion: "",
  fecha: "",
  hora: "19:00",
  duracionMin: "60",
  urlSala: "",
  cursoId: "",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO datetime -> `{ fecha, hora }` en zona horaria local, para precargar el formulario al editar. */
function isoAFormulario(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return {
    fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** `fecha` + `hora` locales -> ISO datetime (mismo criterio de zona horaria que `claveDia`/`format-fecha.ts`). */
function formularioAIso(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00`).toISOString();
}

/**
 * Tarjeta de evento del admin — bloque de fecha estilo "boleto" igual que
 * `EventCard` (T9), pero con acciones de editar/eliminar en vez de "Entrar a
 * la sala" / "Agregar a mi calendario" (esas son del miembro, no del admin).
 * No reutiliza `EventCard` directamente por esa diferencia de acciones.
 */
function EventoAdminCard({
  evento,
  cursoTitulo,
  pasado,
  onEditar,
  onEliminar,
}: {
  evento: CommunityEvent;
  /** Título del curso al que pertenece — un solo calendario de admin ahora mezcla eventos de varios cursos (Cambio 3). */
  cursoTitulo?: string;
  pasado: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5",
        pasado && "opacity-60"
      )}
    >
      <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted sm:h-18 sm:w-16">
        <span className="font-display text-xl leading-none font-bold tabular-nums text-foreground sm:text-2xl">
          {diaNumero(evento.fechaInicio)}
        </span>
        <span className="mt-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {mesAbreviado(evento.fechaInicio)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-display text-base font-semibold text-balance text-foreground">
              {evento.titulo}
            </h3>
            {cursoTitulo && <Badge variant="secondary">{cursoTitulo}</Badge>}
          </div>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{evento.descripcion}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" />
              {formatHora(evento.fechaInicio)} · {formatDuracion(evento.duracionMin)}
            </span>
            <span className="inline-flex items-center gap-1.5 truncate">
              <Video className="size-3.5 shrink-0" />
              <span className="truncate">{evento.urlSala}</span>
            </span>
            {pasado && <span className="text-muted-foreground/70">· Finalizado</span>}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onEditar}>
            <Pencil className="size-3.5" /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={onEliminar}>
            <Trash2 className="size-3.5" /> Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * `/admin/eventos`: CRUD del calendario en vivo de la comunidad, ahora
 * repartido por curso (Cambio 3: cada evento lleva un `cursoId` obligatorio,
 * elegido con el selector "Curso" del formulario) —
 * `guardarEvento`/`eliminarEvento` (T14) se reflejan de inmediato en la
 * pestaña Calendario de `/c/[comunidad]/cursos/[curso]`, que consume el
 * mismo `useEvents`.
 */
export default function EventosPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const { eventos, recargar } = useEvents(community?.id ?? "");
  const { cursos } = useAdminCourses(community?.id ?? "");
  const ahora = useAhora();

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormularioEvento>(FORMULARIO_VACIO);
  const [eventoAEliminar, setEventoAEliminar] = useState<CommunityEvent | null>(null);
  // Retiene el último evento no nulo mientras el Dialog anima su cierre
  // (mismo patrón documentado en /admin/alumnos), para que el título no
  // parpadee a "undefined" en ese lapso.
  const [eventoMostrado, setEventoMostrado] = useState<CommunityEvent | null>(null);
  if (eventoAEliminar && eventoAEliminar !== eventoMostrado) {
    setEventoMostrado(eventoAEliminar);
  }

  if (!hydrated) {
    return <EventosSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={CalendarDays}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  // Cambio 3: todo evento pertenece a un curso — sin al menos uno creado no
  // hay dónde adjuntarlo, así que se pide crear un curso antes en vez de
  // dejar "Nuevo evento" habilitado hacia un formulario sin opciones.
  if (cursos.length === 0) {
    return (
      <EmptyState
        icono={CalendarDays}
        titulo="Crea un curso primero"
        descripcion="Cada evento pertenece a un curso — crea al menos uno para poder programar sesiones en vivo."
        accion={{ label: "Ir a Cursos", href: "/admin/cursos" }}
      />
    );
  }

  function abrirCrear() {
    setEditandoId(null);
    // Cambio 3: el evento nace atado a un curso — precarga el primero de la
    // comunidad como default razonable (la mayoría de comunidades del mock
    // tienen 1-4 cursos), el creador lo cambia desde el selector si hace falta.
    setForm({ ...FORMULARIO_VACIO, cursoId: cursos[0]?.id ?? "" });
    setDialogAbierto(true);
  }

  function abrirEditar(evento: CommunityEvent) {
    setEditandoId(evento.id);
    const { fecha, hora } = isoAFormulario(evento.fechaInicio);
    setForm({
      titulo: evento.titulo,
      descripcion: evento.descripcion,
      fecha,
      hora,
      duracionMin: String(evento.duracionMin),
      urlSala: evento.urlSala,
      cursoId: evento.cursoId,
    });
    setDialogAbierto(true);
  }

  const formularioValido =
    form.titulo.trim().length > 0 &&
    form.fecha.length > 0 &&
    form.hora.length > 0 &&
    Number(form.duracionMin) > 0 &&
    form.urlSala.trim().length > 0 &&
    form.cursoId.length > 0;

  async function handleGuardar() {
    if (!community || !formularioValido) return;

    const evento: CommunityEvent = {
      id: editandoId ?? crypto.randomUUID(),
      comunidadId: community.id,
      cursoId: form.cursoId,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      fechaInicio: formularioAIso(form.fecha, form.hora),
      duracionMin: Math.max(1, Number(form.duracionMin) || 0),
      urlSala: form.urlSala.trim(),
    };

    setDialogAbierto(false);
    try {
      await guardarEvento(crearClienteNavegador(), evento);
      await recargar();
      toast.success(editandoId ? "Evento actualizado." : "Evento creado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el evento");
    }
  }

  async function confirmarEliminar() {
    if (!eventoAEliminar) return;
    const evento = eventoAEliminar;
    setEventoAEliminar(null);
    try {
      await eliminarEvento(crearClienteNavegador(), evento.id);
      await recargar();
      toast.success(`«${evento.titulo}» eliminado del calendario.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  const finDe = (e: CommunityEvent) =>
    new Date(e.fechaInicio).getTime() + e.duracionMin * 60_000;
  const proximos = eventos.filter((e) => finDe(e) >= ahora);
  const pasados = [...eventos].filter((e) => finDe(e) < ahora).reverse();
  const cursoTituloPorId = new Map(cursos.map((c) => [c.id, c.titulo]));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Eventos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sesiones en vivo, talleres y mentorías de {community.nombre}.
          </p>
        </div>
        <Button onClick={abrirCrear}>
          <Plus /> Nuevo evento
        </Button>
      </div>

      {eventos.length === 0 ? (
        <EmptyState
          icono={CalendarDays}
          titulo="Todavía no hay eventos"
          descripcion="Crea el primer evento en vivo para tu comunidad — va a aparecer también en su calendario."
          accion={{ label: "Nuevo evento", onClick: abrirCrear }}
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
              Próximos ({proximos.length})
            </h2>
            {proximos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay próximos eventos programados.</p>
            ) : (
              <div className="space-y-3">
                {proximos.map((evento) => (
                  <EventoAdminCard
                    key={evento.id}
                    evento={evento}
                    cursoTitulo={cursoTituloPorId.get(evento.cursoId)}
                    pasado={false}
                    onEditar={() => abrirEditar(evento)}
                    onEliminar={() => setEventoAEliminar(evento)}
                  />
                ))}
              </div>
            )}
          </section>

          {pasados.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Pasados ({pasados.length})
              </h2>
              <div className="space-y-3">
                {pasados.map((evento) => (
                  <EventoAdminCard
                    key={evento.id}
                    evento={evento}
                    cursoTitulo={cursoTituloPorId.get(evento.cursoId)}
                    pasado
                    onEditar={() => abrirEditar(evento)}
                    onEliminar={() => setEventoAEliminar(evento)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar evento" : "Nuevo evento"}</DialogTitle>
            <DialogDescription>
              Se agrega de inmediato al calendario que ven los miembros de tu comunidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="evt-curso">Curso</Label>
              <Select
                value={form.cursoId}
                onValueChange={(v) => setForm((f) => ({ ...f, cursoId: v }))}
              >
                <SelectTrigger id="evt-curso" className="w-full">
                  <SelectValue placeholder="Elige un curso" />
                </SelectTrigger>
                <SelectContent>
                  {cursos.map((curso) => (
                    <SelectItem key={curso.id} value={curso.id}>
                      {curso.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-titulo">Título</Label>
              <Input
                id="evt-titulo"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej. Sesión en vivo: Q&A de lanzamiento"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-descripcion">Descripción</Label>
              <Textarea
                id="evt-descripcion"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="De qué trata el evento…"
                className="min-h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="evt-fecha">Fecha</Label>
                <Input
                  id="evt-fecha"
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evt-hora">Hora</Label>
                <Input
                  id="evt-hora"
                  type="time"
                  value={form.hora}
                  onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="evt-duracion">Duración (min)</Label>
                <Input
                  id="evt-duracion"
                  type="number"
                  min={1}
                  value={form.duracionMin}
                  onChange={(e) => setForm((f) => ({ ...f, duracionMin: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evt-sala">URL de la sala</Label>
                <Input
                  id="evt-sala"
                  value={form.urlSala}
                  onChange={(e) => setForm((f) => ({ ...f, urlSala: e.target.value }))}
                  placeholder="https://meet.intercambio.app/…"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={!formularioValido}>
              <CalendarPlus /> {editandoId ? "Guardar cambios" : "Crear evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!eventoAEliminar} onOpenChange={(open) => !open && setEventoAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este evento?</DialogTitle>
            <DialogDescription>
              «{eventoMostrado?.titulo}» se quita del calendario de la comunidad de inmediato.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventoAEliminar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar}>
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
