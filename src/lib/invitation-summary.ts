import type { Course, Invitation } from "@/lib/types";

/**
 * Texto compacto para la columna "Cursos" de una invitación: "Toda la
 * comunidad" cuando `cursoIds === "todos"`, o los títulos separados por coma
 * (recorta a 2 + "y X más" si son muchos). Usado tanto en la tabla completa
 * de /admin/accesos como en el resumen de "Últimos accesos" del dashboard.
 */
export function resumenCursosInvitacion(
  cursoIds: Invitation["cursoIds"],
  cursos: Course[]
): string {
  if (cursoIds === "todos") return "Toda la comunidad";

  const titulos = cursoIds
    .map((id) => cursos.find((c) => c.id === id)?.titulo)
    .filter((t): t is string => !!t);

  if (titulos.length === 0) return "Sin cursos";
  if (titulos.length <= 2) return titulos.join(", ");
  return `${titulos.slice(0, 2).join(", ")} y ${titulos.length - 2} más`;
}
