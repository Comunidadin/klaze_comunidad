import type { Enrollment } from "@/lib/types";
import { mockUsers } from "@/lib/mocks/users";

const miembrosPrincipal = mockUsers.filter((u) => u.id.startsWith("u-m"));

export const mockEnrollments: Enrollment[] = [
  // Alumno semilla: acceso solo a los dos primeros cursos de la principal.
  {
    id: "enr-alumno-principal",
    userId: "u-alumno",
    comunidadId: "com-principal",
    cursoIds: ["curso-1", "curso-2"],
    estado: "activo",
  },
  // Los 24 miembros tienen acceso a todos los cursos de la comunidad principal.
  ...miembrosPrincipal.map(
    (u): Enrollment => ({
      id: `enr-${u.id}-principal`,
      userId: u.id,
      comunidadId: "com-principal",
      cursoIds: "todos",
      estado: "activo",
    })
  ),
  // Los miembros que también pertenecen a "com-esp" tienen acceso total ahí.
  ...miembrosPrincipal
    .filter((u) => u.comunidadIds.includes("com-esp"))
    .map(
      (u): Enrollment => ({
        id: `enr-${u.id}-esp`,
        userId: u.id,
        comunidadId: "com-esp",
        cursoIds: "todos",
        estado: "activo",
      })
    ),
];
