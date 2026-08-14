"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BarChart3, ImageUp, Plus, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { crearPost } from "@/lib/supabase/feed";
import { borrarImagen, reducirImagen, subirImagen } from "@/lib/supabase/almacenamiento";
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

  async function publicar(
    espacio: string,
    titulo: string,
    cuerpo: string,
    imagen: string,
    opcionesEncuesta: string[]
  ) {
    try {
      await crearPost(crearClienteNavegador(), {
        comunidadId,
        espacioId: espacio,
        titulo,
        cuerpo,
        imagenUrl: imagen || undefined,
        opciones: opcionesEncuesta.length ? opcionesEncuesta : undefined,
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
  const [imagenUrl, setImagenUrl] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [esEncuesta, setEsEncuesta] = useState(false);
  const [opciones, setOpciones] = useState<string[]>(["", ""]);
  const inputImagenRef = useRef<HTMLInputElement>(null);

  async function elegirImagen(archivo: File | undefined) {
    if (!archivo || !user) return;
    if (!archivo.type.startsWith("image/")) {
      toast.error("Tiene que ser una imagen.");
      return;
    }
    setSubiendoImagen(true);
    try {
      const blob = await reducirImagen(archivo);
      const url = await subirImagen(
        crearClienteNavegador(),
        { tipo: "publicacion", usuarioId: user.id },
        blob
      );
      // Si ya había una elegida y la reemplaza, la vieja no es de nadie más.
      const anterior = imagenUrl;
      setImagenUrl(url);
      void borrarImagen(crearClienteNavegador(), anterior);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setSubiendoImagen(false);
    }
  }

  function quitarImagen() {
    const anterior = imagenUrl;
    setImagenUrl("");
    void borrarImagen(crearClienteNavegador(), anterior);
  }

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
    setEsEncuesta(false);
    setOpciones(["", ""]);
    // Cerrar sin publicar deja la imagen huérfana en el bucket: se borra.
    // Al publicar, `handleSubmit` vacía el estado ANTES de cerrar, así que
    // aquí ya no hay nada que borrar y la imagen del post sobrevive.
    if (imagenUrl) {
      void borrarImagen(crearClienteNavegador(), imagenUrl);
      setImagenUrl("");
    }
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
    const opcionesLimpias = esEncuesta
      ? opciones.map((o) => o.trim()).filter(Boolean)
      : [];

    if (esEncuesta) {
      // En una encuesta la pregunta es el título; el cuerpo es opcional.
      if (!tituloLimpio) {
        toast.error("Escribe la pregunta de la encuesta.");
        return;
      }
      if (opcionesLimpias.length < 2) {
        toast.error("Una encuesta necesita al menos 2 opciones.");
        return;
      }
    } else if (!tituloLimpio || !cuerpoLimpio) {
      toast.error("Escribe un título y un cuerpo antes de publicar.");
      return;
    }

    const imagen = imagenUrl;
    setImagenUrl("");
    void publicar(
      espacioId || espacioDefault,
      tituloLimpio,
      cuerpoLimpio,
      imagen,
      opcionesLimpias
    );
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
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {([
                { valor: false, etiqueta: "Publicación" },
                { valor: true, etiqueta: "Encuesta" },
              ] as const).map((m) => (
                <button
                  key={m.etiqueta}
                  type="button"
                  onClick={() => setEsEncuesta(m.valor)}
                  className={
                    esEncuesta === m.valor
                      ? "flex-1 cursor-pointer rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                      : "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  {m.valor && <BarChart3 className="mr-1 inline size-3.5 align-text-bottom" />}
                  {m.etiqueta}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-titulo">{esEncuesta ? "Pregunta" : "Título"}</Label>
              <Input
                id="post-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={
                  esEncuesta ? "¿Qué le preguntas a la comunidad?" : "Un título claro y directo"
                }
                autoFocus
              />
            </div>

            {esEncuesta && (
              <div className="space-y-2">
                <Label>Opciones</Label>
                {opciones.map((opcion, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opcion}
                      onChange={(e) =>
                        setOpciones((prev) =>
                          prev.map((o, j) => (j === i ? e.target.value : o))
                        )
                      }
                      placeholder={`Opción ${i + 1}`}
                      aria-label={`Opción ${i + 1} de la encuesta`}
                    />
                    {opciones.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setOpciones((prev) => prev.filter((_, j) => j !== i))
                        }
                        aria-label={`Quitar la opción ${i + 1}`}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {opciones.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpciones((prev) => [...prev, ""])}
                  >
                    <Plus /> Otra opción
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="post-cuerpo">{esEncuesta ? "Contexto (opcional)" : "Cuerpo"}</Label>
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
              {imagenUrl ? (
                <div className="relative overflow-hidden rounded-lg ring-1 ring-foreground/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagen recién subida al bucket */}
                  <img src={imagenUrl} alt="" className="max-h-48 w-full object-cover" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-2 right-2"
                    onClick={quitarImagen}
                    aria-label="Quitar la imagen"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={subiendoImagen}
                  onClick={() => inputImagenRef.current?.click()}
                >
                  <ImageUp /> {subiendoImagen ? "Subiendo…" : "Añadir imagen"}
                </Button>
              )}
              <input
                ref={inputImagenRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="absolute size-px overflow-hidden opacity-0"
                tabIndex={-1}
                aria-label="Imagen de la publicación"
                onChange={(e) => {
                  void elegirImagen(e.target.files?.[0]);
                  e.target.value = "";
                }}
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
