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

/**
 * La cara del asistente: su foto si la academia subió una, y si no el icono.
 *
 * Va en un componente propio porque aparece en la cabecera y en cada respuesta,
 * y las dos tienen que caer al mismo respaldo si la imagen no carga.
 */
function CaraAsistente({
  avatar,
  tam,
  className,
}: {
  avatar?: string;
  tam: 6 | 7;
  className?: string;
}) {
  const medida = tam === 7 ? "size-7" : "size-6";

  if (avatar?.trim()) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- imagen del creador, dominio arbitrario */
      <img
        src={avatar}
        alt=""
        className={cn(medida, "shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        medida,
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary",
        className
      )}
    >
      <Sparkles className={tam === 7 ? "size-4" : "size-3.5"} />
    </span>
  );
}

export interface AsistenteClaseProps {
  leccionId: string;
  /**
   * Cómo se llama el asistente de ESTA academia. Va por prop y no fijo en el
   * código: "BecarIA" es la marca de una empresa concreta, y escribirla aquí
   * se la pondría a todas las demás.
   */
  nombre: string;
  /** Su cara. Sin ella, el icono de siempre. */
  avatar?: string;
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
export function AsistenteClase({
  leccionId,
  nombre,
  avatar,
  className,
}: AsistenteClaseProps) {
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

  return (
    <section className={cn("rounded-2xl bg-card ring-1 ring-foreground/10", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CaraAsistente avatar={avatar} tam={7} />
          {nombre}
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
            Hola. Pregúntame lo que quieras sobre esta clase. Solo respondo con
            lo que se explica aquí — si preguntas otra cosa, te lo diré.
          </p>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className="flex gap-2.5">
            {m.de === "alumno" ? (
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="size-3.5" />
              </span>
            ) : (
              <CaraAsistente avatar={avatar} tam={6} className="mt-0.5" />
            )}
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
          placeholder={`Pregunta a ${nombre}…`}
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
