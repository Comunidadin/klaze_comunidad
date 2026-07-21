import type { Course, Lesson } from "@/lib/types";

// IDs reales y públicos de Vimeo (staff picks de demo). Se reutilizan en
// rotación para las lecciones de video — esto es solo contenido mock.
const VIMEO_IDS = ["76979871", "148751763", "259411563"];

function video(
  id: string,
  titulo: string,
  orden: number,
  duracionMin: number,
  contenido: string,
  recursos: Lesson["recursos"] = []
): Lesson {
  return {
    id,
    titulo,
    orden,
    tipo: "video",
    vimeoId: VIMEO_IDS[(orden - 1) % VIMEO_IDS.length],
    duracionMin,
    contenido,
    recursos,
  };
}

function texto(
  id: string,
  titulo: string,
  orden: number,
  duracionMin: number,
  contenido: string,
  recursos: Lesson["recursos"] = []
): Lesson {
  return {
    id,
    titulo,
    orden,
    tipo: "texto",
    vimeoId: null,
    duracionMin,
    contenido,
    recursos,
  };
}

// ---------------------------------------------------------------------------
// Curso 1: Lanzamiento Digital Pro (comunidad principal)
// 4 módulos / 15 lecciones video + 1 lección de texto
// ---------------------------------------------------------------------------

const curso1: Course = {
  id: "curso-1",
  comunidadId: "com-principal",
  slug: "lanzamiento-digital-pro",
  titulo: "Lanzamiento Digital Pro",
  descripcion:
    "Aprende a validar, crear y lanzar tu primer producto digital en 30 días, sin experiencia previa.",
  portadaUrl:
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80",
  precioReferencial: 149,
  nivelRequerido: null,
  publicado: true,
  modulos: [
    {
      id: "c1-m1",
      titulo: "Fundamentos y validación de tu oferta",
      orden: 1,
      portadaUrl:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=560&fit=crop&q=80",
      lecciones: [
        video(
          "c1-m1-l1",
          "Bienvenida al programa",
          1,
          8,
          "Qué vas a lograr en las próximas semanas y cómo está organizado el programa.",
          [{ nombre: "Guía de bienvenida.pdf", url: "https://mock.klaze.app/recursos/guia-bienvenida.pdf" }]
        ),
        video(
          "c1-m1-l2",
          "Cómo elegir un nicho rentable",
          2,
          14,
          "Los 3 filtros para saber si un nicho tiene demanda real antes de invertir tiempo."
        ),
        video(
          "c1-m1-l3",
          "Valida tu idea antes de crear nada",
          3,
          12,
          "Encuestas, conversaciones y preventas: cómo validar sin gastar en producción."
        ),
        video(
          "c1-m1-l4",
          "Define tu cliente ideal",
          4,
          10,
          "Construye el perfil de la persona que más necesita lo que vas a enseñar.",
          [{ nombre: "Plantilla cliente ideal.pdf", url: "https://mock.klaze.app/recursos/plantilla-cliente-ideal.pdf" }]
        ),
      ],
    },
    {
      id: "c1-m2",
      titulo: "Crea tu producto digital",
      orden: 2,
      portadaUrl:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=560&fit=crop&q=80",
      lecciones: [
        video(
          "c1-m2-l5",
          "Estructura de un curso que se vende solo",
          5,
          16,
          "El esqueleto de módulos y lecciones que mantiene a tus alumnos avanzando."
        ),
        video(
          "c1-m2-l6",
          "Graba tus primeras lecciones con el celular",
          6,
          11,
          "Luz, sonido y encuadre: cómo grabar contenido profesional sin equipo caro."
        ),
        video(
          "c1-m2-l7",
          "Diseña una portada profesional sin ser diseñador",
          7,
          9,
          "Herramientas gratuitas y plantillas para una portada que vende."
        ),
        video(
          "c1-m2-l8",
          "Precios: cómo poner el número correcto",
          8,
          13,
          "Estrategias de precio de entrada, anclaje y ofertas por tiempo limitado."
        ),
      ],
    },
    {
      id: "c1-m3",
      titulo: "Landing page y checkout",
      orden: 3,
      portadaUrl:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=560&fit=crop&q=80",
      lecciones: [
        video(
          "c1-m3-l9",
          "Anatomía de una landing que convierte",
          9,
          15,
          "Los bloques que no pueden faltar: promesa, prueba social y llamado a la acción.",
          [{ nombre: "Checklist de landing.pdf", url: "https://mock.klaze.app/recursos/checklist-landing.pdf" }]
        ),
        video(
          "c1-m3-l10",
          "Copywriting persuasivo paso a paso",
          10,
          18,
          "Cómo escribir titulares y bullets que hacen que la gente siga leyendo."
        ),
        video(
          "c1-m3-l11",
          "Configura tu pasarela de pago",
          11,
          10,
          "Conecta tu checkout y recibe pagos en minutos, sin conocimientos técnicos."
        ),
        texto(
          "c1-m3-l12",
          "Checklist antes de publicar tu landing",
          12,
          5,
          "Antes de compartir el link de tu landing, revisa estos puntos:\n\n1. El titular comunica el resultado, no la característica.\n2. Hay al menos un testimonio o prueba social visible.\n3. El botón de compra se repite arriba, en medio y al final.\n4. El precio y la garantía están claros.\n5. Probaste el checkout con una compra real (y te reembolsaste).\n6. La página carga bien en celular.",
          [{ nombre: "Checklist de landing.pdf", url: "https://mock.klaze.app/recursos/checklist-landing.pdf" }]
        ),
      ],
    },
    {
      id: "c1-m4",
      titulo: "Lanzamiento y primeras ventas",
      orden: 4,
      portadaUrl:
        "https://images.unsplash.com/photo-1552581234-26160f608093?w=400&h=560&fit=crop&q=80",
      lecciones: [
        video(
          "c1-m4-l13",
          "Estrategia de lanzamiento en 5 días",
          13,
          17,
          "El calendario exacto de contenido y correos para tu semana de lanzamiento."
        ),
        video(
          "c1-m4-l14",
          "Cómo conseguir tus primeros 10 clientes",
          14,
          14,
          "Tácticas de alcance directo cuando todavía no tienes audiencia grande."
        ),
        video(
          "c1-m4-l15",
          "Email de lanzamiento que sí se abre",
          15,
          12,
          "Estructura de asunto y cuerpo para tus correos de lanzamiento."
        ),
        video(
          "c1-m4-l16",
          "Qué hacer después de tu primera venta",
          16,
          9,
          "Onboarding de tu primer cliente y cómo pedir el primer testimonio."
        ),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Curso 2: Ventas por WhatsApp (comunidad principal)
// 2 módulos / 6 lecciones video
// ---------------------------------------------------------------------------

const curso2: Course = {
  id: "curso-2",
  comunidadId: "com-principal",
  slug: "ventas-por-whatsapp",
  titulo: "Ventas por WhatsApp",
  descripcion:
    "Convierte WhatsApp en tu canal de ventas número uno: guiones, automatizaciones y seguimiento que cierra.",
  portadaUrl:
    "https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=800&q=80",
  precioReferencial: 79,
  nivelRequerido: null,
  publicado: true,
  modulos: [
    {
      id: "c2-m1",
      titulo: "Fundamentos de venta conversacional",
      orden: 1,
      portadaUrl:
        "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400&h=560&fit=crop&q=80",
      lecciones: [
        video("c2-m1-l1", "Por qué WhatsApp vende más que el email", 1, 10, "Las razones detrás de las tasas de apertura y respuesta de WhatsApp."),
        video("c2-m1-l2", "Configura tu WhatsApp Business como pro", 2, 12, "Catálogo, respuestas rápidas y etiquetas: la configuración base."),
        video("c2-m1-l3", "El guion de bienvenida que engancha", 3, 9, "El primer mensaje que decide si la conversación sigue o se corta."),
      ],
    },
    {
      id: "c2-m2",
      titulo: "Cierre y seguimiento",
      orden: 2,
      lecciones: [
        video("c2-m2-l4", "Manejo de objeciones por chat", 4, 14, "Respuestas listas para las objeciones más comunes: precio, tiempo y confianza."),
        video("c2-m2-l5", "Automatiza tus respuestas sin perder calidez", 5, 11, "Cómo usar plantillas y mensajes rápidos sin sonar a robot."),
        video("c2-m2-l6", "Seguimiento post-venta y recompra", 6, 8, "El mensaje de seguimiento que abre la puerta a la segunda venta."),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Curso 3: Mentoría Élite (comunidad principal) — requiere nivel 3
// 1 módulo / 4 lecciones video
// ---------------------------------------------------------------------------

const curso3: Course = {
  id: "curso-3",
  comunidadId: "com-principal",
  slug: "mentoria-elite",
  titulo: "Mentoría Élite",
  descripcion:
    "Sesiones avanzadas de mentoría 1 a muchos para alumnos que ya vendieron y quieren escalar.",
  portadaUrl:
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80",
  precioReferencial: 349,
  nivelRequerido: 3,
  publicado: true,
  modulos: [
    {
      id: "c3-m1",
      titulo: "Sesiones de mentoría avanzada",
      orden: 1,
      lecciones: [
        video("c3-m1-l1", "Cómo escalar a seis cifras", 1, 20, "El plan de escalamiento que separa a los negocios que crecen de los que se estancan."),
        video("c3-m1-l2", "Construye tu equipo sin perder cultura", 2, 18, "Primeras contrataciones: qué delegar primero y qué nunca soltar."),
        video("c3-m1-l3", "Negociación con partners y afiliados", 3, 15, "Cómo estructurar acuerdos de afiliados que benefician a ambas partes."),
        video("c3-m1-l4", "Preguntas y respuestas con Daniel", 4, 22, "Sesión abierta de preguntas con Daniel, fundador original de Academia Klaze y hoy alumno de la comunidad."),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Curso 4: Inglés Conversacional desde Cero (comunidad secundaria)
// 1 módulo / 5 lecciones video
// ---------------------------------------------------------------------------

const curso4: Course = {
  id: "curso-4",
  comunidadId: "com-esp",
  slug: "ingles-conversacional-desde-cero",
  titulo: "Inglés Conversacional desde Cero",
  descripcion: "Pierde el miedo a hablar inglés con práctica real desde tu primera clase.",
  portadaUrl:
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80",
  precioReferencial: 49,
  nivelRequerido: null,
  publicado: true,
  modulos: [
    {
      id: "c4-m1",
      titulo: "Primeros pasos",
      orden: 1,
      lecciones: [
        video("c4-m1-l1", "Tu primera conversación en inglés", 1, 9, "Un diálogo corto y guiado para perder el miedo a equivocarte."),
        video("c4-m1-l2", "Presentarte con confianza", 2, 8, "Frases clave para presentarte en cualquier contexto informal."),
        video("c4-m1-l3", "Vocabulario esencial del día a día", 3, 11, "Las 50 palabras que más vas a usar en una conversación real."),
        video("c4-m1-l4", "Pronunciación: los sonidos que más cuestan", 4, 13, "Ejercicios para los sonidos del inglés que no existen en español."),
        video("c4-m1-l5", "Practica: pide un café en inglés", 5, 7, "Simulación de una conversación cotidiana de principio a fin."),
      ],
    },
  ],
};

export const mockCourses: Course[] = [curso1, curso2, curso3, curso4];
