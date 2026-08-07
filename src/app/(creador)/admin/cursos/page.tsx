"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Plus } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useAdminCourses } from "@/lib/hooks/use-admin-courses";
import { slugify, useAppStore } from "@/lib/store";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { guardarCurso } from "@/lib/supabase/guardar-curso";
import { guardarSecciones } from "@/lib/supabase/espacios";
import { crearSeccionesDefault } from "@/lib/espacios-default";
import { AdminCourseCard } from "@/components/admin/admin-course-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubirImagen } from "@/components/shared/subir-imagen";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Course } from "@/lib/types";

function CursosSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-2xl sm:aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}

/**
 * `/admin/cursos`: cuadrícula de todos los cursos de la comunidad (incluye
 * borradores — `useAdminCourses`, a diferencia del `useCourses` que ve el
 * classroom de miembros) + diálogo para crear uno nuevo. El curso nuevo
 * nace como borrador (`publicado: false`) y navega directo al editor para
 * que el creador arme su estructura.
 */
export default function AdminCursosPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const { cursos } = useAdminCourses(community?.id ?? "");
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const router = useRouter();

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [portadaUrl, setPortadaUrl] = useState("");

  if (!hydrated) {
    return <CursosSkeleton />;
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

  function handleOpenChange(open: boolean) {
    setDialogAbierto(open);
    if (!open) {
      setTitulo("");
      setDescripcion("");
      setPrecio("");
      setPortadaUrl("");
    }
  }

  async function crearCurso() {
    if (!community || !titulo.trim()) return;

    const id = crypto.randomUUID();
    // El slug tiene que ser unico por comunidad, y dos cursos pueden llamarse
    // igual. Se le pega un sufijo corto del id, que ya es unico.
    const base = slugify(titulo) || "curso";
    const numero = id.slice(0, 8);

    const curso: Course = {
      id,
      comunidadId: community.id,
      slug: `${base}-${numero}`,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      portadaUrl: portadaUrl.trim(),
      precioReferencial: Math.max(0, Number(precio) || 0),
      nivelRequerido: null,
      modulos: [],
      publicado: false,
      // Los espacios se siembran justo después, con `guardarSecciones`: van a
      // su propia tabla, no dentro del curso.
      secciones: [],
    };

    const supabase = crearClienteNavegador();
    try {
      await guardarCurso(supabase, curso);
      // Un curso nuevo nace con sus espacios por defecto: si su pestaña de
      // comunidad arranca en blanco, nadie la usa.
      await guardarSecciones(supabase, curso.id, crearSeccionesDefault());
      establecerArmazon(await cargarArmazon(supabase));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo crear la vitrina"
      );
      return;
    }

    toast.success(`«${curso.titulo}» creado como borrador`);
    handleOpenChange(false);
    router.push(`/admin/cursos/${curso.id}`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Cursos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cursos.length} {cursos.length === 1 ? "vitrina" : "vitrinas"} en {community.nombre}.
          </p>
        </div>

        <Dialog open={dialogAbierto} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Nuevo curso
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva vitrina</DialogTitle>
              <DialogDescription>
                Se crea como borrador — publícalo cuando esté listo desde el editor.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nuevo-titulo">Título</Label>
                <Input
                  id="nuevo-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Lanzamiento Digital Pro"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nuevo-descripcion">Descripción</Label>
                <Textarea
                  id="nuevo-descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="De qué trata la vitrina…"
                  className="min-h-20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nuevo-precio">Precio referencial (USD)</Label>
                <Input
                  id="nuevo-precio"
                  type="number"
                  min={0}
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* A ancho completo: el recuadro de encuadre se abre aquí dentro
                  y en media columna no cabe. */}
              <div className="space-y-1.5">
                <Label>Portada</Label>
                <SubirImagen
                  valor={portadaUrl}
                  onCambio={setPortadaUrl}
                  proporcion={16 / 9}
                  anchoSalida={1280}
                  destino={{ tipo: "academia", comunidadId: community.id, uso: "portada" }}
                  etiqueta="Subir la portada de la vitrina"
                  ayuda="16:9, 1280 × 720. En la ficha de la vitrina se estira a una franja ancha y lleva un degradado oscuro abajo para el título, así que deja lo importante en el centro. Sin portada mostramos un fondo con la inicial de la vitrina."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={crearCurso} disabled={!titulo.trim()}>
                Crear curso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {cursos.length === 0 ? (
        <EmptyState
          icono={BookOpen}
          titulo="Todavía no tienes vitrinas"
          descripcion="Crea tu primera vitrina para empezar a estructurar cursos y clases."
          accion={{ label: "Nueva vitrina", onClick: () => setDialogAbierto(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((curso) => (
            <AdminCourseCard key={curso.id} curso={curso} />
          ))}
        </div>
      )}
    </div>
  );
}
