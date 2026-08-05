"use client";

import { resolverComunidad, useAppStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { useCourses } from "@/lib/hooks/use-courses";
import type { Community, Course, Invitation } from "@/lib/types";

export interface UseInvitationResult {
  invitacion: Invitation;
  comunidad: Community;
  /** Cursos nombrados por la invitación. Vacío cuando `todosLosCursos` es true. */
  cursos: Course[];
  todosLosCursos: boolean;
}

/**
 * Resuelve una invitación por token contra `store.invitaciones` y su
 * comunidad (mock o creada en runtime vía `registrarCreador`). Devuelve
 * `null` solo cuando el token no existe o su comunidad no se pudo
 * resolver — la página distingue "pendiente" de "aceptada" leyendo
 * `invitacion.estado`, así puede mostrar el mensaje correcto en cada caso
 * sin que este hook tenga que modelar esos 3 estados.
 *
 * No usa `useCommunity` (busca por slug y no aplica aquí: la invitación
 * solo tiene `comunidadId`), pero sí reutiliza `useCourses` para resolver
 * los títulos de los cursos incluidos.
 */
export function useInvitation(token: string): UseInvitationResult | null {
  const invitaciones = useAppStore((s) => s.invitaciones);
  const comunidadesCreadas = useAppStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useAppStore((s) => s.comunidadOverrides);

  const invitacion = invitaciones.find((inv) => inv.token === token) ?? null;

  const comunidadBase = invitacion
    ? (comunidadesCreadas.find((c) => c.id === invitacion.comunidadId) ??
      mockCommunities.find((c) => c.id === invitacion.comunidadId) ??
      null)
    : null;
  const comunidad = comunidadBase ? resolverComunidad(comunidadBase, comunidadOverrides) : null;

  // Hooks siempre se llaman en el mismo orden: `useCourses` corre en cada
  // render (con comunidadId vacío si aún no hay invitación resuelta) y el
  // early-return va después.
  const { cursos: cursosComunidad } = useCourses(invitacion?.comunidadId ?? "");

  if (!invitacion || !comunidad) return null;

  const todosLosCursos = invitacion.cursoIds === "todos";
  const cursos = todosLosCursos
    ? []
    : cursosComunidad.filter((c) => (invitacion.cursoIds as string[]).includes(c.id));

  return { invitacion, comunidad, cursos, todosLosCursos };
}
