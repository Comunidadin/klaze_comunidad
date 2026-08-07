"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MessagesSquare,
  Pin,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useFeed, type PostConAutor } from "@/lib/hooks/use-feed";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { guardarSecciones, leerSecciones } from "@/lib/supabase/espacios";
import { guardarComunidad } from "@/lib/supabase/perfil";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { eliminarPost, fijarPost } from "@/lib/supabase/feed";
import { useEspacios } from "@/lib/hooks/use-espacios";
import { slugify, useAppStore } from "@/lib/store";
import { formatFechaLarga } from "@/lib/format-fecha";
import { NIVEL_MAXIMO } from "@/lib/levels";
import { LevelBadge } from "@/components/shared/level-badge";
import { useAdminCourses } from "@/lib/hooks/use-admin-courses";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Community, CommunitySection, CommunitySpace } from "@/lib/types";

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
  // Cambio 3: los espacios de un post viven en `Course.secciones` (namespaced
  // por curso), no en `Community.secciones` — hay que resolver con el
  // `cursoId` del post, si no el lookup nunca matchea y el badge desaparece.
  const { secciones } = useEspacios(post.comunidadId, post.cursoId);
  const espacio = secciones.flatMap((s) => s.espacios).find((e) => e.id === post.espacioId);

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
          {espacio && (
            <Badge variant="secondary">
              <span aria-hidden="true">{espacio.icono}</span> {espacio.nombre}
            </Badge>
          )}
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

function PostsTab({
  posts,
  onCambio,
}: {
  posts: PostConAutor[];
  onCambio: () => Promise<void>;
}) {
  
  

  const [postAEliminar, setPostAEliminar] = useState<PostConAutor | null>(null);
  // Ver docstring del mismo patrón en /admin/alumnos: retiene el último post
  // no nulo mientras el Dialog anima su cierre, para que el título/cuerpo no
  // parpadeen a "undefined" en ese lapso.
  const [mostrado, setMostrado] = useState<PostConAutor | null>(null);
  if (postAEliminar && postAEliminar !== mostrado) {
    setMostrado(postAEliminar);
  }

  async function confirmarEliminar() {
    if (!postAEliminar) return;
    const post = postAEliminar;
    setPostAEliminar(null);
    try {
      await eliminarPost(crearClienteNavegador(), post.id);
      await onCambio();
      toast.success("Publicación eliminada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handleFijar(post: PostConAutor) {
    try {
      await fijarPost(crearClienteNavegador(), post.id);
      await onCambio();
      toast.success(`«${post.titulo}» fijado — reemplaza al fijado anterior.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo fijar");
    }
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
// Espacios
// ---------------------------------------------------------------------------

/** Espacio de respaldo: no se puede eliminar (mismo criterio que `useFeed`, ver ESPACIO_RESPALDO ahí). No se editan las secciones en sí (sin crear/eliminar secciones, "mantenlo simple" del brief) — solo los espacios dentro de cada una. */
const ESPACIO_GENERAL = "esp-general";

type NuevoEspacioForm = { nombre: string; icono: string };

/**
 * Editor de espacios de UN curso.
 *
 * Antes editaba los de la comunidad, y ese tab quedó huérfano cuando los
 * espacios pasaron a colgar del curso: seguía guardando algo que el área de
 * miembros ya no leía. Ahora el padre elige el curso y le pasa sus secciones.
 */
function EspaciosTab({
  cursoId,
  seccionesIniciales,
  posts,
  onGuardado,
}: {
  cursoId: string;
  seccionesIniciales: CommunitySection[];
  posts: PostConAutor[];
  onGuardado: () => Promise<void>;
}) {

  const [secciones, setSecciones] = useState<CommunitySection[]>(seccionesIniciales);
  const [nuevoPorSeccion, setNuevoPorSeccion] = useState<Record<string, NuevoEspacioForm>>({});
  const [espacioAEliminar, setEspacioAEliminar] = useState<{
    seccionId: string;
    espacio: CommunitySpace;
  } | null>(null);

  async function persistir(siguiente: CommunitySection[]) {
    setSecciones(siguiente);
    try {
      await guardarSecciones(crearClienteNavegador(), cursoId, siguiente);
      await onGuardado();
    } catch (e) {
      // Se revierte lo pintado: dejar en pantalla un cambio que la base
      // rechazó haría creer que se guardó.
      setSecciones(seccionesIniciales);
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los espacios");
    }
  }

  function actualizarCampo(
    seccionId: string,
    espacioId: string,
    campo: "nombre" | "icono",
    valor: string
  ) {
    setSecciones((prev) =>
      prev.map((s) =>
        s.id !== seccionId
          ? s
          : {
              ...s,
              espacios: s.espacios.map((e) =>
                e.id === espacioId ? { ...e, [campo]: valor } : e
              ),
            }
      )
    );
  }

  function handleBlurGuardar(seccionId: string, espacioId: string) {
    const espacio = secciones
      .find((s) => s.id === seccionId)
      ?.espacios.find((e) => e.id === espacioId);
    if (!espacio || !espacio.nombre.trim()) {
      // Nombre vacío: revierte al último estado persistido en vez de guardar basura.
      setSecciones(seccionesIniciales);
      return;
    }
    persistir(secciones);
    toast.success("Espacio actualizado.");
  }

  function agregar(seccionId: string) {
    const datos = nuevoPorSeccion[seccionId];
    const nombre = datos?.nombre.trim();
    if (!nombre) return;

    const id = crypto.randomUUID();
    const seccion = secciones.find((s) => s.id === seccionId);
    const nuevoEspacio: CommunitySpace = {
      id,
      slug: slugify(nombre) || id.replace(/^esp-/, ""),
      nombre,
      icono: datos?.icono.trim() || "💬",
      orden: (seccion?.espacios.length ?? 0) + 1,
    };

    persistir(
      secciones.map((s) =>
        s.id === seccionId ? { ...s, espacios: [...s.espacios, nuevoEspacio] } : s
      )
    );
    setNuevoPorSeccion((prev) => ({ ...prev, [seccionId]: { nombre: "", icono: "" } }));
    toast.success(`Espacio «${nombre}» agregado.`);
  }

  function confirmarEliminar() {
    if (!espacioAEliminar) return;
    const { seccionId, espacio } = espacioAEliminar;
    persistir(
      secciones.map((s) =>
        s.id !== seccionId ? s : { ...s, espacios: s.espacios.filter((e) => e.id !== espacio.id) }
      )
    );
    toast.success(`Espacio «${espacio.nombre}» eliminado — sus publicaciones pasan a ${nombreGeneral}.`);
    setEspacioAEliminar(null);
  }

  const postsEnEspacioAEliminar = espacioAEliminar
    ? posts.filter((p) => p.espacioId === espacioAEliminar.espacio.id).length
    : 0;

  // El nombre para mostrar del espacio de respaldo — resuelto por id, no
  // hardcodeado como "General": el dueño puede renombrarlo (solo eliminarlo
  // está bloqueado, ver `esGeneral` abajo), y la copy de esta pestaña debe
  // reflejar ese nombre vigente.
  const nombreGeneral =
    secciones.flatMap((s) => s.espacios).find((e) => e.id === ESPACIO_GENERAL)?.nombre ??
    "General";

  return (
    <div className="mt-4 space-y-8">
      <p className="text-sm text-pretty text-muted-foreground">
        Estos espacios aparecen en la barra lateral del feed, agrupados por sección.{" "}
        <span className="font-medium text-foreground">{nombreGeneral}</span> es el espacio de
        respaldo: no se puede eliminar, y recibe las publicaciones de cualquier espacio que
        borres.
      </p>

      {secciones.map((seccion) => (
        <div key={seccion.id}>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {seccion.titulo}
          </h3>

          <ul className="max-w-sm space-y-2">
            {seccion.espacios.map((espacio) => {
              const esGeneral = espacio.id === ESPACIO_GENERAL;
              return (
                <li
                  key={espacio.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2"
                >
                  <Input
                    value={espacio.icono}
                    onChange={(e) =>
                      actualizarCampo(seccion.id, espacio.id, "icono", e.target.value)
                    }
                    onBlur={() => handleBlurGuardar(seccion.id, espacio.id)}
                    maxLength={4}
                    className="h-8 w-12 shrink-0 px-2 text-center"
                    aria-label={`Emoji de ${espacio.nombre}`}
                  />
                  <Input
                    value={espacio.nombre}
                    onChange={(e) =>
                      actualizarCampo(seccion.id, espacio.id, "nombre", e.target.value)
                    }
                    onBlur={() => handleBlurGuardar(seccion.id, espacio.id)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="h-8"
                    aria-label={`Nombre del espacio ${espacio.nombre}`}
                  />
                  {esGeneral ? (
                    <span className="shrink-0 text-xs text-muted-foreground">Fijo</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEspacioAEliminar({ seccionId: seccion.id, espacio })}
                      aria-label={`Eliminar espacio ${espacio.nombre}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex max-w-sm gap-2">
            <Input
              value={nuevoPorSeccion[seccion.id]?.icono ?? ""}
              onChange={(e) =>
                setNuevoPorSeccion((prev) => ({
                  ...prev,
                  [seccion.id]: { nombre: prev[seccion.id]?.nombre ?? "", icono: e.target.value },
                }))
              }
              placeholder="🙂"
              maxLength={4}
              className="h-9 w-14 shrink-0 px-2 text-center"
              aria-label="Emoji del nuevo espacio"
            />
            <Input
              value={nuevoPorSeccion[seccion.id]?.nombre ?? ""}
              onChange={(e) =>
                setNuevoPorSeccion((prev) => ({
                  ...prev,
                  [seccion.id]: { icono: prev[seccion.id]?.icono ?? "", nombre: e.target.value },
                }))
              }
              onKeyDown={(e) => e.key === "Enter" && agregar(seccion.id)}
              placeholder="Nuevo espacio…"
            />
            <Button
              variant="outline"
              onClick={() => agregar(seccion.id)}
              disabled={!nuevoPorSeccion[seccion.id]?.nombre?.trim()}
            >
              <Plus /> Agregar
            </Button>
          </div>
        </div>
      ))}

      <Dialog
        open={!!espacioAEliminar}
        onOpenChange={(open) => !open && setEspacioAEliminar(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar el espacio «{espacioAEliminar?.espacio.nombre}»?</DialogTitle>
            <DialogDescription>
              {postsEnEspacioAEliminar > 0
                ? `${postsEnEspacioAEliminar} ${postsEnEspacioAEliminar === 1 ? "publicación se moverá" : "publicaciones se moverán"} a ${nombreGeneral}.`
                : "No hay publicaciones en este espacio todavía."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEspacioAEliminar(null)}>
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
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const [nombres, setNombres] = useState<string[]>(nombresIniciales);

  async function guardar() {
    const limpios = nombres.map((n, i) => n.trim() || `Nivel ${i + 1}`);
    setNombres(limpios);
    try {
      const supabase = crearClienteNavegador();
      await guardarComunidad(supabase, comunidadId, { nombresNiveles: limpios });
      establecerArmazon(await cargarArmazon(supabase));
      toast.success("Nombres de nivel actualizados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar");
    }
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
  const { posts, recargar } = useFeed(community?.id ?? "");

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
    <ComunidadContenido
      key={community.id}
      community={community}
      posts={posts}
      onCambio={recargar}
    />
  );
}

/**
 * Elige el curso y carga sus espacios.
 *
 * Los espacios cuelgan del curso desde el cimiento, así que editar "los
 * espacios de la academia" ya no significa nada: hay que decir de cuál.
 */
function EspaciosPorCurso({
  community,
  posts,
}: {
  community: Community;
  posts: PostConAutor[];
}) {
  const { cursos } = useAdminCourses(community.id);
  const [cursoId, setCursoId] = useState<string>("");
  const [secciones, setSecciones] = useState<CommunitySection[] | null>(null);

  const elegido = cursoId || cursos[0]?.id || "";

  const cargar = useCallback(async () => {
    if (!elegido) {
      setSecciones([]);
      return;
    }
    setSecciones(await leerSecciones(crearClienteNavegador(), elegido));
  }, [elegido]);

  useEffect(() => {
    let vivo = true;
    void (elegido
      ? leerSecciones(crearClienteNavegador(), elegido)
      : Promise.resolve([])
    ).then((s) => {
      if (vivo) setSecciones(s);
    });
    return () => {
      vivo = false;
    };
  }, [elegido]);

  if (cursos.length === 0) {
    return (
      <EmptyState
        icono={MessagesSquare}
        titulo="Todavía no tienes módulos"
        descripcion="Los espacios de comunidad viven dentro de cada módulo. Crea uno primero."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Módulo:</span>
        <Select value={elegido} onValueChange={setCursoId}>
          <SelectTrigger className="w-[260px]" aria-label="Curso">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cursos.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {secciones === null ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <EspaciosTab
          key={elegido}
          cursoId={elegido}
          seccionesIniciales={secciones}
          posts={posts}
          onGuardado={cargar}
        />
      )}
    </div>
  );
}

function ComunidadContenido({
  community,
  posts,
  onCambio,
}: {
  community: Community;
  posts: PostConAutor[];
  onCambio: () => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Comunidad
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modera publicaciones, organiza espacios y personaliza los niveles de{" "}
          {community.nombre}.
        </p>
      </div>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="espacios">Espacios</TabsTrigger>
          <TabsTrigger value="niveles">Niveles</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <PostsTab posts={posts} onCambio={onCambio} />
        </TabsContent>

        <TabsContent value="espacios">
          <EspaciosPorCurso community={community} posts={posts} />
        </TabsContent>

        <TabsContent value="niveles">
          <NivelesTab comunidadId={community.id} nombresIniciales={community.nombresNiveles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
