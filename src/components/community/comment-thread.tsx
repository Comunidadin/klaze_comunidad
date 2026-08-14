"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { comentar } from "@/lib/supabase/feed";
import { toast } from "sonner";
import { useSession } from "@/lib/hooks/use-session";
import { LevelBadge } from "@/components/shared/level-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tiempoRelativo } from "@/lib/fechas-ui";
import { Markdown } from "@/components/shared/markdown";
import { cn } from "@/lib/utils";
import type { PostComment } from "@/lib/types";

export interface CommentThreadProps {
  postId: string;
  /** Árbol de comentarios tal como lo entrega `useFeed`. */
  comentarios: PostComment[];
  /** Se llama tras comentar: el feed vive en el padre y es quien recarga. */
  onCambio?: () => void | Promise<void>;
  className?: string;
}

interface CampoNuevoComentarioProps {
  valor: string;
  onCambiar: (valor: string) => void;
  onEnviar: () => void;
  placeholder: string;
  ariaLabel: string;
  autoFocus?: boolean;
}

/** Textarea de una línea + botón enviar, compartido por la respuesta inline y el comentario raíz del fondo. */
function CampoNuevoComentario({
  valor,
  onCambiar,
  onEnviar,
  placeholder,
  ariaLabel,
  autoFocus,
}: CampoNuevoComentarioProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnviar();
    }
  }

  return (
    <div className="flex flex-1 items-end gap-2">
      <Textarea
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className="max-h-40 min-h-8 overflow-y-auto py-1.5"
      />
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        disabled={!valor.trim()}
        onClick={onEnviar}
        aria-label="Enviar comentario"
      >
        <Send />
      </Button>
    </div>
  );
}

/**
 * Comentarios de un post: raíces + respuestas (modelo de 2 niveles fijo).
 * "Responder" solo existe en comentarios raíz — las respuestas no anidan
 * más. `comentar()` del store persiste tanto raíces como respuestas.
 */
export function CommentThread({ postId, comentarios, onCambio, className }: CommentThreadProps) {
  const { user } = useSession();

  async function enviar(texto: string, padreId: string | null) {
    try {
      await comentar(crearClienteNavegador(), postId, texto, padreId);
      await onCambio?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo comentar");
    }
  }

  const [respondiendoA, setRespondiendoA] = useState<string | null>(null);
  const [textoRespuesta, setTextoRespuesta] = useState("");
  const [textoNuevo, setTextoNuevo] = useState("");

  function abrirRespuesta(rootId: string) {
    setRespondiendoA((actual) => (actual === rootId ? null : rootId));
    setTextoRespuesta("");
  }

  function enviarRespuesta(rootId: string) {
    const texto = textoRespuesta.trim();
    if (!texto) return;
    void enviar(texto, rootId);
    setTextoRespuesta("");
    setRespondiendoA(null);
  }

  function enviarNuevo() {
    const texto = textoNuevo.trim();
    if (!texto) return;
    void enviar(texto, null);
    setTextoNuevo("");
  }

  return (
    <div className={cn("space-y-4 border-t border-border pt-4", className)}>
      {comentarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sé el primero en comentar.</p>
      ) : (
        <div className="space-y-4">
          {comentarios.map((raiz) => {
            // El autor viene con el comentario. Antes se buscaba en una
            // lista de usuarios, y quien no estuviera en ella aparecía sin
            // firmar — pasa con quien se dio de baja o es de otro curso.
            const autorRaiz = {
              nombre: raiz.autorNombre ?? "Usuario",
              avatarUrl: raiz.autorAvatar ?? "",
              nivel: raiz.autorNivel ?? 1,
              id: raiz.autorId,
            };
            return (
              <div key={raiz.id} className="flex gap-2.5">
                <Avatar size="sm" className="mt-0.5">
                  <AvatarImage src={autorRaiz.avatarUrl} alt={autorRaiz.nombre} />
                  <AvatarFallback>{autorRaiz.nombre[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{autorRaiz.nombre}</span>
                    <LevelBadge nivel={autorRaiz.nivel} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {tiempoRelativo(raiz.creadoEl)}
                    </span>
                  </div>
                  <Markdown texto={raiz.cuerpo} className="mt-0.5 text-sm text-pretty text-foreground/90" />
                  <button
                    type="button"
                    onClick={() => abrirRespuesta(raiz.id)}
                    className="mt-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Responder
                  </button>

                  {respondiendoA === raiz.id && (
                    <div className="mt-2 flex gap-2.5">
                      <Avatar size="sm" className="mt-0.5">
                        <AvatarImage src={user?.avatarUrl} alt={user?.nombre ?? ""} />
                        <AvatarFallback>{user?.nombre?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <CampoNuevoComentario
                        valor={textoRespuesta}
                        onCambiar={setTextoRespuesta}
                        onEnviar={() => enviarRespuesta(raiz.id)}
                        placeholder={`Responder a ${autorRaiz.nombre}…`}
                        ariaLabel={`Responder a ${autorRaiz.nombre}`}
                        autoFocus
                      />
                    </div>
                  )}

                  {raiz.respuestas.length > 0 && (
                    <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
                      {raiz.respuestas.map((respuesta) => {
                        const autorRespuesta = {
                          nombre: respuesta.autorNombre ?? "Usuario",
                          avatarUrl: respuesta.autorAvatar ?? "",
                          nivel: respuesta.autorNivel ?? 1,
                          id: respuesta.autorId,
                        };
                        return (
                          <div key={respuesta.id} className="flex gap-2.5">
                            <Avatar size="sm" className="mt-0.5">
                              <AvatarImage
                                src={autorRespuesta.avatarUrl}
                                alt={autorRespuesta.nombre}
                              />
                              <AvatarFallback>{autorRespuesta.nombre[0]}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground">
                                  {autorRespuesta.nombre}
                                </span>
                                <LevelBadge nivel={autorRespuesta.nivel} size="sm" />
                                <span className="text-xs text-muted-foreground">
                                  {tiempoRelativo(respuesta.creadoEl)}
                                </span>
                              </div>
                              <Markdown
                                texto={respuesta.cuerpo}
                                className="mt-0.5 text-sm text-pretty text-foreground/90"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2.5">
        <Avatar size="sm" className="mt-0.5">
          <AvatarImage src={user?.avatarUrl} alt={user?.nombre ?? ""} />
          <AvatarFallback>{user?.nombre?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <CampoNuevoComentario
          valor={textoNuevo}
          onCambiar={setTextoNuevo}
          onEnviar={enviarNuevo}
          placeholder="Escribe un comentario…"
          ariaLabel="Escribe un comentario"
        />
      </div>
    </div>
  );
}
