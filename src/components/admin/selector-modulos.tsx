"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Course } from "@/lib/types";

/**
 * Elegir a qué módulos da acceso algo: una invitación, o el acceso ya
 * concedido a un alumno.
 *
 * Compartido y no copiado porque las dos pantallas tienen que decir lo mismo.
 * En cuanto una enseñe los módulos con otro criterio —o se olvide de aclarar
 * que «toda la comunidad» incluye los futuros— el dueño creerá que ha dado un
 * acceso distinto del que dio.
 *
 * `valor` es `"todos"` o la lista de ids, la misma forma que guardan la
 * invitación y la inscripción, para que nadie tenga que traducir por el camino.
 */
export interface SelectorModulosProps {
  cursos: Course[];
  valor: string[] | "todos";
  onCambio: (valor: string[] | "todos") => void;
  etiqueta?: string;
}

export function SelectorModulos({
  cursos,
  valor,
  onCambio,
  etiqueta = "¿A qué dan acceso?",
}: SelectorModulosProps) {
  const todos = valor === "todos";
  const seleccionados = todos ? [] : valor;

  function alternarCurso(id: string, marcado: boolean) {
    if (todos) return;
    onCambio(marcado ? [...seleccionados, id] : seleccionados.filter((c) => c !== id));
  }

  return (
    <div className="space-y-2.5">
      <Label>{etiqueta}</Label>

      <label className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm has-aria-checked:border-primary/40 has-aria-checked:bg-primary/5">
        <Checkbox
          checked={todos}
          onCheckedChange={(v) => onCambio(v === true ? "todos" : [])}
        />
        <span className="font-medium text-foreground">Toda la comunidad</span>
        <span className="text-muted-foreground">
          — acceso a todos los módulos, presentes y futuros
        </span>
      </label>

      {cursos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no tienes módulos sueltos — por ahora solo puedes dar acceso a
          &quot;Toda la comunidad&quot;.
        </p>
      ) : (
        <div
          className={
            "grid grid-cols-1 gap-2 sm:grid-cols-2" +
            (todos ? " pointer-events-none opacity-50" : "")
          }
        >
          {cursos.map((curso) => (
            <label
              key={curso.id}
              className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm has-aria-checked:border-primary/40 has-aria-checked:bg-primary/5"
            >
              <Checkbox
                checked={seleccionados.includes(curso.id)}
                disabled={todos}
                onCheckedChange={(v) => alternarCurso(curso.id, v === true)}
              />
              <span className="truncate text-foreground">{curso.titulo}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
