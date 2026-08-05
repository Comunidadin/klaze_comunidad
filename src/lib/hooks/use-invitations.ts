"use client";

import { useAppStore } from "@/lib/store";
import type { Invitation } from "@/lib/types";

export function useInvitations(comunidadId: string): {
  invitaciones: Invitation[];
  crear: (emails: string[], cursoIds: string[] | "todos") => Invitation[];
} {
  // El filtro se hace fuera del selector (no `(s) => s.invitaciones.filter(...)`)
  // a propósito: un selector de zustand que asigna un array nuevo en cada
  // llamada rompe el chequeo de consistencia de `useSyncExternalStore` — dos
  // lecturas consecutivas del mismo estado devuelven referencias distintas,
  // y React lo interpreta como un store inestable ("The result of
  // getSnapshot should be cached to avoid an infinite loop"). El mismo
  // patrón (seleccionar el array crudo, filtrar afuera) ya lo siguen
  // `useMembers` y `useCourses`.
  const todasLasInvitaciones = useAppStore((s) => s.invitaciones);
  const crearInvitaciones = useAppStore((s) => s.crearInvitaciones);

  const invitaciones = todasLasInvitaciones.filter((inv) => inv.comunidadId === comunidadId);

  const crear = (emails: string[], cursoIds: string[] | "todos") =>
    crearInvitaciones(emails, comunidadId, cursoIds);

  return { invitaciones, crear };
}
