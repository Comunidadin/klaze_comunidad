"use client";

import { useRef, useState, type FormEvent } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Mensaje {
  de: "alumno" | "asistente";
  texto: string;
}

export interface AsistenteClaseProps {
  leccionId: string;
  className?: string;
}

/**
 * Pregunta sobre la clase que estás viendo.
 *
 * La conversación vive en memoria y se pierde al recargar: es lo acordado, y
 * evita una tabla con sus políticas para algo que se usa en una sesión.
 *
 * Todo pasa por `/api/ia`. La clave de OpenAI **nunca** llega aquí, y el tope
 * de preguntas lo lleva el servidor: si lo llevara este componente, bastaría
 * con recargar para reiniciarlo.
 */
export function AsistenteClase({ leccionId, className }: AsistenteClaseProps) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  async function preguntar(e: FormEvent) {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto || pensando) return;

    setMensajes((m) => [...m, { de: "alumno", texto }]);
    setPregunta("");
    setPensando(true);

    try {
      const { data } = await crearClienteNavegador().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesión caducó. Vuelve a entrar.");

      const r = await fetch("/api/ia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leccionId, pregunta: texto }),
      });

      const cuerpo = await r.json();

      if (!r.ok) {
        // El error se pinta como un mensaje más del asistente: un aviso
        // flotante desaparece y deja la conversación sin explicación.
        setMensajes((m) => [
          ...m,
          { de: "asistente", texto: cuerpo.error ?? "No pude responder ahora mismo." },
        ]);
        if (typeof cuerpo.restantes === "number") setRestantes(cuerpo.restantes);
        return;
      }

      setMensajes((m) => [...m, { de: "asistente", texto: cuerpo.respuesta }]);
      if (typeof cuerpo.restantes === "number") setRestantes(cuerpo.restantes);
    } catch (err) {
      setMensajes((m) => [
        ...m,
        {
          de: "asistente",
          texto: err instanceof Error ? err.message : "No pude responder ahora mismo.",
        },
      ]);
    } finally {
      setPensando(false);
      // Al final del hilo, para no dejar la respuesta fuera de la vista.
      requestAnimationFrame(() => finRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  if (!abierto) {
    return (
      <Button
        variant="outline"
        onClick={() => setAbierto(true)}
        className={cn("w-full", className)}
      >
        <Sparkles /> Pregunta sobre esta clase
      </Button>
    );
  }

  return (
    <section className={cn("rounded-2xl bg-card ring-1 ring-foreground/10", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="size-4" /> Asistente de la clase
        </p>
        {restantes !== null && (
          <span className="text-xs text-muted-foreground">
            {restantes} {restantes === 1 ? "pregunta" : "preguntas"} hoy
          </span>
        )}
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto p-4">
        {mensajes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Pregunta lo que quieras sobre esta clase. Solo responde con lo que se
            explica aquí — si preguntas otra cosa, te lo dirá.
          </p>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className="flex gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                m.de === "alumno"
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/15 text-primary"
              )}
            >
              {m.de === "alumno" ? (
                <User className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
            </span>
            <p className="min-w-0 flex-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {m.texto}
            </p>
          </div>
        ))}

        {pensando && (
          <p className="pl-8.5 text-sm text-muted-foreground">Pensando…</p>
        )}

        <div ref={finRef} />
      </div>

      <form onSubmit={preguntar} className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void preguntar(e as unknown as FormEvent);
            }
          }}
          rows={1}
          placeholder="¿Qué quieres saber?"
          aria-label="Tu pregunta sobre la clase"
          className="min-h-9 py-2 text-sm"
          disabled={pensando}
        />
        <Button type="submit" size="icon" disabled={pensando || !pregunta.trim()}>
          <Send />
        </Button>
      </form>
    </section>
  );
}
