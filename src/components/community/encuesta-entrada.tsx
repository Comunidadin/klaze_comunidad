"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  leerEncuestaEntrada,
  votarEncuesta,
  type PostConAutor,
} from "@/lib/supabase/feed";
import { useSession } from "@/lib/hooks/use-session";
import { useAppStore } from "@/lib/store";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * El popup de la encuesta de entrada: salta al llegar a la academia si el
 * creador marcó una y esta persona ni la votó ni la descartó en este
 * navegador. Votar enseña los resultados ahí mismo; cerrar de cualquier
 * forma la da por atendida — un popup que insiste cada visita es spam.
 */
export interface EncuestaEntradaProps {
  comunidadId: string;
  /** Encuesta externa (Typeform, etc.) de Configuración. Manda sobre la nativa. */
  encuestaUrl?: string;
  encuestaObligatoria?: boolean;
}

/**
 * La variante externa: el Typeform (o similar) de Configuración, en un
 * iframe que construye Klaze — del código pegado solo sobrevivió la URL
 * (`urlDeEmbed`), así que aquí no entra HTML de nadie. Si es obligatoria, la
 * ventana no se cierra con Esc ni tocando fuera: solo «Ya la respondí» — no
 * podemos ver dentro del iframe de otro dominio, así que la palabra del
 * alumno es el cierre.
 */
function EncuestaExterna({
  url,
  obligatoria,
}: {
  url: string;
  obligatoria: boolean;
}) {
  const marcarVista = useAppStore((s) => s.marcarEncuestaEntradaVista);
  const clave = `iframe:${url}`;
  const [abierta, setAbierta] = useState(
    () => !useAppStore.getState().encuestasEntradaVistas[clave]
  );

  function cerrar() {
    setAbierta(false);
    marcarVista(clave);
  }

  return (
    <Dialog
      open={abierta}
      onOpenChange={(abierto) => {
        if (!abierto && obligatoria) return;
        if (!abierto) cerrar();
      }}
    >
      <DialogContent
        showCloseButton={!obligatoria}
        onEscapeKeyDown={(e) => obligatoria && e.preventDefault()}
        onInteractOutside={(e) => obligatoria && e.preventDefault()}
        className="max-h-[90dvh] gap-3 sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>Una pregunta rápida</DialogTitle>
          <DialogDescription>
            {obligatoria
              ? "Respóndela para seguir — es un momento."
              : "Nos ayuda a mejorar. Puedes responderla luego."}
          </DialogDescription>
        </DialogHeader>

        <iframe
          src={url}
          title="Encuesta de la academia"
          className="h-[55dvh] w-full rounded-lg border border-border"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          allow="camera; microphone"
        />

        <div className="flex justify-end gap-2">
          {!obligatoria && (
            <Button variant="ghost" size="sm" onClick={cerrar}>
              Ahora no
            </Button>
          )}
          <Button size="sm" onClick={cerrar}>
            Ya la respondí
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EncuestaEntrada({
  comunidadId,
  encuestaUrl,
  encuestaObligatoria,
}: EncuestaEntradaProps) {
  const { user } = useSession();
  const marcarVista = useAppStore((s) => s.marcarEncuestaEntradaVista);

  const [post, setPost] = useState<PostConAutor | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [votando, setVotando] = useState(false);

  useEffect(() => {
    if (!comunidadId || !user) return;
    let vivo = true;
    void leerEncuestaEntrada(crearClienteNavegador(), comunidadId)
      .then((p) => {
        if (!vivo || !p?.encuesta) return;
        const yaVotada = p.encuesta.opciones.some((o) => o.miVoto);
        const yaVista = Boolean(
          useAppStore.getState().encuestasEntradaVistas[p.id]
        );
        if (!yaVotada && !yaVista) {
          setPost(p);
          setAbierta(true);
        }
      })
      .catch(() => {
        // La encuesta de entrada es decoración de la llegada: sin red o sin
        // fila, simplemente no hay popup.
      });
    return () => {
      vivo = false;
    };
    // Las vistas se leen con `getState()` dentro del efecto a propósito:
    // marcar la vista al cerrar no debe relanzar la consulta.
  }, [comunidadId, user]);

  if (encuestaUrl) {
    return <EncuestaExterna url={encuestaUrl} obligatoria={Boolean(encuestaObligatoria)} />;
  }

  if (!post?.encuesta) return null;

  const yaVote = post.encuesta.opciones.some((o) => o.miVoto);

  function cerrar(abierto: boolean) {
    setAbierta(abierto);
    if (!abierto && post) marcarVista(post.id);
  }

  async function votar(opcionId: string) {
    if (!post || votando) return;
    setVotando(true);
    try {
      await votarEncuesta(crearClienteNavegador(), post.id, opcionId);
      // Releer para pintar los resultados con el voto dentro.
      const actualizado = await leerEncuestaEntrada(
        crearClienteNavegador(),
        comunidadId
      );
      if (actualizado?.encuesta) setPost(actualizado);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo votar");
    } finally {
      setVotando(false);
    }
  }

  return (
    <Dialog open={abierta} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-pretty">{post.titulo}</DialogTitle>
          {post.cuerpo.trim() ? (
            <DialogDescription asChild>
              <div>
                <Markdown texto={post.cuerpo} className="text-sm" />
              </div>
            </DialogDescription>
          ) : (
            <DialogDescription>
              {post.autor.nombre} quiere saber tu opinión — un toque y listo.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2">
          {post.encuesta.opciones.map((opcion) => {
            const pct =
              post.encuesta!.totalVotos > 0
                ? Math.round((opcion.votos / post.encuesta!.totalVotos) * 100)
                : 0;
            return (
              <button
                key={opcion.id}
                type="button"
                disabled={votando || yaVote}
                onClick={() => void votar(opcion.id)}
                className={cn(
                  "relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  yaVote
                    ? opcion.miVoto
                      ? "border-primary/50 text-foreground"
                      : "border-border text-foreground/80"
                    : "cursor-pointer border-border text-foreground hover:border-primary/50 hover:bg-muted"
                )}
              >
                {yaVote && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0",
                      opcion.miVoto ? "bg-primary/15" : "bg-muted"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {opcion.miVoto && <span aria-hidden="true">✓ </span>}
                    {opcion.texto}
                  </span>
                  {yaVote && (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {pct}%
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          {yaVote ? (
            <Button size="sm" onClick={() => cerrar(false)}>
              Listo
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => cerrar(false)}>
              Ahora no
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
