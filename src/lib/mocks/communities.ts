import type { Community } from "@/lib/types";
import { haceDias } from "@/lib/mocks/fechas";

const NOMBRES_NIVELES = [
  "Novato",
  "Explorador",
  "Aprendiz",
  "Constructor",
  "Práctico",
  "Avanzado",
  "Experto",
  "Mentor",
  "Leyenda",
];

const CATEGORIAS = ["Anuncios", "General", "Wins", "Preguntas"];

export const mockCommunities: Community[] = [
  {
    id: "com-principal",
    slug: "academia-klaze",
    nombre: "Academia Klaze",
    descripcion:
      "Comunidad para emprendedores digitales que quieren lanzar, vender y escalar sus propios productos en línea.",
    logoUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=academia-klaze",
    colorAcento: "#6366F1",
    ownerId: "u-admin",
    plan: "pro",
    estado: "activa",
    nombresNiveles: NOMBRES_NIVELES,
    categorias: CATEGORIAS,
    creadoEl: haceDias(400),
  },
  {
    id: "com-esp",
    slug: "ingles-con-marta",
    nombre: "Inglés con Marta",
    descripcion:
      "Clases y práctica guiada de inglés conversacional para hispanohablantes que quieren perder el miedo a hablar.",
    logoUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=ingles-con-marta",
    colorAcento: "#F97316",
    ownerId: "u-creador2",
    plan: "starter",
    estado: "activa",
    nombresNiveles: NOMBRES_NIVELES,
    categorias: CATEGORIAS,
    creadoEl: haceDias(190),
  },
];
