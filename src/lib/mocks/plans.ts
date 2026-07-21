import type { Plan } from "@/lib/types";

export const mockPlans: Plan[] = [
  {
    id: "starter",
    nombre: "Starter",
    precioMes: 39,
    limites: { comunidades: 1, alumnos: 50, cursos: 3 },
    destacado: false,
  },
  {
    id: "pro",
    nombre: "Pro",
    precioMes: 99,
    limites: { comunidades: 3, alumnos: 500, cursos: 15 },
    destacado: true,
  },
  {
    id: "scale",
    nombre: "Scale",
    precioMes: 249,
    limites: { comunidades: 10, alumnos: 5000, cursos: 100 },
    destacado: false,
  },
];
