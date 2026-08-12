"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { cambiarPublicadoCurso, guardarCurso } from "@/lib/supabase/guardar-curso";
import { contarBloqueadosPorGoteo } from "@/lib/supabase/alumnos";
import { avisoDeCierre, notaDeGoteo } from "@/lib/goteo";
import { useAppStore } from "@/lib/store";
import { modulosOrdenados } from "@/components/course/course-utils";
import { DialogoEliminarModulo } from "@/components/admin/eliminar-modulo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CourseConAdmin } from "@/lib/hooks/use-admin-courses";

/**
 * Una fila de la lista de módulos, que se abre para enseñar sus submódulos.
 *
 * Sustituye a la cuadrícula de tarjetas. La razón es de escala: una tarjeta con
 * portada 16:9 ocupa media pantalla, y un temario de verdad son diez módulos —
 * con tarjetas hay que bajar mucho para ver el índice de tu propio curso, que
 * es justo lo que un índice tiene que evitar.
 *
 * Lo que se puede hacer sin entrar al editor: reordenar, publicar, renombrar
 * (lleva al editor), eliminar y añadir un submódulo. Es la lista de trabajo de
 * quien monta el temario, no un escaparate.
 */
export interface FilaModuloProps {
  curso: CourseConAdmin;
  primero: boolean;
  ultimo: boolean;
  onMover: (direccion: "arriba" | "abajo") => void;
}

export function FilaModulo({ curso, primero, ultimo, onMover }: FilaModuloProps) {
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const submodulos = modulosOrdenados(curso);
  const numClases = curso.modulos.reduce((n, m) => n + m.lecciones.length, 0);
  // Se ve desde la lista y no solo dentro del editor: con ocho módulos, tener
  // que abrirlos uno a uno para reconstruir el calendario recién montado es
  // justo cuando se cuelan los huecos y los solapes.
  const nota = notaDeGoteo(curso);

  async function alternarPublicado() {
    const vaAPublicar = !curso.publicado;
    setOcupado(true);
    const supabase = crearClienteNavegador();
    try {
      // Publicar es el momento en que el goteo empieza a cerrar contenido de
      // verdad: antes de esta fila estaba en Borrador y nadie lo veía. Esta
      // es la puerta más rápida para publicar —y por eso la más usada— así
      // que sin este aviso sería la única que no dice nada. Va dentro del
      // `try`, no antes: si la consulta falla, tiene que caer en el mismo
      // `catch` que ya avisa, no salir como un rechazo sin manejar.
      if (vaAPublicar && curso.goteoModo !== "ninguno") {
        const { bloqueados, total } = await contarBloqueadosPorGoteo(
          supabase,
          curso.comunidadId,
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

      await cambiarPublicadoCurso(supabase, curso.id, vaAPublicar);
      establecerArmazon(await cargarArmazon(supabase));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Añade un submódulo sin salir de la lista.
   *
   * Pasa por `guardarCurso` con el curso entero porque el editor guarda así, y
   * un segundo camino que escribiera solo en `modulos` tendría que repetir el
   * borrado de lo que sobra. Es una escritura de más a cambio de una regla
   * menos que mantener en dos sitios.
   */
  async function agregarSubmodulo() {
    setOcupado(true);
    const supabase = crearClienteNavegador();
    try {
      await guardarCurso(supabase, {
        ...curso,
        modulos: [
          ...curso.modulos,
          {
            id: crypto.randomUUID(),
            titulo: "Nuevo submódulo",
            orden: curso.modulos.length + 1,
            lecciones: [],
            publicado: false,
          },
        ],
      });
      establecerArmazon(await cargarArmazon(supabase));
      setAbierto(true);
      toast.success("Submódulo añadido. Ábrelo para ponerle nombre y clases.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo añadir el submódulo");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 p-3">
        {/* Flechas y no arrastrar: arrastrar necesita una biblioteca, no
            funciona con teclado y en móvil pelea con el desplazamiento. */}
        <div className="flex shrink-0 flex-col">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={primero}
            onClick={() => onMover("arriba")}
            aria-label={`Subir ${curso.titulo}`}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={ultimo}
            onClick={() => onMover("abajo")}
            aria-label={`Bajar ${curso.titulo}`}
          >
            <ChevronDown />
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              abierto && "rotate-180"
            )}
          />
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold text-foreground">
              {curso.titulo || "Sin título"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {submodulos.length}{" "}
              {submodulos.length === 1 ? "submódulo" : "submódulos"} · {numClases}{" "}
              {numClases === 1 ? "clase" : "clases"} · {curso.numAlumnos}{" "}
              {curso.numAlumnos === 1 ? "alumno" : "alumnos"}
              {nota && <span className="text-primary"> · {nota}</span>}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => void alternarPublicado()}
          disabled={ocupado}
          aria-pressed={curso.publicado}
          aria-label={
            curso.publicado ? `Pasar ${curso.titulo} a borrador` : `Publicar ${curso.titulo}`
          }
          className={cn(
            "shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            curso.publicado
              ? "bg-brand/15 text-brand hover:bg-brand/25"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          {curso.publicado ? "Publicado" : "Borrador"}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${curso.titulo}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/admin/cursos/${curso.id}`)}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmando(true)}
            >
              <Trash2 /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {abierto && (
        <div className="space-y-1 border-t border-border bg-muted/30 p-2">
          {submodulos.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Este módulo todavía no tiene submódulos.
            </p>
          ) : (
            submodulos.map((m) => (
              <Link
                key={m.id}
                href={`/admin/cursos/${curso.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {m.titulo || "Sin título"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {m.lecciones.length} {m.lecciones.length === 1 ? "clase" : "clases"}
                </span>
                {!m.publicado && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Borrador
                  </span>
                )}
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => void agregarSubmodulo()}
            disabled={ocupado}
          >
            <Plus /> Nuevo submódulo
          </Button>
        </div>
      )}

      <DialogoEliminarModulo
        curso={curso}
        numAlumnos={curso.numAlumnos}
        abierto={confirmando}
        onOpenChange={setConfirmando}
        onEliminado={() => setConfirmando(false)}
      />
    </div>
  );
}
