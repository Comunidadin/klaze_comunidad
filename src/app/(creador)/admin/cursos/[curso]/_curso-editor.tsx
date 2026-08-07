"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FileText,
  Layers,
  Plus,
  Save,
  SearchX,
  Trash2,
  Video,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { guardarCurso } from "@/lib/supabase/guardar-curso";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useAdminCourse } from "@/lib/hooks/use-admin-courses";
import { useAppStore } from "@/lib/store";
import { leccionesOrdenadas, moduloDeLeccion, modulosOrdenados } from "@/components/course/course-utils";
import { SubirImagen } from "@/components/shared/subir-imagen";
import { LessonEditor } from "@/components/admin/lesson-editor";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Course, CourseModule, Lesson } from "@/lib/types";

export interface CursoEditorProps {
  cursoId: string;
}

function EditorSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b border-border pb-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

/** Reordena `items[indice]` con el anterior; sin cambios si ya es el primero. */
function moverArriba<T>(items: T[], indice: number): T[] {
  if (indice <= 0) return items;
  const copia = [...items];
  [copia[indice - 1], copia[indice]] = [copia[indice], copia[indice - 1]];
  return copia;
}

/** Reordena `items[indice]` con el siguiente; sin cambios si ya es el último. */
function moverAbajo<T>(items: T[], indice: number): T[] {
  if (indice >= items.length - 1) return items;
  const copia = [...items];
  [copia[indice + 1], copia[indice]] = [copia[indice], copia[indice + 1]];
  return copia;
}

/** Reescribe `orden` como 1..N según la posición actual en el array. */
function reindexar<T extends { orden: number }>(items: T[]): T[] {
  return items.map((item, i) => ({ ...item, orden: i + 1 }));
}

function nuevaLeccion(id: string): Lesson {
  return {
    id,
    titulo: "Nueva lección",
    orden: 0,
    tipo: "video",
    vimeoId: null,
    duracionMin: 5,
    contenido: "",
    recursos: [],
  };
}

/**
 * `/admin/cursos/[curso]`: editor de estructura de un curso — módulos y
 * lecciones reordenables en la columna izquierda, `LessonEditor` de la
 * lección seleccionada en la derecha. Trabaja sobre una copia local
 * (`curso`) sembrada desde `useAdminCourse` y solo escribe al store cuando
 * el creador aprieta "Guardar cambios" (`dirty` avisa de cambios pendientes).
 */
export function CursoEditor({ cursoId }: CursoEditorProps) {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const cursoOriginal = useAdminCourse(community?.id ?? "", cursoId);
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const router = useRouter();

  const [cursoIdCargado, setCursoIdCargado] = useState<string | null>(null);
  const [curso, setCurso] = useState<Course | null>(null);
  const [dirty, setDirty] = useState(false);
  const [leccionSeleccionadaId, setLeccionSeleccionadaId] = useState<string | null>(null);
  const [moduloAEliminar, setModuloAEliminar] = useState<CourseModule | null>(null);
  // Retiene el último módulo no nulo mientras el diálogo de confirmación
  // termina su animación de cierre (mismo patrón que /admin/alumnos): si el
  // título/descripción leyeran `moduloAEliminar` directamente, parpadearían
  // a "0 lecciones" en el frame en que se limpia el estado.
  const [moduloMostrado, setModuloMostrado] = useState<CourseModule | null>(null);
  if (moduloAEliminar && moduloAEliminar !== moduloMostrado) {
    setModuloMostrado(moduloAEliminar);
  }

  // Siembra la copia local de edición la primera vez que `cursoOriginal`
  // resuelve para este `cursoId` — ver docstring de arriba. Ajustar estado
  // durante el render (no en un efecto) evita un frame con `curso: null`
  // antes de que la copia esté lista.
  if (cursoOriginal && cursoOriginal.id !== cursoIdCargado) {
    setCursoIdCargado(cursoOriginal.id);
    setCurso({ ...cursoOriginal, modulos: modulosOrdenados(cursoOriginal) });
    setDirty(false);
  }

  const todasLecciones = curso ? leccionesOrdenadas(curso) : [];
  const leccionSeleccionada =
    todasLecciones.find((l) => l.id === leccionSeleccionadaId) ?? todasLecciones[0] ?? null;
  if (leccionSeleccionada && leccionSeleccionada.id !== leccionSeleccionadaId) {
    setLeccionSeleccionadaId(leccionSeleccionada.id);
  }

  if (!hydrated) {
    return <EditorSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={BookOpen}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  if (!curso) {
    return (
      <EmptyState
        icono={SearchX}
        titulo="Curso no encontrado"
        descripcion="Este curso no existe o no pertenece a tu comunidad."
        accion={{ label: "Volver a cursos", href: "/admin/cursos" }}
      />
    );
  }

  function actualizarCurso(mutador: (c: Course) => Course) {
    setCurso((prev) => {
      if (!prev) return prev;
      setDirty(true);
      return mutador(prev);
    });
  }

  function agregarModulo() {
    const id = crypto.randomUUID();
    actualizarCurso((c) => ({
      ...c,
      modulos: reindexar([...c.modulos, { id, titulo: "Nuevo módulo", orden: 0, lecciones: [] }]),
    }));
  }

  function renombrarModulo(moduloId: string, titulo: string) {
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) => (m.id === moduloId ? { ...m, titulo } : m)),
    }));
  }

  function actualizarPortadaModulo(moduloId: string, portadaUrl: string) {
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) =>
        m.id === moduloId ? { ...m, portadaUrl: portadaUrl.trim() ? portadaUrl : undefined } : m
      ),
    }));
  }

  function moverModulo(moduloId: string, direccion: "arriba" | "abajo") {
    actualizarCurso((c) => {
      const indice = c.modulos.findIndex((m) => m.id === moduloId);
      if (indice === -1) return c;
      const modulos = direccion === "arriba" ? moverArriba(c.modulos, indice) : moverAbajo(c.modulos, indice);
      return { ...c, modulos: reindexar(modulos) };
    });
  }

  function solicitarEliminarModulo(modulo: CourseModule) {
    if (modulo.lecciones.length > 0) {
      setModuloAEliminar(modulo);
    } else {
      eliminarModulo(modulo.id);
    }
  }

  function eliminarModulo(moduloId: string) {
    actualizarCurso((c) => ({
      ...c,
      modulos: reindexar(c.modulos.filter((m) => m.id !== moduloId)),
    }));
    setModuloAEliminar(null);
  }

  function agregarLeccion(moduloId: string) {
    const id = crypto.randomUUID();
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) =>
        m.id === moduloId ? { ...m, lecciones: reindexar([...m.lecciones, nuevaLeccion(id)]) } : m
      ),
    }));
    setLeccionSeleccionadaId(id);
  }

  function eliminarLeccion(moduloId: string, leccionId: string) {
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) =>
        m.id === moduloId
          ? { ...m, lecciones: reindexar(m.lecciones.filter((l) => l.id !== leccionId)) }
          : m
      ),
    }));
  }

  function moverLeccion(moduloId: string, leccionId: string, direccion: "arriba" | "abajo") {
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) => {
        if (m.id !== moduloId) return m;
        const indice = m.lecciones.findIndex((l) => l.id === leccionId);
        if (indice === -1) return m;
        const lecciones =
          direccion === "arriba" ? moverArriba(m.lecciones, indice) : moverAbajo(m.lecciones, indice);
        return { ...m, lecciones: reindexar(lecciones) };
      }),
    }));
  }

  function actualizarLeccion(moduloId: string, leccionActualizada: Lesson) {
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) =>
        m.id === moduloId
          ? {
              ...m,
              lecciones: m.lecciones.map((l) =>
                l.id === leccionActualizada.id ? leccionActualizada : l
              ),
            }
          : m
      ),
    }));
  }

  function togglePublicado(publicado: boolean) {
    actualizarCurso((c) => ({ ...c, publicado }));
  }

  async function guardar() {
    const supabase = crearClienteNavegador();
    try {
      await guardarCurso(supabase, curso!);
      // Releer el armazon para que el resto de la app (classroom incluido)
      // vea el cambio sin recargar la pagina.
      establecerArmazon(await cargarArmazon(supabase));
      setDirty(false);
      toast.success("Cambios guardados");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudieron guardar los cambios"
      );
    }
  }

  function volver() {
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Salir de todas formas?")) {
      return;
    }
    router.push("/admin/cursos");
  }

  const moduloDeSeleccionada = leccionSeleccionada
    ? moduloDeLeccion(curso, leccionSeleccionada.id)
    : undefined;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={volver}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            <ChevronLeft className="size-3.5" /> Volver a cursos
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl">
              {curso.titulo}
            </h1>
            {dirty && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                Cambios sin guardar
              </Badge>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <Label htmlFor="curso-publicado" className="text-xs text-muted-foreground">
              {curso.publicado ? "Publicado" : "Borrador"}
            </Label>
            <Switch id="curso-publicado" checked={curso.publicado} onCheckedChange={togglePublicado} />
          </div>
          <Button onClick={guardar} disabled={!dirty}>
            <Save /> Guardar cambios
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
        {/* Columna izquierda: estructura */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Estructura del curso
            </h2>
            <Button variant="outline" size="sm" onClick={agregarModulo}>
              <Plus /> Módulo
            </Button>
          </div>

          {curso.modulos.length === 0 ? (
            <EmptyState
              icono={Layers}
              titulo="Sin módulos todavía"
              descripcion="Agrega el primer módulo para empezar a estructurar el curso."
              accion={{ label: "Agregar módulo", onClick: agregarModulo }}
            />
          ) : (
            <div className="space-y-3">
              {curso.modulos.map((modulo, indiceModulo) => (
                <div key={modulo.id} className="rounded-2xl bg-card ring-1 ring-foreground/10">
                  <div className="flex items-center gap-1 border-b border-border p-2.5">
                    <Input
                      value={modulo.titulo}
                      onChange={(e) => renombrarModulo(modulo.id, e.target.value)}
                      aria-label={`Título del módulo ${indiceModulo + 1}`}
                      className="h-8 border-transparent bg-transparent px-1.5 font-display text-sm font-semibold shadow-none hover:border-input focus-visible:border-ring"
                    />
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={indiceModulo === 0}
                        onClick={() => moverModulo(modulo.id, "arriba")}
                        aria-label="Mover módulo arriba"
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={indiceModulo === curso.modulos.length - 1}
                        onClick={() => moverModulo(modulo.id, "abajo")}
                        aria-label="Mover módulo abajo"
                      >
                        <ChevronDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => solicitarEliminarModulo(modulo)}
                        aria-label="Eliminar módulo"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  <div className="border-b border-border px-2.5 py-2">
                    <SubirImagen
                      valor={modulo.portadaUrl ?? ""}
                      onCambio={(url) => actualizarPortadaModulo(modulo.id, url)}
                      proporcion={2 / 3}
                      anchoSalida={800}
                      destino={{
                        tipo: "academia",
                        comunidadId: community.id,
                        uso: "modulo",
                      }}
                      etiqueta={`Subir la portada del módulo ${indiceModulo + 1}`}
                      ayuda="Vertical 2:3, 800 × 1200. El número y el título van encima con un degradado oscuro."
                    />
                  </div>

                  <div className="space-y-1 p-2">
                    {modulo.lecciones.map((leccion, indiceLeccion) => {
                      const seleccionada = leccion.id === leccionSeleccionada?.id;
                      const TipoIcon = leccion.tipo === "video" ? Video : FileText;
                      return (
                        <div
                          key={leccion.id}
                          className={cn(
                            "flex items-center gap-1 rounded-lg pr-1 text-sm",
                            seleccionada ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setLeccionSeleccionadaId(leccion.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left outline-none"
                          >
                            <TipoIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate",
                                seleccionada ? "font-medium text-primary" : "text-foreground"
                              )}
                            >
                              {leccion.titulo || "Sin título"}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {leccion.duracionMin} min
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={indiceLeccion === 0}
                              onClick={() => moverLeccion(modulo.id, leccion.id, "arriba")}
                              aria-label="Mover lección arriba"
                            >
                              <ChevronUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={indiceLeccion === modulo.lecciones.length - 1}
                              onClick={() => moverLeccion(modulo.id, leccion.id, "abajo")}
                              aria-label="Mover lección abajo"
                            >
                              <ChevronDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => eliminarLeccion(modulo.id, leccion.id)}
                              aria-label="Eliminar lección"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => agregarLeccion(modulo.id)}
                    >
                      <Plus /> Agregar lección
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha: editor de la lección seleccionada */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {leccionSeleccionada && moduloDeSeleccionada ? (
            <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
              <LessonEditor
                key={leccionSeleccionada.id}
                leccion={leccionSeleccionada}
                onChange={(l) => actualizarLeccion(moduloDeSeleccionada.id, l)}
              />
            </div>
          ) : (
            <EmptyState
              icono={BookOpen}
              titulo="Selecciona una lección"
              descripcion="Elige una lección del temario a la izquierda, o crea la primera desde un módulo."
            />
          )}
        </div>
      </div>

      <Dialog open={!!moduloAEliminar} onOpenChange={(open) => !open && setModuloAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &quot;{moduloMostrado?.titulo}&quot;?</DialogTitle>
            <DialogDescription>
              Este módulo tiene {moduloMostrado?.lecciones.length}{" "}
              {moduloMostrado?.lecciones.length === 1 ? "lección" : "lecciones"} — se eliminarán
              junto con el módulo. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuloAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => moduloAEliminar && eliminarModulo(moduloAEliminar.id)}
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
