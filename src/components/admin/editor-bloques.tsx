"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  FileText,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { VimeoField } from "@/components/admin/vimeo-field";
import { EditorTexto } from "@/components/admin/editor-texto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { urlDeEmbed, altoSugerido } from "@/lib/embed";
import type { BloqueClase } from "@/lib/types";

export interface EditorBloquesProps {
  bloques: BloqueClase[];
  onCambio: (bloques: BloqueClase[]) => void;
}

const NOMBRES: Record<BloqueClase["tipo"], { titulo: string; icono: typeof Video }> = {
  video: { titulo: "Vídeo", icono: Video },
  texto: { titulo: "Texto", icono: FileText },
  embed: { titulo: "Insertado", icono: Code2 },
};

/**
 * Las piezas de una clase: añadir, ordenar y borrar.
 *
 * Antes una clase *era* de vídeo o de texto. Ahora lleva las piezas que hagan
 * falta en el orden que se quiera, que es lo que se necesita en cuanto hay que
 * poner una tarea debajo de un vídeo.
 */
export function EditorBloques({ bloques, onCambio }: EditorBloquesProps) {
  const [pegado, setPegado] = useState("");

  function agregar(tipo: BloqueClase["tipo"]) {
    const id = crypto.randomUUID();
    const nuevo: BloqueClase =
      tipo === "video"
        ? { id, tipo: "video", vimeoId: "" }
        : tipo === "texto"
          ? { id, tipo: "texto", doc: { type: "doc", content: [] } }
          : { id, tipo: "embed", url: "" };
    onCambio([...bloques, nuevo]);
  }

  function actualizar(id: string, cambios: Partial<BloqueClase>) {
    onCambio(bloques.map((b) => (b.id === id ? ({ ...b, ...cambios } as BloqueClase) : b)));
  }

  function quitar(id: string) {
    onCambio(bloques.filter((b) => b.id !== id));
  }

  function mover(id: string, direccion: -1 | 1) {
    const i = bloques.findIndex((b) => b.id === id);
    const j = i + direccion;
    if (i === -1 || j < 0 || j >= bloques.length) return;
    const copia = [...bloques];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onCambio(copia);
  }

  /** Acepta el código de inserción entero o solo el enlace: se guarda la URL. */
  function aplicarEmbed(id: string, texto: string) {
    const url = urlDeEmbed(texto);
    if (!url) {
      toast.error(
        "Eso no parece un enlace o código de inserción válido. Tiene que empezar por https://"
      );
      return;
    }
    actualizar(id, { url, alto: altoSugerido(url) } as Partial<BloqueClase>);
    setPegado("");
    toast.success("Contenido insertado.");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Contenido de la clase</Label>
        <div className="flex gap-1">
          {(["video", "texto", "embed"] as const).map((t) => {
            const { titulo, icono: Icono } = NOMBRES[t];
            return (
              <Button key={t} type="button" variant="outline" size="sm" onClick={() => agregar(t)}>
                <Icono /> {titulo}
              </Button>
            );
          })}
        </div>
      </div>

      {bloques.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Una clase vacía no se puede ver. Añade un vídeo, un texto o algo
          insertado con los botones de arriba.
        </p>
      ) : (
        <div className="space-y-2.5">
          {bloques.map((bloque, i) => {
            const { titulo, icono: Icono } = NOMBRES[bloque.tipo];
            return (
              <div
                key={bloque.id}
                className="rounded-xl border border-border bg-background"
              >
                <div className="flex items-center gap-1 border-b border-border px-2.5 py-1.5">
                  <Icono className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-xs font-medium text-muted-foreground">
                    {titulo}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => mover(bloque.id, -1)}
                    aria-label={`Subir ${titulo}`}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === bloques.length - 1}
                    onClick={() => mover(bloque.id, 1)}
                    aria-label={`Bajar ${titulo}`}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => quitar(bloque.id)}
                    aria-label={`Quitar ${titulo}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>

                <div className="p-2.5">
                  {bloque.tipo === "video" && (
                    <VimeoField
                      vimeoId={bloque.vimeoId || null}
                      onChange={(vimeoId) =>
                        actualizar(bloque.id, { vimeoId: vimeoId ?? "" } as Partial<BloqueClase>)
                      }
                    />
                  )}

                  {bloque.tipo === "texto" && (
                    <EditorTexto
                      doc={bloque.doc}
                      onCambio={(doc) => actualizar(bloque.id, { doc } as Partial<BloqueClase>)}
                    />
                  )}

                  {bloque.tipo === "embed" && (
                    <div className="space-y-2">
                      {bloque.url ? (
                        <div className="space-y-2">
                          <p className="truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground">
                            {bloque.url}
                          </p>
                          <div className="flex items-end gap-2">
                            <div className="space-y-1">
                              <Label htmlFor={`alto-${bloque.id}`} className="text-xs">
                                Alto (px)
                              </Label>
                              <Input
                                id={`alto-${bloque.id}`}
                                type="number"
                                min={200}
                                max={1200}
                                value={bloque.alto ?? 480}
                                onChange={(e) =>
                                  actualizar(bloque.id, {
                                    alto: Math.min(1200, Math.max(200, Number(e.target.value) || 480)),
                                  } as Partial<BloqueClase>)
                                }
                                className="h-8 w-24"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => actualizar(bloque.id, { url: "" } as Partial<BloqueClase>)}
                            >
                              Cambiar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Textarea
                            value={pegado}
                            onChange={(e) => setPegado(e.target.value)}
                            placeholder='Pega el enlace o el código <iframe …> que te dio el servicio'
                            className="min-h-20 font-mono text-xs"
                            aria-label="Enlace o código para insertar"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              Funciona con Google Forms, Typeform, Calendly, Discord,
                              Loom, YouTube y cualquier otro. Del código pegado
                              guardamos solo la dirección.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => aplicarEmbed(bloque.id, pegado)}
                              disabled={!pegado.trim()}
                            >
                              Insertar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
