"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useFeed } from "@/lib/hooks/use-feed";
import { useHydrated } from "@/lib/hooks/use-session";
import { PostComposer } from "@/components/community/post-composer";
import { CategoryTabs, TODAS_LAS_CATEGORIAS } from "@/components/community/category-tabs";
import { PostCard } from "@/components/community/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export interface FeedProps {
  comunidadSlug: string;
}

/** Esqueleto de carga inicial: composer + tabs + tarjetas, mientras hidrata el store persistido. */
function EsqueletoFeed() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[60px] w-full rounded-2xl" />
      <Skeleton className="h-9 w-72 rounded-lg" />
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Feed de comunidad — página de aterrizaje de `/c/[comunidad]/inicio`.
 * Composer colapsado, tabs de categoría (que filtran vía `useFeed`) y lista
 * de posts con el fijado en primer lugar. El slug de comunidad llega ya
 * validado por `MemberShell`, así que aquí asumimos `useCommunity` resuelto.
 *
 * Se gatea con `useHydrated`: los likes/comentarios/posts creados en sesión
 * viven en el store persistido (`skipHydration: true`), así que antes de
 * hidratar mostramos un esqueleto en vez de un feed momentáneamente
 * incompleto (mismo criterio que la pantalla de invitación).
 */
export function Feed({ comunidadSlug }: FeedProps) {
  const resultado = useCommunity(comunidadSlug);
  const hydrated = useHydrated();
  const [categoriaActiva, setCategoriaActiva] = useState<string>(TODAS_LAS_CATEGORIAS);
  const [composerAbierto, setComposerAbierto] = useState(false);

  const categoriaFiltro = categoriaActiva === TODAS_LAS_CATEGORIAS ? undefined : categoriaActiva;
  const { posts } = useFeed(resultado?.community.id ?? "", categoriaFiltro);

  if (!resultado) return null;
  const { community } = resultado;

  return (
    // Columna angosta centrada (no el ancho completo de `max-w-6xl` que usan
    // las grillas de cursos/miembros): un feed de lectura se escanea mejor
    // en un ancho de línea corto, estilo Skool, y además es lo que hace que
    // el recorte de "ver más" en `PostCard` tenga efecto real.
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Inicio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo que está pasando ahora mismo en {community.nombre}.
        </p>
      </div>

      {!hydrated ? (
        <EsqueletoFeed />
      ) : (
        <div className="space-y-5">
          <PostComposer
            comunidadId={community.id}
            categorias={community.categorias}
            open={composerAbierto}
            onOpenChange={setComposerAbierto}
          />

          <CategoryTabs
            categorias={community.categorias}
            activa={categoriaActiva}
            onCambiar={setCategoriaActiva}
          />

          {posts.length === 0 ? (
            <EmptyState
              icono={MessagesSquare}
              titulo={
                categoriaActiva === TODAS_LAS_CATEGORIAS
                  ? "Aún no hay publicaciones"
                  : `Aún no hay publicaciones en ${categoriaActiva}`
              }
              descripcion="Sé el primero en compartir algo con el resto de la comunidad."
              accion={{ label: "Crear publicación", onClick: () => setComposerAbierto(true) }}
            />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
