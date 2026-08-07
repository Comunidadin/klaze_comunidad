"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { FileUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/** Lo que se puede subir. Un PDF habría que leerlo antes; se pega y ya. */
const TIPOS = ".txt,.md,.markdown,text/plain,text/markdown";
const MAX_BYTES = 500 * 1024;

/** Aviso a partir de aquí: cada pregunta manda el guion entero al modelo. */
const PALABRAS_AVISO = 4000;

export interface AsistenteDeClaseProps {
  habilitada: boolean;
  contexto: string;
  onHabilitar: (valor: boolean) => void;
  onContexto: (valor: string) => void;
}

function contarPalabras(texto: string): number {
  const limpio = texto.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
}

/**
 * Enciende el asistente de una clase y le da su guion.
 *
 * El guion **no entrena nada**: viaja con cada pregunta. Por eso editarlo surte
 * efecto en la siguiente respuesta, sin ningún paso de indexado.
 */
export function AsistenteDeClase({
  habilitada,
  contexto,
  onHabilitar,
  onContexto,
}: AsistenteDeClaseProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const palabras = contarPalabras(contexto);

  async function cargarArchivo(archivo: File | undefined) {
    if (!archivo) return;

    if (archivo.size > MAX_BYTES) {
      toast.error("El archivo pesa más de 500 KB. Pega solo el texto de la clase.");
      return;
    }

    const texto = await archivo.text();
    if (!texto.trim()) {
      toast.error("Ese archivo está vacío.");
      return;
    }

    // Se añade al final en vez de reemplazar: si ya había texto escrito a mano,
    // sustituirlo sin avisar sería perder trabajo.
    onContexto(contexto.trim() ? `${contexto.trim()}\n\n${texto.trim()}` : texto.trim());
    toast.success(`Añadidas ${contarPalabras(texto)} palabras.`);
  }

  return (
    <div className="relative space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor="ia-habilitada" className="flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Asistente de IA
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Responde preguntas sobre esta clase, y solo sobre esta clase.
          </p>
        </div>
        <Switch id="ia-habilitada" checked={habilitada} onCheckedChange={onHabilitar} />
      </div>

      {habilitada && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ia-contexto" className="text-xs">
              Material de la clase
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp /> Subir .txt
            </Button>
          </div>

          <Textarea
            id="ia-contexto"
            value={contexto}
            onChange={(e) => onContexto(e.target.value)}
            placeholder="Pega aquí la transcripción del vídeo, tus notas, o lo que quieras que el asistente sepa…"
            className="min-h-40 text-xs"
          />

          {/* Oculto a la vista pero presente en el layout: con `display:none`,
              `.click()` no dispara de forma fiable dentro de una ventana modal. */}
          <input
            ref={inputRef}
            type="file"
            accept={TIPOS}
            className="absolute size-px overflow-hidden opacity-0"
            tabIndex={-1}
            aria-label="Subir el material de la clase"
            onChange={(e) => {
              void cargarArchivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-xs text-muted-foreground">
              {palabras === 0
                ? "Sin material, el asistente no se enciende para el alumno."
                : `${palabras.toLocaleString("es")} palabras`}
            </p>
            {palabras > PALABRAS_AVISO && (
              <p className="text-xs text-muted-foreground">
                Es bastante largo: cada pregunta manda todo el material, así que
                cuesta más. Deja lo que de verdad se pregunta.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Este texto se descarga con la clase, así que cualquiera con acceso a
            ella puede leerlo. No pongas aquí nada que no le darías.
          </p>
        </div>
      )}
    </div>
  );
}
