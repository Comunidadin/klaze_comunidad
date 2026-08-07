"use client";

import { FileText, Plus, Trash2, Video } from "lucide-react";
import { VimeoField } from "@/components/admin/vimeo-field";
import { SubirImagen } from "@/components/shared/subir-imagen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/lib/types";

export interface LessonEditorProps {
  leccion: Lesson;
  onChange: (leccion: Lesson) => void;
  /** Hace falta para saber en qué carpeta guardar la miniatura. */
  comunidadId: string;
  className?: string;
}

/**
 * Formulario completo de una lección: título, tipo, duración, contenido,
 * recursos y (solo tipo video) el `VimeoField`. Totalmente controlado por
 * `leccion`/`onChange` — quien lo monta (`/admin/cursos/[curso]`) lo hace con
 * `key={leccion.id}` al cambiar la lección seleccionada, así el estado
 * interno de `VimeoField` arranca en blanco por lección sin que este
 * componente tenga que sincronizar nada manualmente (ver docstring de
 * `VimeoField`).
 */
export function LessonEditor({
  leccion,
  onChange,
  comunidadId,
  className,
}: LessonEditorProps) {
  function set<K extends keyof Lesson>(campo: K, valor: Lesson[K]) {
    onChange({ ...leccion, [campo]: valor });
  }

  function actualizarRecurso(indice: number, campo: "nombre" | "url", valor: string) {
    set(
      "recursos",
      leccion.recursos.map((r, i) => (i === indice ? { ...r, [campo]: valor } : r))
    );
  }

  function agregarRecurso() {
    set("recursos", [...leccion.recursos, { nombre: "", url: "" }]);
  }

  function quitarRecurso(indice: number) {
    set(
      "recursos",
      leccion.recursos.filter((_, i) => i !== indice)
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="leccion-titulo">Título de la lección</Label>
        <Input
          id="leccion-titulo"
          value={leccion.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Ej. Cómo elegir un nicho rentable"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Miniatura</Label>
        <SubirImagen
          valor={leccion.portadaUrl}
          onCambio={(url) => set("portadaUrl", url)}
          proporcion={16 / 9}
          anchoSalida={960}
          destino={{ tipo: "academia", comunidadId, uso: "portada" }}
          etiqueta="Subir la miniatura de la clase"
          ayuda="16:9 · 960 × 540. Sin ella se usa la del módulo."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="leccion-tipo">Tipo</Label>
          <Select value={leccion.tipo} onValueChange={(v) => set("tipo", v as Lesson["tipo"])}>
            <SelectTrigger id="leccion-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">
                <Video /> Video
              </SelectItem>
              <SelectItem value="texto">
                <FileText /> Texto
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leccion-duracion">Duración (min)</Label>
          <Input
            id="leccion-duracion"
            type="number"
            min={0}
            value={leccion.duracionMin}
            onChange={(e) => set("duracionMin", Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>

      {leccion.tipo === "video" && (
        <VimeoField vimeoId={leccion.vimeoId} onChange={(vimeoId) => set("vimeoId", vimeoId)} />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="leccion-contenido">
          {leccion.tipo === "video" ? "Descripción (opcional)" : "Contenido de la lección"}
        </Label>
        <Textarea
          id="leccion-contenido"
          value={leccion.contenido}
          onChange={(e) => set("contenido", e.target.value)}
          placeholder={
            leccion.tipo === "video"
              ? "Un resumen corto de lo que cubre el video…"
              : "Escribe el contenido completo de la lección…"
          }
          className="min-h-32"
        />
      </div>

      <Separator />

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label>Recursos descargables</Label>
          <Button type="button" variant="outline" size="sm" onClick={agregarRecurso}>
            <Plus /> Agregar
          </Button>
        </div>

        {leccion.recursos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin recursos todavía — agrega PDFs, plantillas o enlaces útiles para esta lección.
          </p>
        ) : (
          <div className="space-y-2">
            {leccion.recursos.map((recurso, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={recurso.nombre}
                    onChange={(e) => actualizarRecurso(i, "nombre", e.target.value)}
                    placeholder="Nombre del recurso"
                    aria-label="Nombre del recurso"
                  />
                  <Input
                    value={recurso.url}
                    onChange={(e) => actualizarRecurso(i, "url", e.target.value)}
                    placeholder="https://…"
                    aria-label="URL del recurso"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => quitarRecurso(i)}
                  aria-label="Quitar recurso"
                  className="shrink-0"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
