"use client";

import Link from "next/link";
import { CalendarDays, Flame, Heart, MessageCircle } from "lucide-react";
import { useEvents } from "@/lib/hooks/use-events";
import { useFeed, contarComentariosPost } from "@/lib/hooks/use-feed";
import { useEspacios } from "@/lib/hooks/use-espacios";
import { useAhora } from "@/lib/hooks/use-ahora";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { diaNumero, formatHora, mesAbreviado } from "@/lib/format-fecha";

export interface ContextoRailProps {
  comunidadId: string;
  comunidadSlug: string;
  /** Curso del que se muestran eventos y publicaciones destacadas (Cambio 3). */
  cursoId: string;
  cursoSlug: string;
}

const MAX_EVENTOS = 3;
const MAX_DESTACADOS = 5;

/**
 * Columna derecha (~300px, solo ≥1280px) del feed de un curso: próximos
 * eventos + publicaciones destacadas por engagement (likes + comentarios),
 * ambos acotados a ESE curso. La renderiza `Feed` (no un layout compartido)
 * — así el rail "lo pide" cada página de feed en vez de empujarlo a
 * pestañas que no lo necesitan (Lecciones/Calendario/Miembros/Ranking).
 * Puramente de lectura: cada bloque enlaza a donde vive el contenido real
 * (calendario / espacio del post), sin acciones propias.
 */
export function ContextoRail({ comunidadId, comunidadSlug, cursoId, cursoSlug }: ContextoRailProps) {
  const { eventos } = useEvents(comunidadId, cursoId);
  const ahora = useAhora();
  const { posts } = useFeed(comunidadId, cursoId);
  const { secciones } = useEspacios(comunidadId, cursoId);

  const proximos = eventos
    .filter((e) => new Date(e.fechaInicio).getTime() + e.duracionMin * 60_000 >= ahora)
    .slice(0, MAX_EVENTOS);

  const espacioSlugPorId = new Map(
    secciones.flatMap((s) => s.espacios).map((e) => [e.id, e.slug])
  );

  const destacados = [...posts]
    .sort(
      (a, b) =>
        b.likes.length +
        contarComentariosPost(b) -
        (a.likes.length + contarComentariosPost(a))
    )
    .slice(0, MAX_DESTACADOS);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
          <CalendarDays className="size-4" aria-hidden="true" /> Próximos eventos
        </h2>
        {proximos.length === 0 ? (
          <p className="mt-3 text-xs text-pretty text-muted-foreground">
            No hay eventos programados por ahora.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {proximos.map((evento) => (
              <li key={evento.id}>
                <Link
                  href={`/c/${comunidadSlug}/cursos/${cursoSlug}/calendario`}
                  className="-mx-2 flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <div className="flex h-10 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-muted">
                    <span className="text-sm leading-none font-bold tabular-nums text-foreground">
                      {diaNumero(evento.fechaInicio)}
                    </span>
                    <span className="mt-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {mesAbreviado(evento.fechaInicio)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {evento.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatHora(evento.fechaInicio)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
          <Flame className="size-4" aria-hidden="true" /> Publicaciones destacadas
        </h2>
        {destacados.length === 0 ? (
          <p className="mt-3 text-xs text-pretty text-muted-foreground">
            Todavía no hay publicaciones en esta comunidad.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {destacados.map((post) => {
              const slug = espacioSlugPorId.get(post.espacioId);
              const href = slug
                ? `/c/${comunidadSlug}/cursos/${cursoSlug}/comunidad/espacio/${slug}`
                : `/c/${comunidadSlug}/cursos/${cursoSlug}/comunidad`;
              return (
                <li key={post.id}>
                  <Link
                    href={href}
                    className="-mx-2 flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted"
                  >
                    <Avatar size="sm" className="mt-0.5 shrink-0">
                      <AvatarImage src={post.autor.avatarUrl} alt="" />
                      <AvatarFallback>{post.autor.nombre[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-balance text-foreground">
                        {post.titulo}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="size-3" aria-hidden="true" />
                          {post.likes.length}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="size-3" aria-hidden="true" />
                          {contarComentariosPost(post)}
                        </span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
