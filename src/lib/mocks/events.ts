import type { CommunityEvent } from "@/lib/types";
import { enDias } from "@/lib/mocks/fechas";

export const mockEvents: CommunityEvent[] = [
  {
    id: "evt-1",
    comunidadId: "com-principal",
    titulo: "Sesión en vivo: Q&A de Lanzamiento",
    descripcion:
      "Trae tus dudas sobre el módulo de lanzamiento y las resolvemos juntos en vivo.",
    fechaInicio: enDias(3, 19),
    duracionMin: 60,
    urlSala: "https://meet.klaze.app/qa-lanzamiento",
  },
  {
    id: "evt-2",
    comunidadId: "com-principal",
    titulo: "Taller: Copywriting persuasivo en 60 minutos",
    descripcion:
      "Taller práctico donde reescribimos en vivo el titular de tu landing.",
    fechaInicio: enDias(7, 18),
    duracionMin: 90,
    urlSala: "https://meet.klaze.app/taller-copywriting",
  },
  {
    id: "evt-3",
    comunidadId: "com-principal",
    titulo: "Mentoría grupal de Mentoría Élite",
    descripcion:
      "Sesión mensual exclusiva para alumnos de Mentoría Élite (nivel 3 en adelante).",
    fechaInicio: enDias(12, 17),
    duracionMin: 60,
    urlSala: "https://meet.klaze.app/mentoria-elite",
  },
  {
    id: "evt-4",
    comunidadId: "com-principal",
    titulo: "Reto de lanzamiento: kickoff",
    descripcion:
      "Arranque en vivo del reto de 5 días de lanzamiento con acompañamiento diario.",
    fechaInicio: enDias(20, 19),
    duracionMin: 45,
    urlSala: "https://meet.klaze.app/reto-lanzamiento",
  },
  {
    id: "evt-esp-1",
    comunidadId: "com-esp",
    titulo: "Práctica conversacional en vivo",
    descripcion:
      "Sesión grupal para practicar conversación en inglés con corrección en el momento.",
    fechaInicio: enDias(5, 20),
    duracionMin: 45,
    urlSala: "https://meet.klaze.app/practica-ingles",
  },
];
