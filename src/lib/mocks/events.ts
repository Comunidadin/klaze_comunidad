import type { CommunityEvent } from "@/lib/types";
import { enDias } from "@/lib/mocks/fechas";

export const mockEvents: CommunityEvent[] = [
  {
    id: "evt-1",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    titulo: "Sesión en vivo: Q&A de Lanzamiento",
    descripcion:
      "Trae tus dudas sobre el módulo de lanzamiento y las resolvemos juntos en vivo.",
    fechaInicio: enDias(3, 19),
    duracionMin: 60,
    urlSala: "https://meet.intercambio.app/qa-lanzamiento",
  },
  {
    id: "evt-2",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    titulo: "Taller: Copywriting persuasivo en 60 minutos",
    descripcion:
      "Taller práctico donde reescribimos en vivo el titular de tu landing.",
    fechaInicio: enDias(7, 18),
    duracionMin: 90,
    urlSala: "https://meet.intercambio.app/taller-copywriting",
  },
  {
    id: "evt-3",
    comunidadId: "com-principal",
    cursoId: "curso-3",
    titulo: "Mentoría grupal de Mentoría Élite",
    descripcion:
      "Sesión mensual exclusiva para alumnos de Mentoría Élite (nivel 3 en adelante).",
    fechaInicio: enDias(12, 17),
    duracionMin: 60,
    urlSala: "https://meet.intercambio.app/mentoria-elite",
  },
  {
    id: "evt-4",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    titulo: "Reto de lanzamiento: kickoff",
    descripcion:
      "Arranque en vivo del reto de 5 días de lanzamiento con acompañamiento diario.",
    fechaInicio: enDias(20, 19),
    duracionMin: 45,
    urlSala: "https://meet.intercambio.app/reto-lanzamiento",
  },
  {
    id: "evt-5",
    comunidadId: "com-principal",
    cursoId: "curso-2",
    titulo: "Sesión en vivo: objeciones y cierre por WhatsApp",
    descripcion:
      "Practicamos en vivo el manejo de las objeciones más comunes y el guion de cierre de Ventas por WhatsApp.",
    fechaInicio: enDias(9, 18),
    duracionMin: 60,
    urlSala: "https://meet.intercambio.app/whatsapp-objeciones",
  },
  {
    id: "evt-esp-1",
    comunidadId: "com-esp",
    cursoId: "curso-4",
    titulo: "Práctica conversacional en vivo",
    descripcion:
      "Sesión grupal para practicar conversación en inglés con corrección en el momento.",
    fechaInicio: enDias(5, 20),
    duracionMin: 45,
    urlSala: "https://meet.intercambio.app/practica-ingles",
  },
];
