import type { User } from "@/lib/types";
import { haceDias } from "@/lib/mocks/fechas";

// Umbrales de puntos por nivel (1..9). Debe coincidir con los que Task 3
// implementará en src/lib/levels.ts (nivelPorPuntos). Se recalcula aquí,
// sin exportar, únicamente para sembrar el campo `nivel` de forma coherente.
const NIVEL_UMBRALES = [0, 20, 65, 155, 315, 515, 815, 1215, 1715];

function nivelPorPuntos(puntos: number): number {
  let nivel = 1;
  for (let i = 0; i < NIVEL_UMBRALES.length; i++) {
    if (puntos >= NIVEL_UMBRALES[i]) nivel = i + 1;
  }
  return nivel;
}

function sinTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const NOMBRES = [
  "Valentina Ríos",
  "Mateo Herrera",
  "Camila Torres",
  "Santiago Vega",
  "Isabella Morales",
  "Sebastián Castro",
  "Sofía Ramírez",
  "Nicolás Ortiz",
  "Daniela Guzmán",
  "Andrés Peña",
  "Mariana Salazar",
  "Diego Fernández",
  "Luciana Paredes",
  "Emiliano Rojas",
  "Renata Duarte",
  "Joaquín Silva",
  "Antonella Reyes",
  "Máximo Aguirre",
  "Fernanda Cabrera",
  "Tomás Navarro",
  "Paulina Sánchez",
  "Gabriel Medina",
  "Julieta Campos",
  "Ricardo Espinoza",
];

const BIOS = [
  "Apasionada por el marketing digital y los negocios online.",
  "Emprendedor en construcción, aprendiendo algo nuevo cada semana.",
  "Mamá emprendedora, vendo por WhatsApp y redes sociales.",
  "Diseñador freelance explorando cómo escalar sus ingresos.",
  "Estudiante de últimos semestres, fanático de las ventas digitales.",
  "Coach de vida llevando su marca personal al siguiente nivel.",
  "Amante del fitness y los negocios digitales desde casa.",
  "Contador de profesión, emprendedor de corazón.",
];

// Tres usuarios semilla (alumno, creador = Marta, superadmin = dueño de
// Comunidad del Intercambio) + Daniel (u-creador), el fundador original de Academia
// Comunidad del Intercambio: hoy es alumno normal (rol "alumno") y queda como autor de contenido
// histórico (posts/comentarios previos a la reasignación de ownerId a
// u-admin), pero ya no tiene chip de demo ni panel propio.
const seeds: User[] = [
  {
    id: "u-alumno",
    email: "alumno@intercambio.app",
    nombre: "Laura Jiménez",
    avatarUrl: "https://i.pravatar.cc/150?u=u-alumno",
    bio: "Vendo cursos de repostería y quiero profesionalizar mi comunidad.",
    rol: "alumno",
    comunidadIds: ["com-principal"],
    puntos: 85,
    nivel: nivelPorPuntos(85),
    creadoEl: haceDias(140),
  },
  {
    id: "u-creador",
    email: "daniel.restrepo@intercambio.app",
    nombre: "Daniel Restrepo",
    avatarUrl: "https://i.pravatar.cc/150?u=u-creador",
    bio: "Fundador original de Comunidad del Intercambio, hoy la disfruta como un alumno más. Sigue ayudando a emprendedores a lanzar su primer producto digital.",
    rol: "alumno",
    comunidadIds: ["com-principal"],
    puntos: 0,
    nivel: 1,
    creadoEl: haceDias(400),
  },
  {
    id: "u-admin",
    email: "admin@intercambio.app",
    nombre: "Andrea Salinas",
    avatarUrl: "https://i.pravatar.cc/150?u=u-admin",
    bio: "Fundadora de Comunidad del Intercambio. Superviso las comunidades y la facturación de toda la plataforma.",
    rol: "superadmin",
    comunidadIds: ["com-principal", "com-esp"],
    puntos: 0,
    nivel: 1,
    creadoEl: haceDias(500),
  },
  {
    id: "u-creador2",
    email: "creador@intercambio.app",
    nombre: "Marta Gómez",
    avatarUrl: "https://i.pravatar.cc/150?u=u-creador2",
    bio: "Profesora de inglés bilingüe. Fundadora de Inglés con Marta.",
    rol: "creador",
    comunidadIds: ["com-esp"],
    puntos: 0,
    nivel: 1,
    creadoEl: haceDias(200),
  },
];

// 24 miembros generados de forma determinística. Los últimos 6 (u-m19..u-m24)
// también pertenecen a la comunidad secundaria "com-esp".
const miembros: User[] = NOMBRES.map((nombre, i) => {
  const puntos = (i * 37) % 420;
  const primerNombre = sinTildes(nombre.split(" ")[0]);
  const enComEsp = i >= 18; // últimos 6 -> com-esp también
  return {
    id: `u-m${i + 1}`,
    email: `${primerNombre}${i + 1}@mail.com`,
    nombre,
    avatarUrl: `https://i.pravatar.cc/150?u=u-m${i + 1}`,
    bio: BIOS[i % BIOS.length],
    rol: "alumno" as const,
    comunidadIds: enComEsp ? ["com-principal", "com-esp"] : ["com-principal"],
    puntos,
    nivel: nivelPorPuntos(puntos),
    creadoEl: haceDias(100 - i * 3),
  };
});

export const mockUsers: User[] = [...seeds, ...miembros];
