"use client";

import { useState } from "react";
import { toast } from "sonner";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { borrarCurso } from "@/lib/supabase/guardar-curso";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Course } from "@/lib/types";

/**
 * El diálogo de «¿eliminar este módulo?», compartido por los dos sitios que lo
 * ofrecen: la tarjeta de `/admin/cursos` y la cabecera del editor.
 *
 * Compartido y no copiado a propósito. Lo que decide aquí no es cosmético —
 * cuántas clases se van, si hay alumnos con progreso dentro, si hace falta
 * escribir la palabra— y una segunda copia sería el sitio donde ese aviso se
 * quedaría sin actualizar. Es el fallo que ya se pagó en este repo con los
 * consumidores que re-derivaban la lógica de acceso por su cuenta.
 *
 * Borra él mismo y recarga el armazón; quien lo usa solo dice qué hacer
 * después (navegar, o quedarse donde está).
 */
export interface DialogoEliminarModuloProps {
  curso: Course;
  /** Alumnos con acceso a este módulo — sale de `useAdminCourses`. */
  numAlumnos: number;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onEliminado: () => void;
}

export function DialogoEliminarModulo({
  curso,
  numAlumnos,
  abierto,
  onOpenChange,
  onEliminado,
}: DialogoEliminarModuloProps) {
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const [texto, setTexto] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const numClases = curso.modulos.reduce((n, m) => n + m.lecciones.length, 0);
  // Con alumnos dentro, lo que se borra no es solo del creador: es el progreso
  // de otras personas, y no hay papelera de la que sacarlo. Un botón rojo y un
  // «Sí» son poco para eso, así que hay que escribir la palabra.
  const pideEscribir = numAlumnos > 0;
  const puede =
    !eliminando && (!pideEscribir || texto.trim().toLowerCase() === "eliminar");

  async function eliminar() {
    setEliminando(true);
    const supabase = crearClienteNavegador();
    try {
      await borrarCurso(supabase, curso.id);
      establecerArmazon(await cargarArmazon(supabase));
      toast.success(`«${curso.titulo}» eliminado`);
      onEliminado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar el módulo");
      setEliminando(false);
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(a) => {
        if (eliminando) return;
        if (!a) setTexto("");
        onOpenChange(a);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar el módulo &quot;{curso.titulo}&quot;?</DialogTitle>
          <DialogDescription>
            Se van con él sus {curso.modulos.length}{" "}
            {curso.modulos.length === 1 ? "submódulo" : "submódulos"} y sus {numClases}{" "}
            {numClases === 1 ? "clase" : "clases"}
            {pideEscribir ? (
              <>
                , y el progreso de los {numAlumnos}{" "}
                {numAlumnos === 1 ? "alumno que lo tiene" : "alumnos que lo tienen"}. Si
                solo quieres que dejen de verlo, pásalo a borrador desde el editor:
                nada se pierde.
              </>
            ) : (
              ". Esta acción no se puede deshacer."
            )}
          </DialogDescription>
        </DialogHeader>

        {pideEscribir && (
          <div className="space-y-1.5">
            <Label htmlFor={`confirmar-${curso.id}`}>
              Escribe <span className="font-semibold">eliminar</span> para confirmar
            </Label>
            <Input
              id={`confirmar-${curso.id}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="eliminar"
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={eliminando}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void eliminar()} disabled={!puede}>
            {eliminando ? "Eliminando…" : "Sí, eliminar el módulo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
