"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { crearPost } from "@/lib/supabase/feed";
import { useSession } from "@/lib/hooks/use-session";
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
import type { CommunitySpace } from "@/lib/types";

export interface PostComposerProps {
  /** Se llama tras publicar: el feed vive en el padre y es quien recarga. */
  onCambio?: () => void | Promise<void>;
  /** Curso dentro del cual se crea la publicación (Cambio 3). */
  comunidadId: string;
  /** Espacios en los que el usuario actual puede publicar (ya filtrados por `soloLectura`/dueño, ver `Feed`). */
  espacios: CommunitySpace[];
  /** Espacio preseleccionado — el de la página actual si se abrió desde `/espacio/[slug]`, si no el primero de la lista. */
  espacioIdPorDefecto?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog de "crear publicación": título, cuerpo y espacio de destino. Se
 * abre desde el botón "Nueva publicación" del encabezado del feed (`Feed`) o
 * desde el CTA del estado vacío — es puramente controlado (`open`/
 * `onOpenChange`), sin trigger propio.
 */
export function PostComposer({
  onCambio,
  comunidadId,
  espacios,
  espacioIdPorDefecto,
  open,
  onOpenChange,
}: PostComposerProps) {
  const { user } = useSession();

  async function publicar(espacio: string, titulo: string, cuerpo: string) {
    try {
      await crearPost(crearClienteNavegador(), {
        comunidadId,
        espacioId: espacio,
        titulo,
        cuerpo,
      });
      await onCambio?.();
      toast.success("Tu publicación ya está en el feed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo publicar");
    }
  }

  const espacioDefault = espacioIdPorDefecto ?? espacios[0]?.id ?? "";

  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [espacioId, setEspacioId] = useState(espacioDefault);

  // `Feed` remonta por completo al navegar entre la pestaña "Comunidad"
  // agregada y `.../comunidad/espacio/[slug]` (son páginas distintas), así
  // que `espacioDefault` no cambia mientras este componente sigue montado —
  // no hace falta sincronizarlo en un efecto. `resetear()` (llamado al
  // cerrar el Dialog, ver `handleOpenChange`) ya deja `espacioId` listo para
  // la próxima apertura.
  function resetear() {
    setTitulo("");
    setCuerpo("");
    setEspacioId(espacioDefault);
  }

  function handleOpenChange(siguienteAbierto: boolean) {
    onOpenChange(siguienteAbierto);
    if (!siguienteAbierto) resetear();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const tituloLimpio = titulo.trim();
    const cuerpoLimpio = cuerpo.trim();
    if (!tituloLimpio || !cuerpoLimpio) {
      toast.error("Escribe un título y un cuerpo antes de publicar.");
      return;
    }

    void publicar(espacioId || espacioDefault, tituloLimpio, cuerpoLimpio);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* `max-h` + scroll interno: el Textarea crece con el contenido
          (`field-sizing-content`), y con un texto largo pegado —unas normas de
          comunidad enteras— el diálogo desbordaba la pantalla sin forma de
          llegar al botón de publicar. */}
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear publicación</DialogTitle>
            <DialogDescription>
              Compártelo con el resto de la comunidad — aparece en el feed al instante.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="post-titulo">Título</Label>
              <Input
                id="post-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Un título claro y directo"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-cuerpo">Cuerpo</Label>
              <Textarea
                id="post-cuerpo"
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={5}
                className="max-h-64 overflow-y-auto"
                placeholder="Cuéntanos con detalle…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-espacio">Espacio</Label>
              <Select value={espacioId} onValueChange={setEspacioId}>
                <SelectTrigger id="post-espacio" className="w-full">
                  <SelectValue placeholder="Elige un espacio" />
                </SelectTrigger>
                <SelectContent>
                  {espacios.map((espacio) => (
                    <SelectItem key={espacio.id} value={espacio.id}>
                      <span aria-hidden="true">{espacio.icono}</span> {espacio.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button type="submit">Publicar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
