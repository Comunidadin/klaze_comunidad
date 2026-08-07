"use client";

import { useState } from "react";
import { Link2, TriangleAlert, UploadCloud } from "lucide-react";
import { extractVimeoId } from "@/lib/vimeo";
import { VimeoPlayer } from "@/components/course/vimeo-player";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface VimeoFieldProps {
  /** ID ya extraído (o `null`) — la lección solo guarda el ID, nunca la URL pegada. */
  vimeoId: string | null;
  onChange: (vimeoId: string | null) => void;
  className?: string;
}

/**
 * Campo para vincular el video de Vimeo de una lección: input libre (acepta
 * URL completa, URL corta o ID pelado), extrae el ID en cada tecla con
 * `extractVimeoId` y muestra de inmediato el preview real con `VimeoPlayer`
 * cuando es reconocible.
 *
 * El texto que el usuario escribe vive en estado local (`texto`), no
 * directamente en el prop `vimeoId` — que es solo el ID ya extraído, no lo
 * que se tecleó. Si este campo intentara resincronizar `texto` cada vez que
 * `vimeoId` cambia (el patrón que usa p. ej. `VimeoPlayer`), entraría en un
 * ciclo consigo mismo: al pegar una URL completa, cada tecla dispara
 * `onChange` con el ID ya extraíble a mitad de la URL, el padre actualiza el
 * prop, y ese cambio de prop borraría lo que el usuario todavía está
 * escribiendo. Por eso el padre (`LessonEditor`) monta este campo con
 * `key={leccion.id}`: cambiar de lección remonta el campo con estado en
 * blanco, sin sincronización manual.
 */
export function VimeoField({ vimeoId, onChange, className }: VimeoFieldProps) {
  const [texto, setTexto] = useState(vimeoId ?? "");

  const idExtraido = extractVimeoId(texto);
  const vacio = texto.trim().length === 0;
  const valido = idExtraido !== null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevoTexto = e.target.value;
    setTexto(nuevoTexto);
    onChange(extractVimeoId(nuevoTexto));
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      <Label htmlFor="vimeo-url">Video de Vimeo</Label>
      <div className="relative">
        <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="vimeo-url"
          value={texto}
          onChange={handleChange}
          placeholder="Pega la URL o ID de Vimeo"
          className="pl-8"
          aria-invalid={!vacio && !valido}
        />
      </div>

      {vacio && (
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <UploadCloud className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Sube tu video a Vimeo y pega aquí el enlace.</p>
        </div>
      )}

      {!vacio && !valido && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          No parece un enlace de Vimeo válido.
        </p>
      )}

      {valido && idExtraido && (
        <div className="space-y-2.5">
          <Badge className="border-transparent bg-brand/15 text-brand">
            ✓ Video vinculado
          </Badge>
          <VimeoPlayer vimeoId={idExtraido} title="Preview de la clase" />
        </div>
      )}
    </div>
  );
}
