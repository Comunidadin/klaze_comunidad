"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Layers,
  Plus,
  Save,
  SearchX,
  Trash2,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { guardarCurso } from "@/lib/supabase/guardar-curso";
import { contarBloqueadosPorGoteo } from "@/lib/supabase/alumnos";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useAdminCourse } from "@/lib/hooks/use-admin-courses";
import { useAppStore } from "@/lib/store";
import { leccionesOrdenadas, moduloDeLeccion, modulosOrdenados } from "@/components/course/course-utils";
import { SubirImagen } from "@/components/shared/subir-imagen";
import { LessonEditor } from "@/components/admin/lesson-editor";
import { ICONO_CLASE } from "@/components/course/iconos-clase";
import { DialogoEliminarModulo } from "@/components/admin/eliminar-modulo";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Course, CourseModule, Lesson } from "@/lib/types";
import { tipoDeClase } from "@/lib/types";
import { avisoDeCierre, type ConfigGoteo, type GoteoModo } from "@/lib/goteo";

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
    titulo: "Nueva clase",
    orden: 0,
    duracionMin: 5,
    // Nace vacia y con un video dentro: es la pieza que se pone en el 90% de
    // los casos, y una clase sin piezas no se puede ver.
    bloques: [{ id: crypto.randomUUID(), tipo: "video", vimeoId: "" }],
    iaHabilitada: false,
    recursos: [],
  };
}

/**
 * ISO → el formato que pide `datetime-local`, en la zona del navegador.
 *
 * `toISOString()` daría UTC y el creador vería una hora distinta de la que
 * escribió. `sv-SE` se usa porque su formato es `YYYY-MM-DD HH:mm`, a un
 * espacio de distancia del que necesita el campo.
 */
function paraCampoLocal(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(" ", "T");
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
  // a "0 clases" en el frame en que se limpia el estado.
  const [moduloMostrado, setModuloMostrado] = useState<CourseModule | null>(null);
  if (moduloAEliminar && moduloAEliminar !== moduloMostrado) {
    setModuloMostrado(moduloAEliminar);
  }
  const [confirmarBorrarCurso, setConfirmarBorrarCurso] = useState(false);

  // La configuración de goteo y el `publicado` con los que se cargó el
  // módulo (o con los que se guardó por última vez), para que el aviso de
  // "esto cierra el módulo" solo salte cuando de verdad hay algo nuevo que
  // cierre contenido — ver `guardar()`. `publicado` va aquí también porque
  // publicar es tan "cierre" como configurar el goteo: un módulo en borrador
  // no le cierra nada a nadie, y el instante en que se publica es justo
  // cuando empieza a hacerlo. Un `ref` y no estado: no participa en el
  // render, solo en la comparación de `guardar`.
  const alCargar = useRef<ConfigGoteo & { publicado: boolean }>({
    goteoModo: "ninguno",
    goteoDias: null,
    goteoDesde: null,
    publicado: false,
  });

  // Siembra la copia local de edición la primera vez que `cursoOriginal`
  // resuelve para este `cursoId` — ver docstring de arriba. Ajustar estado
  // durante el render (no en un efecto) evita un frame con `curso: null`
  // antes de que la copia esté lista.
  if (cursoOriginal && cursoOriginal.id !== cursoIdCargado) {
    setCursoIdCargado(cursoOriginal.id);
    setCurso({ ...cursoOriginal, modulos: modulosOrdenados(cursoOriginal) });
    setDirty(false);
    alCargar.current = {
      goteoModo: cursoOriginal.goteoModo,
      goteoDias: cursoOriginal.goteoDias,
      goteoDesde: cursoOriginal.goteoDesde,
      publicado: cursoOriginal.publicado,
    };
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
        titulo="Módulo no encontrado"
        descripcion="Este módulo no existe o no pertenece a tu comunidad."
        accion={{ label: "Volver a módulos", href: "/admin/cursos" }}
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
      modulos: reindexar([...c.modulos, { id, titulo: "Nuevo submódulo", orden: 0, lecciones: [], publicado: false }]),
    }));
  }

  function togglePublicadoModulo(moduloId: string) {
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) =>
        m.id === moduloId ? { ...m, publicado: !m.publicado } : m
      ),
    }));
  }

  function renombrarModulo(moduloId: string, titulo: string) {
    actualizarCurso((c) => ({
      ...c,
      modulos: c.modulos.map((m) => (m.id === moduloId ? { ...m, titulo } : m)),
    }));
  }

  function actualizarPortadaCurso(portadaUrl: string) {
    actualizarCurso((c) => ({ ...c, portadaUrl: portadaUrl.trim() }));
  }

  function renombrarCurso(titulo: string) {
    actualizarCurso((c) => ({ ...c, titulo }));
  }

  function actualizarDescripcionCurso(descripcion: string) {
    actualizarCurso((c) => ({ ...c, descripcion }));
  }

  /**
   * El precio solo se enseña, no se cobra: es el «valor referencial» que ve
   * quien todavía no tiene acceso. Se guarda como número porque el campo de
   * texto devuelve cadena, y un `NaN` aquí acabaría escrito en la base.
   */
  function actualizarPrecioCurso(valor: string) {
    actualizarCurso((c) => ({
      ...c,
      precioReferencial: Math.max(0, Number(valor) || 0),
    }));
  }

  /**
   * Cambiar el modo limpia el campo del otro modo. Sin esto quedaría un
   * `goteoDias` de 7 bajo un modo `fecha`, que la restricción de la base
   * rechaza con un error que nadie sabría leer.
   */
  function actualizarModoGoteo(goteoModo: GoteoModo) {
    actualizarCurso((c) => ({
      ...c,
      goteoModo,
      goteoDias: goteoModo === "dias" ? (c.goteoDias ?? 7) : null,
      goteoDesde: goteoModo === "fecha" ? c.goteoDesde : null,
    }));
  }

  function actualizarDiasGoteo(valor: string) {
    actualizarCurso((c) => ({ ...c, goteoDias: Math.max(1, Number(valor) || 1) }));
  }

  function actualizarFechaGoteo(valor: string) {
    // `datetime-local` da "2026-09-15T14:00" sin zona. `new Date` lo interpreta
    // en la del navegador, que es la que el creador tiene en la cabeza cuando
    // escribe "las 9 de la mañana".
    actualizarCurso((c) => ({
      ...c,
      goteoDesde: valor ? new Date(valor).toISOString() : null,
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
    // Un módulo sin título sale como una tarjeta en blanco en el classroom de
    // sus alumnos, y desde ahí no hay pista de cuál era.
    if (!curso?.titulo.trim()) {
      toast.error("El módulo necesita un título.");
      return;
    }

    // Mismo espíritu que la validación del título: atajar aquí lo que la
    // restricción `cursos_goteo_coherente` de la base rechazaría de todos
    // modos, para no enseñar su mensaje crudo de Postgres.
    if (curso.goteoModo === "fecha" && !curso.goteoDesde) {
      toast.error("Elige la fecha y la hora en que se abre el módulo.");
      return;
    }
    if (curso.goteoModo === "dias" && (!curso.goteoDias || curso.goteoDias < 1)) {
      toast.error("Los días tienen que ser un número mayor que cero.");
      return;
    }

    const supabase = crearClienteNavegador();

    try {
      // El aviso solo aparece cuando de verdad cierra algo:
      // - `curso.publicado`, porque un módulo en Borrador no lo ve ningún
      //   alumno todavía — el goteo no le cierra nada a nadie y el aviso
      //   sería falso.
      // - `hayQueAvisar`, para que no salte en cada guardado mientras nada
      //   nuevo cierre contenido (el precio, la portada, una clase nueva…):
      //   un aviso que grita siempre deja de leerse, y el día que de verdad
      //   cierre algo el creador ya le da a Aceptar sin mirar.
      // Va dentro del `try` y no antes: si esta consulta lanza, tiene que
      // caer en el mismo `catch` que ya avisa al creador, no salir como un
      // rechazo sin manejar.
      const cambioElGoteo =
        curso.goteoModo !== alCargar.current.goteoModo ||
        curso.goteoDias !== alCargar.current.goteoDias ||
        curso.goteoDesde !== alCargar.current.goteoDesde;

      // Publicar es tan «cierre» como configurar el goteo: un módulo en
      // borrador no se lo cierra a nadie, y el instante en que se publica es
      // justo cuando empieza a hacerlo. Sin esta segunda mitad, configurar el
      // goteo en borrador y publicar después se cuela sin decir nada.
      const seAcabaDePublicar = curso.publicado && !alCargar.current.publicado;
      const hayQueAvisar = cambioElGoteo || seAcabaDePublicar;

      // `community` no puede ser nulo aquí en la práctica (el componente ya
      // devolvió el estado vacío antes de definir esta función), pero
      // TypeScript no propaga esa comprobación dentro de una función anidada.
      if (curso.goteoModo !== "ninguno" && curso.publicado && hayQueAvisar && community) {
        const { bloqueados, total } = await contarBloqueadosPorGoteo(
          supabase,
          community.id,
          curso.id,
          curso,
          new Date()
        );
        if (bloqueados > 0) {
          const seguir = window.confirm(
            avisoDeCierre({ titulo: curso.titulo, bloqueados, total })
          );
          if (!seguir) return;
        }
      }

      await guardarCurso(supabase, { ...curso, titulo: curso.titulo.trim() });
      // Releer el armazon para que el resto de la app (classroom incluido)
      // vea el cambio sin recargar la pagina.
      establecerArmazon(await cargarArmazon(supabase));
      // Para que un segundo guardado seguido, con el goteo y el publicado ya
      // en su sitio, no vuelva a preguntar.
      alCargar.current = {
        goteoModo: curso.goteoModo,
        goteoDias: curso.goteoDias,
        goteoDesde: curso.goteoDesde,
        publicado: curso.publicado,
      };
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

  // Del original y no de la copia local: `numAlumnos` lo calcula
  // `useAdminCourse` a partir de las inscripciones, y no es algo que el editor
  // pueda cambiar.
  const numAlumnos = cursoOriginal?.numAlumnos ?? 0;

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
            <ChevronLeft className="size-3.5" /> Volver a módulos
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl">
              {curso.titulo.trim() || "Sin título"}
            </h1>
            {dirty && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                Cambios sin guardar
              </Badge>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {/* En el extremo opuesto a "Guardar cambios", con el interruptor de
              publicación entre medias: es el botón que más se aprieta al día,
              y pegarle al lado el que destruye invita al resbalón. */}
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmarBorrarCurso(true)}
          >
            <Trash2 /> Eliminar
          </Button>
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

      {/* Los datos del módulo. Ninguno de estos campos estaba aquí: se
          escribían en el diálogo de creación y ya no se podían tocar, así que
          una errata en el título quedaba para siempre. Y los cuatro son lo que
          el alumno ve en la ficha del módulo. */}
      <div className="mb-6 space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="space-y-1.5">
          <Label htmlFor="curso-titulo">Título del módulo</Label>
          <Input
            id="curso-titulo"
            value={curso.titulo}
            onChange={(e) => renombrarCurso(e.target.value)}
            placeholder="Ej. Lanzamiento Digital Pro"
          />
          <p className="text-xs text-muted-foreground">
            Cambiarlo no rompe ningún enlace: la dirección del módulo no sale
            del título.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="curso-descripcion">Descripción</Label>
          <Textarea
            id="curso-descripcion"
            value={curso.descripcion}
            onChange={(e) => actualizarDescripcionCurso(e.target.value)}
            placeholder="De qué trata el módulo…"
            className="min-h-20"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="curso-precio">Precio referencial (USD)</Label>
          <Input
            id="curso-precio"
            type="number"
            min={0}
            value={curso.precioReferencial}
            onChange={(e) => actualizarPrecioCurso(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Solo se enseña a quien todavía no tiene acceso. Klaze no cobra nada
            con esto.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="curso-goteo">Cuándo se abre</Label>
          <Select
            value={curso.goteoModo}
            onValueChange={(v) => actualizarModoGoteo(v as GoteoModo)}
          >
            <SelectTrigger id="curso-goteo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ninguno">Al comprar</SelectItem>
              <SelectItem value="dias">A los … días de entrar a la academia</SelectItem>
              <SelectItem value="fecha">En una fecha concreta</SelectItem>
            </SelectContent>
          </Select>

          {curso.goteoModo === "dias" && (
            <Input
              type="number"
              min={1}
              value={curso.goteoDias ?? 7}
              onChange={(e) => actualizarDiasGoteo(e.target.value)}
              aria-label="Días desde que el alumno entra a la academia"
            />
          )}

          {curso.goteoModo === "fecha" && (
            <Input
              type="datetime-local"
              value={curso.goteoDesde ? paraCampoLocal(curso.goteoDesde) : ""}
              onChange={(e) => actualizarFechaGoteo(e.target.value)}
              aria-label="Fecha y hora en que se abre el módulo"
            />
          )}

          <p className="text-xs text-muted-foreground">
            {curso.goteoModo === "ninguno"
              ? "Tus alumnos lo ven en cuanto reciben acceso."
              : "Mientras esté cerrado, tus alumnos ven el módulo con un candado y la fecha en que se abre. Tú lo ves siempre, para poder prepararlo."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Portada del módulo</Label>
          <SubirImagen
            valor={curso.portadaUrl}
            onCambio={actualizarPortadaCurso}
            proporcion={16 / 9}
            anchoSalida={1280}
            destino={{ tipo: "academia", comunidadId: community.id, uso: "portada" }}
            etiqueta="Subir la portada del módulo"
            ayuda="16:9, 1280 × 720. Se estira a una franja ancha con un degradado oscuro abajo para el título, así que deja lo importante en el centro."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
        {/* Columna izquierda: estructura */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Estructura del módulo
            </h2>
            <Button variant="outline" size="sm" onClick={agregarModulo}>
              <Plus /> Submódulo
            </Button>
          </div>

          {curso.modulos.length === 0 ? (
            <EmptyState
              icono={Layers}
              titulo="Sin submódulos todavía"
              descripcion="Agrega el primer submódulo para empezar a estructurar el módulo."
              accion={{ label: "Agregar submódulo", onClick: agregarModulo }}
            />
          ) : (
            <div className="space-y-3">
              {curso.modulos.map((modulo, indiceModulo) => (
                <div key={modulo.id} className="rounded-2xl bg-card ring-1 ring-foreground/10">
                  <div className="flex items-center gap-1 border-b border-border p-2.5">
                    <Input
                      value={modulo.titulo}
                      onChange={(e) => renombrarModulo(modulo.id, e.target.value)}
                      aria-label={`Título del submódulo ${indiceModulo + 1}`}
                      className="h-8 border-transparent bg-transparent px-1.5 font-display text-sm font-semibold shadow-none hover:border-input focus-visible:border-ring"
                    />
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground sm:inline">
                        {modulo.lecciones.length}{" "}
                        {modulo.lecciones.length === 1 ? "clase" : "clases"}
                      </span>

                      {/* El estado a la vista y a un clic, sin abrir nada: es
                          lo que permite tener media módulo publicado y el
                          resto en borrador mientras se prepara. */}
                      <button
                        type="button"
                        onClick={() => togglePublicadoModulo(modulo.id)}
                        className={cn(
                          "shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                          modulo.publicado
                            ? "bg-brand/15 text-brand hover:bg-brand/25"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        )}
                        aria-pressed={modulo.publicado}
                        aria-label={
                          modulo.publicado
                            ? `Pasar ${modulo.titulo} a borrador`
                            : `Publicar ${modulo.titulo}`
                        }
                      >
                        {modulo.publicado ? "Publicado" : "Borrador"}
                      </button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={indiceModulo === 0}
                        onClick={() => moverModulo(modulo.id, "arriba")}
                        aria-label="Mover submódulo arriba"
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={indiceModulo === curso.modulos.length - 1}
                        onClick={() => moverModulo(modulo.id, "abajo")}
                        aria-label="Mover submódulo abajo"
                      >
                        <ChevronDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => solicitarEliminarModulo(modulo)}
                        aria-label="Eliminar submódulo"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  <div className="border-b border-border px-2.5 py-2">
                    <SubirImagen
                      valor={modulo.portadaUrl ?? ""}
                      onCambio={(url) => actualizarPortadaModulo(modulo.id, url)}
                      proporcion={16 / 9}
                      anchoSalida={1280}
                      destino={{
                        tipo: "academia",
                        comunidadId: community.id,
                        uso: "modulo",
                      }}
                      etiqueta={`Subir la portada del módulo ${indiceModulo + 1}`}
                      ayuda="16:9 · 1280 × 720"
                    />
                  </div>

                  <div className="space-y-1 p-2">
                    {modulo.lecciones.map((leccion, indiceLeccion) => {
                      const seleccionada = leccion.id === leccionSeleccionada?.id;
                      const TipoIcon = ICONO_CLASE[tipoDeClase(leccion.bloques)];
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
                              aria-label="Mover clase arriba"
                            >
                              <ChevronUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={indiceLeccion === modulo.lecciones.length - 1}
                              onClick={() => moverLeccion(modulo.id, leccion.id, "abajo")}
                              aria-label="Mover clase abajo"
                            >
                              <ChevronDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => eliminarLeccion(modulo.id, leccion.id)}
                              aria-label="Eliminar clase"
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
                      <Plus /> Agregar clase
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
                comunidadId={community.id}
                onChange={(l) => actualizarLeccion(moduloDeSeleccionada.id, l)}
              />
            </div>
          ) : (
            <EmptyState
              icono={BookOpen}
              titulo="Selecciona una clase"
              descripcion="Elige una clase del temario a la izquierda, o crea la primera desde un submódulo."
            />
          )}
        </div>
      </div>

      <DialogoEliminarModulo
        curso={curso}
        numAlumnos={numAlumnos}
        abierto={confirmarBorrarCurso}
        onOpenChange={setConfirmarBorrarCurso}
        // Aquí sí hay que irse: el editor de un módulo que ya no existe no
        // tiene nada que enseñar.
        onEliminado={() => router.push("/admin/cursos")}
      />

      <Dialog open={!!moduloAEliminar} onOpenChange={(open) => !open && setModuloAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &quot;{moduloMostrado?.titulo}&quot;?</DialogTitle>
            <DialogDescription>
              Este submódulo tiene {moduloMostrado?.lecciones.length}{" "}
              {moduloMostrado?.lecciones.length === 1 ? "clase" : "clases"} — se eliminarán
              junto con él. Esta acción no se puede deshacer.
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
