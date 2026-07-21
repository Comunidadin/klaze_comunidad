"use client";

import { aplicarPerfilOverride, useKlazeStore } from "@/lib/store";
import { mockUsers } from "@/lib/mocks/users";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import type { Enrollment, User } from "@/lib/types";

export function useMembers(
  comunidadId: string
): { miembros: (User & { estado: Enrollment["estado"] })[] } {
  const usuariosCreados = useKlazeStore((s) => s.usuariosCreados);
  const enrollmentsExtra = useKlazeStore((s) => s.enrollmentsExtra);
  const perfilOverrides = useKlazeStore((s) => s.perfilOverrides);

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados];
  const enrollments = [...mockEnrollments, ...enrollmentsExtra].filter(
    (e) => e.comunidadId === comunidadId
  );

  const miembros = enrollments
    .map((e) => {
      const usuario = todosLosUsuarios.find((u) => u.id === e.userId);
      if (!usuario) return null;
      return { ...aplicarPerfilOverride(usuario, perfilOverrides), estado: e.estado };
    })
    .filter((m): m is User & { estado: Enrollment["estado"] } => m !== null);

  return { miembros };
}
