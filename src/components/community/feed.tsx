"use client";

import { useEffect, useState } from "react";
import { Menu, MessagesSquare, PenSquare, SearchX } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useEspacios } from "@/lib/hooks/use-espacios";
import { useFeed, type OrdenFeed } from "@/lib/hooks/use-feed";
import { useHydrated } from "@/lib/hooks/use-session";
import { useAppStore } from "@/lib/store";
import { PostComposer } from "@/components/community/post-composer";
import { PostCard } from "@/components/community/post-card";
import { ContextoRail } from "@/components/community/contexto-rail";
import { EspaciosSidebar } from "@/components/community/espacios-sidebar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FeedProps {
  comunidadSlug: string;
  /** Curso al que pertenece este feed (Cambio 3: la comunidad social vive dentro de cada curso). */
  cursoSlug: string;
  /**
   * Slug del espacio (segmento `[slug]` de
   * `/c/[comunidad]/cursos/[curso]/comunidad/espacio/[slug]`). Sin él,
   * `Feed` muestra el agregado de todos los espacios del curso.
   */
  espacioSlug?: string;
}

/** Esqueleto de carga inicial: encabezado + tarjetas, mientras hidrata el store persistido. */
function EsqueletoFeed() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-56 rounded-lg" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Feed de comunidad DE UN CURSO (Cambio 3) — pestaña "Comunidad" de
 * `/c/[comunidad]/cursos/[curso]` (sin `espacioSlug`, agregado de todos los
 * espacios del curso) y de `.../comunidad/espacio/[slug]` (con
 * `espacioSlug`, un solo espacio). A diferencia de antes de Cambio 3, `Feed`
 * ya no depende de un shell compartido para su columna izquierda: arma sus
 * propias 3 columnas (espacios / posts / contexto) porque es la única
 * pestaña del curso que las necesita — el resto (Lecciones/Calendario/
 * Miembros/Ranking) vive en una sola columna.
 *
 * Se gatea con `useHydrated`: los likes/comentarios/posts creados en sesión
 * viven en el store persistido (`skipHydration: true`), así que antes de
 * hidratar mostramos un esqueleto en vez de un feed momentáneamente
 * incompleto (mismo criterio que la pantalla de invitación).
 */
export function Feed({ comunidadSlug, cursoSlug, espacioSlug }: FeedProps) {
  const resultado = useCommunity(comunidadSlug);
  const comunidadId = resultado?.community.id ?? "";
  const { cursos } = useCourses(comunidadId);
  const curso = cursos.find((c) => c.slug === cursoSlug);
  const cursoId = curso?.id ?? "";

  const hydrated = useHydrated();
  const { secciones } = useEspacios(comunidadId, cursoId);
  const marcarEspacioVisto = useAppStore((s) => s.marcarEspacioVisto);
  const [orden, setOrden] = useState<OrdenFeed>("reciente");
  const [composerAbierto, setComposerAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const todosLosEspacios = secciones.flatMap((s) => s.espacios);
  const espacio = espacioSlug ? todosLosEspacios.find((e) => e.slug === espacioSlug) : undefined;
  const espacioId = espacio?.id;

  const { posts } = useFeed(comunidadId, cursoId, espacioId, orden);

  // Marca el espacio como visitado (limpia su contador de no leídos en la
  // sidebar) solo cuando se está viendo ESE espacio puntual — el agregado
  // (sin `espacioSlug`) no marca nada como visto, mismo criterio que apps de
  // chat: el contador de un canal se limpia al abrir ese canal, no la vista
  // general. Gateado en `hydrated`: `useHydrated()` dispara
  // `persist.rehydrate()` (async) en su propio efecto — escribir acá antes
  // de que termine se pisaría con lo que traiga `localStorage`. Depende del
  // `espacioId` (string), NO del objeto `espacio`: `useEspacios` recalcula
  // `secciones` (y por lo tanto crea un `espacio` nuevo por referencia) cada
  // vez que cambia `espaciosVistos` — si el efecto dependiera del objeto,
  // marcar como visto dispararía este mismo efecto de nuevo en loop infinito.
  useEffect(() => {
    if (hydrated && espacioId) marcarEspacioVisto(espacioId);
  }, [hydrated, espacioId, marcarEspacioVisto]);

  if (!resultado || !curso) return null;
  const { community, isOwner } = resultado;

  if (espacioSlug && !espacio) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="Espacio no encontrado"
        descripcion={`No existe ningún espacio con el enlace "${espacioSlug}" en ${curso.titulo}.`}
        accion={{ label: "Ir a Comunidad", href: `/c/${community.slug}/cursos/${cursoSlug}/comunidad` }}
      />
    );
  }

  // Espacios en los que el usuario actual puede publicar: los de solo
  // lectura (p. ej. Anuncios) están reservados al dueño de la comunidad.
  const espaciosSeleccionables = todosLosEspacios.filter((e) => !e.soloLectura || isOwner);
  const puedePublicarAqui = !espacio || !espacio.soloLectura || isOwner;

  const titulo = espacio ? `${espacio.icono} ${espacio.nombre}` : "Comunidad";

  return (
    <div className="flex gap-6">
      <aside className="hidden shrink-0 lg:block lg:w-[220px]">
        <div className="sticky top-24">
          <EspaciosSidebar
            comunidadId={comunidadId}
            comunidadSlug={comunidadSlug}
            cursoId={cursoId}
            cursoSlug={cursoSlug}
          />
        </div>
      </aside>

      <div className="min-w-0 max-w-2xl flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 lg:hidden"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir navegación de espacios"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-balance text-foreground">
                {titulo}
              </h1>
              {!espacio && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Lo que está pasando ahora mismo en {curso.titulo}.
                </p>
              )}
            </div>
          </div>

          {hydrated && (
            <div className="flex shrink-0 items-center gap-2">
              <Select value={orden} onValueChange={(v) => setOrden(v as OrdenFeed)}>
                <SelectTrigger className="w-[168px]" aria-label="Ordenar publicaciones">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reciente">Más reciente</SelectItem>
                  <SelectItem value="comentado">Más comentado</SelectItem>
                </SelectContent>
              </Select>
              {puedePublicarAqui && (
                <Button onClick={() => setComposerAbierto(true)}>
                  <PenSquare /> Nueva publicación
                </Button>
              )}
            </div>
          )}
        </div>

        {!hydrated ? (
          <EsqueletoFeed />
        ) : (
          <>
            {puedePublicarAqui && (
              <PostComposer
                comunidadId={community.id}
                cursoId={cursoId}
                espacios={espaciosSeleccionables}
                espacioIdPorDefecto={espacio?.id}
                open={composerAbierto}
                onOpenChange={setComposerAbierto}
              />
            )}

            {posts.length === 0 ? (
              <EmptyState
                icono={MessagesSquare}
                titulo={espacio ? `Aún no hay publicaciones en ${espacio.nombre}` : "Aún no hay publicaciones"}
                descripcion="Sé el primero en compartir algo con el resto del curso."
                accion={
                  puedePublicarAqui
                    ? { label: "Crear publicación", onClick: () => setComposerAbierto(true) }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <aside className="hidden w-[300px] shrink-0 xl:block">
        <div className="sticky top-24">
          <ContextoRail
            comunidadId={comunidadId}
            comunidadSlug={comunidadSlug}
            cursoId={cursoId}
            cursoSlug={cursoSlug}
          />
        </div>
      </aside>

      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>{curso.titulo}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <EspaciosSidebar
              comunidadId={comunidadId}
              comunidadSlug={comunidadSlug}
              cursoId={cursoId}
              cursoSlug={cursoSlug}
              onNavigate={() => setMenuAbierto(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
