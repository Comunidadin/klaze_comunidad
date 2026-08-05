import type { Community } from "@/lib/types";
import { haceDias } from "@/lib/mocks/fechas";
import { crearSeccionesDefault } from "@/lib/mocks/espacios";

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

export const mockCommunities: Community[] = [
  {
    id: "com-principal",
    slug: "comunidad-del-intercambio",
    nombre: "Comunidad del Intercambio",
    descripcion:
      "Comunidad para emprendedores digitales que quieren lanzar, vender y escalar sus propios productos en línea.",
    // La comunidad principal es la de la marca: usa el logo real y el cian
    // exacto del logotipo (#06ABEB), el mismo que `--brand` en globals.css.
    logoUrl: "/marca/icono.png",
    colorAcento: "#06ABEB",
    ownerId: "u-admin",
    plan: "pro",
    estado: "activa",
    nombresNiveles: NOMBRES_NIVELES,
    secciones: crearSeccionesDefault(),
    creadoEl: haceDias(400),
    marcaAuth: {
      videoUrl: "https://videos.pexels.com/video-files/3252919/3252919-hd_1920_1080_25fps.mp4",
      posterUrl:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=70",
    },
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
    secciones: crearSeccionesDefault(),
    creadoEl: haceDias(190),
  },
];
