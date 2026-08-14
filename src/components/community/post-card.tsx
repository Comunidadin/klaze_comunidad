"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { alternarMeGusta } from "@/lib/supabase/feed";
import { toast } from "sonner";
import { useSession } from "@/lib/hooks/use-session";
import { useEspacios } from "@/lib/hooks/use-espacios";
import { contarComentariosPost, type PostConAutor } from "@/lib/hooks/use-feed";
import { CommentThread } from "@/components/community/comment-thread";
import { LevelBadge } from "@/components/shared/level-badge";
import { Markdown } from "@/components/shared/markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { tiempoRelativo } from "@/lib/fechas-ui";
import { cn } from "@/lib/utils";

export interface PostCardProps {
  post: PostConAutor;
  /**
   * Se llama tras escribir en la base. El feed vive en el padre, así que la
   * tarjeta no puede recargarse sola: avisa y quien tiene los datos decide.
   */
  onCambio?: () => void | Promise<void>;
  className?: string;
}

/** Umbral de caracteres desde el que el cuerpo se recorta y aparece "Ver más". */
const CUERPO_LARGO_UMBRAL = 220;

/**
 * Tarjeta de post del feed: autor + nivel + tiempo relativo, espacio,
 * título/cuerpo (con "ver más" si es largo), like animado y comentarios
 * expandibles inline. Los posts fijados llevan borde índigo + indicador
 * "📌 Fijado" — la jerarquía visual que hace evidente qué leer primero.
 * Reutilizada por la moderación de comunidad para vista previa de posts.
 */
export function PostCard({ post, onCambio, className }: PostCardProps) {
  const { user } = useSession();
  const [guardandoLike, setGuardandoLike] = useState(false);
  const { secciones } = useEspacios(post.comunidadId);

  const [expandido, setExpandido] = useState(false);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);

  const yaDioLike = user !== null && post.likes.includes(user.id);
  const esLargo = post.cuerpo.length > CUERPO_LARGO_UMBRAL;
  const totalComentarios = contarComentariosPost(post);
  const espacio = secciones.flatMap((s) => s.espacios).find((e) => e.id === post.espacioId);

  async function handleLike() {
    if (!user || guardandoLike) return;
    setGuardandoLike(true);
    try {
      await alternarMeGusta(crearClienteNavegador(), post.id, post.meGusta);
      await onCambio?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el me gusta");
    } finally {
      setGuardandoLike(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5",
        post.fijado && "border-l-4 border-primary bg-primary/[0.03] ring-primary/25",
        className
      )}
    >
      {post.fijado && (
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <span aria-hidden="true">📌</span> Fijado
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar>
          <AvatarImage src={post.autor.avatarUrl} alt={post.autor.nombre} />
          <AvatarFallback>{post.autor.nombre[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{post.autor.nombre}</span>
            <LevelBadge nivel={post.autor.nivel} size="sm" />
          </div>
          <span className="text-xs text-muted-foreground">{tiempoRelativo(post.creadoEl)}</span>
        </div>
        {espacio && (
          <Badge variant="secondary" className="shrink-0">
            <span aria-hidden="true">{espacio.icono}</span> {espacio.nombre}
          </Badge>
        )}
      </div>

      <h3 className="mt-3 font-display text-base font-semibold text-balance text-foreground">
        {post.titulo}
      </h3>
      <Markdown
        texto={post.cuerpo}
        className={cn(
          "mt-1.5 text-sm text-pretty text-foreground/90",
          !expandido && esLargo && "line-clamp-4"
        )}
      />
      {esLargo && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expandido ? "Ver menos" : "Ver más"}
        </button>
      )}

      <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
        <button
          type="button"
          onClick={handleLike}
          disabled={!user}
          aria-pressed={yaDioLike}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
            yaDioLike ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <motion.span
            animate={yaDioLike ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="inline-flex"
          >
            <Heart className={cn("size-4", yaDioLike && "fill-primary")} />
          </motion.span>
          <motion.span
            key={post.likes.length}
            initial={{ scale: 1.35, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="tabular-nums"
          >
            {post.likes.length}
          </motion.span>
        </button>

        <button
          type="button"
          onClick={() => setMostrarComentarios((v) => !v)}
          aria-expanded={mostrarComentarios}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageCircle className="size-4" />
          <span className="tabular-nums">{totalComentarios}</span>
        </button>
      </div>

      {mostrarComentarios && <CommentThread postId={post.id} comentarios={post.comentarios} onCambio={onCambio} />}
    </article>
  );
}
