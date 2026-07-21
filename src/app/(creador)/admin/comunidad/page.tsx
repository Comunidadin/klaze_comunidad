"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  MessagesSquare,
  Pin,
  Plus,
  Save,
  Tags,
  Trash2,
} from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useFeed, type PostConAutor } from "@/lib/hooks/use-feed";
import { useKlazeStore } from "@/lib/store";
import { formatFechaLarga } from "@/lib/format-fecha";
import { NIVEL_MAXIMO } from "@/lib/levels";
import { LevelBadge } from "@/components/shared/level-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Community } from "@/lib/types";

function ComunidadSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="mb-4 h-9 w-72 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Posts (moderación)
// ---------------------------------------------------------------------------

/**
 * Fila compacta de post para moderación — a propósito NO reutiliza
 * `PostCard` (T10): esa tarjeta trae like/comentar ligados a la sesión del
 * usuario actual, "ver más" y el hilo de comentarios expandible, ninguno de
 * los cuales aplica acá (el admin no está leyendo el feed, está
 * fijando/eliminando). Reutiliza en cambio los mismos átomos (`Avatar`,
 * `Badge`, `LevelBadge` implícito vía autor) para que se sienta de la misma
 * familia visual.
 */
function PostModeracionRow({
  post,
  onFijar,
  onEliminar,
}: {
  post: PostConAutor;
  onFijar: () => void;
  onEliminar: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-start",
        post.fijado && "bg-primary/[0.03] ring-primary/30"
      )}
    >
      <Avatar size="sm" className="shrink-0">
        <AvatarImage src={post.autor.avatarUrl} alt={post.autor.nombre} />
        <AvatarFallback>{post.autor.nombre[0]}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{post.autor.nombre}</span>
          <Badge variant="secondary">{post.categoria}</Badge>
          {post.fijado && (
            <Badge className="border-transparent bg-primary/15 text-primary">📌 Fijado</Badge>
          )}
        </div>
        <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">{post.titulo}</p>
        <p className="line-clamp-2 text-xs text-pretty text-muted-foreground">{post.cuerpo}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{formatFechaLarga(post.creadoEl)}</p>
      </div>

      <div className="flex shrink-0 gap-2 sm:flex-col">
        <Button variant="outline" size="sm" onClick={onFijar} disabled={post.fijado}>
          <Pin className="size-3.5" /> {post.fijado ? "Fijado" : "Fijar"}
        </Button>
        <Button variant="outline" size="sm" onClick={onEliminar}>
          <Trash2 className="size-3.5" /> Eliminar
        </Button>
      </div>
    </div>
  );
}

function PostsTab({ posts }: { posts: PostConAutor[] }) {
  const eliminarPost = useKlazeStore((s) => s.eliminarPost);
  const fijarPost = useKlazeStore((s) => s.fijarPost);

  const [postAEliminar, setPostAEliminar] = useState<PostConAutor | null>(null);
  // Ver docstring del mismo patrón en /admin/alumnos: retiene el último post
  // no nulo mientras el Dialog anima su cierre, para que el título/cuerpo no
  // parpadeen a "undefined" en ese lapso.
  const [mostrado, setMostrado] = useState<PostConAutor | null>(null);
  if (postAEliminar && postAEliminar !== mostrado) {
    setMostrado(postAEliminar);
  }

  function confirmarEliminar() {
    if (!postAEliminar) return;
    eliminarPost(postAEliminar.id);
    toast.success("Publicación eliminada.");
    setPostAEliminar(null);
  }

  function handleFijar(post: PostConAutor) {
    fijarPost(post.id);
    toast.success(`«${post.titulo}» fijado — reemplaza al fijado anterior.`);
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icono={MessagesSquare}
        titulo="Todavía no hay publicaciones"
        descripcion="Cuando los miembros empiecen a publicar en el feed, vas a poder fijarlas o eliminarlas desde acá."
        className="mt-4"
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {posts.map((post) => (
        <PostModeracionRow
          key={post.id}
          post={post}
          onFijar={() => handleFijar(post)}
          onEliminar={() => setPostAEliminar(post)}
        />
      ))}

      <Dialog open={!!postAEliminar} onOpenChange={(open) => !open && setPostAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta publicación?</DialogTitle>
            <DialogDescription>
              «{mostrado?.titulo}» de {mostrado?.autor.nombre} se elimina del feed de la comunidad.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostAEliminar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar}>
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

/** Categoría de respaldo: ni se elimina ni se renombra (mismo criterio que `useFeed`, ver CATEGORIA_RESPALDO ahí). */
const CATEGORIA_GENERAL = "General";

function CategoriasTab({
  comunidadId,
  categoriasIniciales,
  posts,
}: {
  comunidadId: string;
  categoriasIniciales: string[];
  posts: PostConAutor[];
}) {
  const guardarCategorias = useKlazeStore((s) => s.guardarCategorias);

  const [categorias, setCategorias] = useState<string[]>(categoriasIniciales);
  const guardadasRef = useRef<string[]>(categoriasIniciales);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<string | null>(null);

  function persistir(lista: string[]) {
    guardadasRef.current = lista;
    setCategorias(lista);
    guardarCategorias(comunidadId, lista);
  }

  function agregar() {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    if (categorias.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
      toast.error(`Ya existe la categoría «${nombre}».`);
      return;
    }
    persistir([...categorias, nombre]);
    setNuevaCategoria("");
    toast.success(`Categoría «${nombre}» agregada.`);
  }

  function handleBlurRenombrar(indice: number) {
    const valor = categorias[indice].trim();
    const anterior = guardadasRef.current[indice];
    if (!valor || valor === anterior) {
      setCategorias(guardadasRef.current);
      return;
    }
    const duplicada = categorias.some(
      (c, i) => i !== indice && c.toLowerCase() === valor.toLowerCase()
    );
    if (duplicada) {
      toast.error(`Ya existe una categoría llamada «${valor}».`);
      setCategorias(guardadasRef.current);
      return;
    }
    persistir(categorias.map((c, i) => (i === indice ? valor : c)));
    toast.success("Categoría actualizada.");
  }

  function confirmarEliminar() {
    if (!categoriaAEliminar) return;
    persistir(categorias.filter((c) => c !== categoriaAEliminar));
    toast.success(`Categoría «${categoriaAEliminar}» eliminada — sus publicaciones pasan a General.`);
    setCategoriaAEliminar(null);
  }

  const postsEnCategoriaAEliminar = categoriaAEliminar
    ? posts.filter((p) => p.categoria === categoriaAEliminar).length
    : 0;

  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm text-pretty text-muted-foreground">
        Estas categorías aparecen como pestañas en el feed de la comunidad.{" "}
        <span className="font-medium text-foreground">General</span> es la categoría de respaldo:
        no se puede eliminar ni renombrar, y recibe las publicaciones de cualquier categoría que
        elimines.
      </p>

      <div className="flex gap-2">
        <Input
          value={nuevaCategoria}
          onChange={(e) => setNuevaCategoria(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Nueva categoría…"
          className="max-w-xs"
        />
        <Button variant="outline" onClick={agregar} disabled={!nuevaCategoria.trim()}>
          <Plus /> Agregar
        </Button>
      </div>

      <ul className="max-w-sm space-y-2">
        {categorias.map((categoria, indice) => {
          const esGeneral = categoria === CATEGORIA_GENERAL;
          return (
            <li
              key={indice}
              className="flex items-center gap-2 rounded-lg border border-border p-2"
            >
              <Tags className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Input
                value={categoria}
                disabled={esGeneral}
                onChange={(e) =>
                  setCategorias((prev) =>
                    prev.map((c, i) => (i === indice ? e.target.value : c))
                  )
                }
                onBlur={() => handleBlurRenombrar(indice)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="h-8"
                aria-label={`Nombre de la categoría ${categoria}`}
              />
              {esGeneral ? (
                <span className="shrink-0 text-xs text-muted-foreground">Fija</span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCategoriaAEliminar(categoria)}
                  aria-label={`Eliminar categoría ${categoria}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!categoriaAEliminar}
        onOpenChange={(open) => !open && setCategoriaAEliminar(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar la categoría «{categoriaAEliminar}»?</DialogTitle>
            <DialogDescription>
              {postsEnCategoriaAEliminar > 0
                ? `${postsEnCategoriaAEliminar} ${postsEnCategoriaAEliminar === 1 ? "publicación se moverá" : "publicaciones se moverán"} a General.`
                : "No hay publicaciones en esta categoría todavía."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriaAEliminar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar}>
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Niveles
// ---------------------------------------------------------------------------

function NivelesTab({
  comunidadId,
  nombresIniciales,
}: {
  comunidadId: string;
  nombresIniciales: string[];
}) {
  const guardarNombresNiveles = useKlazeStore((s) => s.guardarNombresNiveles);
  const [nombres, setNombres] = useState<string[]>(nombresIniciales);

  function guardar() {
    const limpios = nombres.map((n, i) => n.trim() || `Nivel ${i + 1}`);
    setNombres(limpios);
    guardarNombresNiveles(comunidadId, limpios);
    toast.success("Nombres de nivel actualizados.");
  }

  return (
    <div className="mt-4 max-w-2xl space-y-5">
      <p className="text-sm text-pretty text-muted-foreground">
        Personaliza cómo se llama cada uno de los 9 niveles de la comunidad — se ven en el
        ranking, el perfil de cada alumno y la insignia junto a su nombre.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: NIVEL_MAXIMO }, (_, i) => i).map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <LevelBadge nivel={i + 1} size="sm" className="shrink-0" />
            <Input
              value={nombres[i] ?? ""}
              onChange={(e) =>
                setNombres((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
              }
              aria-label={`Nombre del nivel ${i + 1}`}
            />
          </div>
        ))}
      </div>

      <Button onClick={guardar}>
        <Save /> Guardar nombres de nivel
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * `/admin/comunidad`: 3 pestañas de administración del espacio social —
 * moderación de posts (fijar/eliminar), CRUD de categorías y edición de los
 * 9 nombres de nivel. Cada pestaña persiste sus cambios en el store al
 * instante (categorías/posts) o con un botón "Guardar" explícito (niveles,
 * porque son 9 campos que tiene sentido confirmar juntos).
 */
export default function ComunidadPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const { posts } = useFeed(community?.id ?? "");

  if (!hydrated) {
    return <ComunidadSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={MessagesSquare}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  return (
    <ComunidadContenido key={community.id} community={community} posts={posts} />
  );
}

function ComunidadContenido({
  community,
  posts,
}: {
  community: Community;
  posts: PostConAutor[];
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Comunidad
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modera publicaciones, organiza categorías y personaliza los niveles de{" "}
          {community.nombre}.
        </p>
      </div>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="niveles">Niveles</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <PostsTab posts={posts} />
        </TabsContent>

        <TabsContent value="categorias">
          <CategoriasTab
            comunidadId={community.id}
            categoriasIniciales={community.categorias}
            posts={posts}
          />
        </TabsContent>

        <TabsContent value="niveles">
          <NivelesTab comunidadId={community.id} nombresIniciales={community.nombresNiveles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
