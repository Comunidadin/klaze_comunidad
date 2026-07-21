"use client";

import { useKlazeStore } from "@/lib/store";
import type { Invitation } from "@/lib/types";

export function useInvitations(comunidadId: string): {
  invitaciones: Invitation[];
  crear: (emails: string[], cursoIds: string[] | "todos") => Invitation[];
} {
  const invitaciones = useKlazeStore((s) =>
    s.invitaciones.filter((inv) => inv.comunidadId === comunidadId)
  );
  const crearInvitaciones = useKlazeStore((s) => s.crearInvitaciones);

  const crear = (emails: string[], cursoIds: string[] | "todos") =>
    crearInvitaciones(emails, comunidadId, cursoIds);

  return { invitaciones, crear };
}
