import type { Post, PostComment } from "@/lib/types";
import { haceDias } from "@/lib/mocks/fechas";

function comentario(
  id: string,
  autorId: string,
  cuerpo: string,
  diasAtras: number,
  likes: string[] = [],
  respuestas: PostComment[] = []
): PostComment {
  return { id, autorId, cuerpo, likes, respuestas, creadoEl: haceDias(diasAtras) };
}

// ---------------------------------------------------------------------------
// Comunidad principal — 20 posts (1 fijado) repartidos en varios espacios
// ---------------------------------------------------------------------------

const principal: Post[] = [
  {
    id: "post-1",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-admin",
    espacioId: "esp-anuncios-curso-1",
    titulo: "📌 Bienvenido a Comunidad del Intercambio — empieza aquí",
    cuerpo:
      "¡Hola! Soy Andrea, fundadora de Comunidad del Intercambio. Este es tu punto de partida: revisa el módulo 1 de Lanzamiento Digital Pro, preséntate en este post y cuéntanos en qué etapa de tu negocio estás. Estamos para acompañarte.",
    fijado: true,
    likes: ["u-alumno", "u-m1", "u-m2", "u-m3", "u-m4", "u-m5", "u-m6", "u-m7", "u-m8", "u-m9"],
    comentarios: [
      comentario("post-1-c1", "u-alumno", "¡Recién llegando! Vendo cursos de repostería, feliz de estar aquí.", 138, ["u-creador", "u-m1"], [
        comentario("post-1-c1-r1", "u-creador", "Bienvenida Laura, ese nicho tiene mucho potencial 🙌", 137),
      ]),
      comentario("post-1-c2", "u-m3", "Llevo dos semanas y ya terminé el módulo 1, se siente muy claro todo.", 130, ["u-creador"]),
      comentario("post-1-c3", "u-m9", "¿Hay algún canal para presentarnos con foto o solo aquí en el post?", 120, [], [
        comentario("post-1-c3-r1", "u-creador", "Puedes usar la categoría General para eso, ¡anímate!", 119),
      ]),
    ],
    creadoEl: haceDias(400),
  },
  {
    id: "post-2",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-creador",
    espacioId: "esp-anuncios-curso-1",
    titulo: "Nueva lección disponible: 'Checklist antes de publicar tu landing'",
    cuerpo:
      "Acabo de subir una lección corta con el checklist exacto que uso antes de publicar cualquier landing. Está en el módulo 3 de Lanzamiento Digital Pro. Revísenla antes de publicar la suya.",
    fijado: false,
    likes: ["u-m2", "u-m5", "u-m9", "u-m14"],
    comentarios: [
      comentario("post-2-c1", "u-m5", "Justo lo necesitaba, gracias Daniel.", 37),
      comentario("post-2-c2", "u-m14", "¿Se puede descargar como PDF también?", 36, [], [
        comentario("post-2-c2-r1", "u-creador", "Sí, está adjunto en la misma lección.", 36),
      ]),
    ],
    creadoEl: haceDias(38),
  },
  {
    id: "post-3",
    comunidadId: "com-principal",
    cursoId: "curso-3",
    autorId: "u-creador",
    espacioId: "esp-anuncios-curso-3",
    titulo: "Mentoría Élite abre cupos este viernes",
    cuerpo:
      "Para quienes ya alcanzaron nivel Aprendiz o más: el viernes abrimos 15 cupos nuevos de Mentoría Élite. Es un espacio pequeño para negocios que ya están vendiendo y quieren escalar.",
    fijado: false,
    likes: ["u-m6", "u-m11", "u-m22"],
    comentarios: [],
    creadoEl: haceDias(21),
  },
  {
    id: "post-4",
    comunidadId: "com-principal",
    cursoId: "curso-2",
    autorId: "u-admin",
    espacioId: "esp-anuncios-curso-2",
    titulo: "Mantenimiento programado el sábado a medianoche",
    cuerpo:
      "El sábado a las 12:00 a.m. haremos mantenimiento de la plataforma por unos 20 minutos. Es posible que el video se vea afectado brevemente. Gracias por su paciencia.",
    fijado: false,
    likes: ["u-m1"],
    comentarios: [],
    creadoEl: haceDias(5),
  },
  {
    id: "post-5",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m1",
    espacioId: "esp-bienvenida-curso-1",
    titulo: "¿Alguien más grabando su primer curso desde el celular?",
    cuerpo:
      "Estoy grabando todo con mi celular siguiendo la lección de iluminación y sonido. Se ve mejor de lo que esperaba. ¿Tips extra de quienes ya pasaron por esto?",
    fijado: false,
    likes: ["u-m3", "u-m7", "u-creador"],
    comentarios: [
      comentario("post-5-c1", "u-m7", "Usa un trípode barato, cambia todo. Yo grabé mis primeras 5 lecciones sosteniendo el celular y se nota.", 43),
      comentario("post-5-c2", "u-creador", "Totalmente de acuerdo, y busca luz natural de ventana antes que un aro de luz.", 43),
    ],
    creadoEl: haceDias(44),
  },
  {
    id: "post-6",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m3",
    espacioId: "esp-bienvenida-curso-1",
    titulo: "Mi rutina de contenido semanal (la comparto por si sirve)",
    cuerpo:
      "Lunes: planeo 3 ideas. Miércoles: grabo. Viernes: publico y respondo comentarios. Me ha ayudado a no improvisar cada día. ¿Cómo organizan ustedes el suyo?",
    fijado: false,
    likes: ["u-m1", "u-m8", "u-m12", "u-m20"],
    comentarios: [
      comentario("post-6-c1", "u-m8", "Yo hago algo parecido pero los domingos planeo el mes completo.", 39),
      comentario("post-6-c2", "u-m12", "¿Cuántas horas le dedicas al día en total?", 38, [], [
        comentario("post-6-c2-r1", "u-m3", "Como una hora, máximo hora y media.", 38),
      ]),
      comentario("post-6-c3", "u-m20", "Guardando este post, gracias por compartir.", 36),
    ],
    creadoEl: haceDias(40),
  },
  {
    id: "post-7",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m7",
    espacioId: "esp-general-curso-1",
    titulo: "Lo que más me costó del módulo 2",
    cuerpo:
      "Sinceramente el precio fue lo que más me costó decidir. Terminé usando el ejercicio de anclaje de la lección 8 y me ayudó a no regalar mi trabajo.",
    fijado: false,
    likes: ["u-m4", "u-m9"],
    comentarios: [
      comentario("post-7-c1", "u-m4", "A mí me pasó exactamente lo mismo, el miedo a cobrar de más.", 32),
    ],
    creadoEl: haceDias(33),
  },
  {
    id: "post-8",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m11",
    espacioId: "esp-general-curso-1",
    titulo: "Herramienta gratuita que uso para diseñar mis portadas",
    cuerpo:
      "Uso Canva con las plantillas que recomienda Daniel en la lección 7. En 20 minutos tuve una portada que se ve profesional sin pagar nada.",
    fijado: false,
    likes: ["u-m2", "u-m15", "u-m18"],
    comentarios: [],
    creadoEl: haceDias(27),
  },
  {
    id: "post-9",
    comunidadId: "com-principal",
    cursoId: "curso-2",
    autorId: "u-m14",
    espacioId: "esp-general-curso-2",
    titulo: "Recomendación de libro para quienes venden por WhatsApp",
    cuerpo:
      "Después del curso de Ventas por WhatsApp me metí a leer más sobre venta conversacional. Si alguien quiere referencias en español, tengo un par guardadas.",
    fijado: false,
    likes: ["u-m6"],
    comentarios: [
      comentario("post-9-c1", "u-m6", "¡Sí por favor! Compárteme los títulos.", 18, [], [
        comentario("post-9-c1-r1", "u-m14", "Te escribo por WhatsApp de la comunidad 😉", 17),
      ]),
    ],
    creadoEl: haceDias(19),
  },
  {
    id: "post-10",
    comunidadId: "com-principal",
    cursoId: "curso-2",
    autorId: "u-m20",
    espacioId: "esp-general-curso-2",
    titulo: "¿Cómo organizan su calendario de contenido?",
    cuerpo:
      "Estoy probando Notion pero se me hace pesado. ¿Alguien usa algo más simple, tipo una hoja de cálculo?",
    fijado: false,
    likes: [],
    comentarios: [],
    creadoEl: haceDias(3),
  },
  {
    id: "post-11",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m2",
    espacioId: "esp-wins-curso-1",
    titulo: "¡Cerré mi primera venta gracias al módulo 3!",
    cuerpo:
      "Publiqué mi landing el lunes siguiendo el checklist exacto y el jueves ya tenía mi primera venta. Todavía no lo puedo creer, gracias a toda la comunidad por el empujón.",
    fijado: false,
    likes: ["u-creador", "u-m1", "u-m3", "u-m5", "u-m9", "u-m14"],
    comentarios: [
      comentario("post-11-c1", "u-creador", "¡Felicidades Mateo! Esa es la energía 🚀", 42, ["u-m2"]),
      comentario("post-11-c2", "u-m5", "Increíble, ¡me motivas a terminar la mía!", 41, [], [
        comentario("post-11-c2-r1", "u-m2", "¡Vas a poder! Sigue el checklist tal cual está.", 41),
      ]),
      comentario("post-11-c3", "u-m9", "¿Cuánto tiempo te tomó desde que empezaste el módulo?", 40),
    ],
    creadoEl: haceDias(42),
  },
  {
    id: "post-12",
    comunidadId: "com-principal",
    cursoId: "curso-2",
    autorId: "u-m5",
    espacioId: "esp-wins-curso-2",
    titulo: "Superé mi meta del mes vendiendo Ventas por WhatsApp",
    cuerpo:
      "Me propuse 5 ventas este mes usando el guion de bienvenida del curso y cerré 8. El manejo de objeciones del módulo 2 fue clave.",
    fijado: false,
    likes: ["u-m2", "u-m7", "u-m11"],
    comentarios: [
      comentario("post-12-c1", "u-m7", "¡Qué crack! ¿Usaste el guion tal cual o lo adaptaste?", 30, [], [
        comentario("post-12-c1-r1", "u-m5", "Lo adapté un poco al tono de mi marca, pero la estructura quedó igual.", 30),
      ]),
    ],
    creadoEl: haceDias(31),
  },
  {
    id: "post-13",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m9",
    espacioId: "esp-wins-curso-1",
    titulo: "Mi landing ya tiene 3% de conversión",
    cuerpo:
      "Después de aplicar el copywriting del módulo 3, pasé de 0.8% a 3% de conversión. El titular nuevo hizo toda la diferencia.",
    fijado: false,
    likes: ["u-creador", "u-m11", "u-m20"],
    comentarios: [
      comentario("post-13-c1", "u-m11", "¿Compartes el antes y después del titular?", 23, [], [
        comentario("post-13-c1-r1", "u-m9", "Claro, lo dejo en un comentario en un rato con capturas.", 23),
      ]),
    ],
    creadoEl: haceDias(24),
  },
  {
    id: "post-14",
    comunidadId: "com-principal",
    cursoId: "curso-2",
    autorId: "u-m16",
    espacioId: "esp-wins-curso-2",
    titulo: "Primer cliente recurrente 🎉",
    cuerpo:
      "Un cliente que compró en el lanzamiento pasado volvió a comprar mi segundo producto. El mensaje de seguimiento post-venta funcionó tal como lo explican en el curso.",
    fijado: false,
    likes: ["u-m2", "u-m14"],
    comentarios: [],
    creadoEl: haceDias(14),
  },
  {
    id: "post-15",
    comunidadId: "com-principal",
    cursoId: "curso-2",
    autorId: "u-m22",
    espacioId: "esp-wins-curso-2",
    titulo: "Llegué a nivel Práctico esta semana",
    cuerpo:
      "Entre comentarios, likes y terminar el curso de Ventas por WhatsApp subí a nivel Práctico. Poco a poco se siente el avance.",
    fijado: false,
    likes: ["u-m4", "u-m18"],
    comentarios: [],
    creadoEl: haceDias(2),
  },
  {
    id: "post-16",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-alumno",
    espacioId: "esp-preguntas-curso-1",
    titulo: "¿Cuánto debería cobrar por mi primer curso?",
    cuerpo:
      "Voy a lanzar un curso de repostería casera y no tengo idea de cuánto cobrar. ¿Cómo decidieron ustedes su primer precio?",
    fijado: false,
    likes: ["u-m1", "u-m6"],
    comentarios: [
      comentario("post-16-c1", "u-creador", "Regla simple: empieza con un precio que te dé un poco de vergüenza cobrar, casi siempre está bajo el valor real.", 46, ["u-alumno", "u-m1"]),
      comentario("post-16-c2", "u-m6", "A mí me sirvió mirar qué cobra la competencia y quedar 20% abajo al inicio.", 45),
      comentario("post-16-c3", "u-m1", "Yo cobré muy barato al principio y me costó subir el precio después, ojo con eso.", 45, [], [
        comentario("post-16-c3-r1", "u-alumno", "Buen punto, no había pensado en eso.", 44),
      ]),
      comentario("post-16-c4", "u-m11", "Revisa la lección 8 del módulo 2, ahí explican el anclaje de precio.", 44),
      comentario("post-16-c5", "u-m9", "¡Suerte con el lanzamiento, la repostería vende muy bien en video!", 43),
    ],
    creadoEl: haceDias(46),
  },
  {
    id: "post-17",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m4",
    espacioId: "esp-preguntas-curso-1",
    titulo: "¿Qué pasarela de pago recomiendan para Latinoamérica?",
    cuerpo:
      "Vendo a varios países de la región y quiero simplificar mi checkout. ¿Con cuál pasarela les ha ido mejor?",
    fijado: false,
    likes: ["u-m10", "u-m17"],
    comentarios: [
      comentario("post-17-c1", "u-m10", "Yo uso la que recomiendan en la lección 11, me funcionó desde el primer día.", 35),
      comentario("post-17-c2", "u-m17", "Depende del país, en algunos conviene tener dos opciones activas.", 34),
      comentario("post-17-c3", "u-creador", "Buen punto Antonella, en la próxima actualización agrego una comparativa.", 34),
    ],
    creadoEl: haceDias(36),
  },
  {
    id: "post-18",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m8",
    espacioId: "esp-preguntas-curso-1",
    titulo: "¿Cómo consiguen sus primeros testimonios?",
    cuerpo:
      "Todavía no tengo ninguno y siento que mi landing se ve vacía sin prueba social. ¿Alguna forma de conseguirlos rápido y honesto?",
    fijado: false,
    likes: ["u-m2"],
    comentarios: [
      comentario("post-18-c1", "u-m2", "Ofrece acceso gratuito a 3-5 personas a cambio de un testimonio sincero, así empecé yo.", 28),
    ],
    creadoEl: haceDias(29),
  },
  {
    id: "post-19",
    comunidadId: "com-principal",
    cursoId: "curso-1",
    autorId: "u-m13",
    espacioId: "esp-preguntas-curso-1",
    titulo: "¿Vale la pena hacer un lanzamiento en vivo o grabado?",
    cuerpo:
      "Estoy en la lección de estrategia de lanzamiento y no sé si animarme a hacer algo en vivo o simplemente grabar todo con calma.",
    fijado: false,
    likes: ["u-m16"],
    comentarios: [
      comentario("post-19-c1", "u-m16", "En vivo genera más urgencia, pero grabado te da menos estrés. Yo empecé grabado.", 16),
      comentario("post-19-c2", "u-creador", "Para el primer lanzamiento, grabado. Deja lo en vivo para cuando ya tengas comunidad activa.", 15),
    ],
    creadoEl: haceDias(17),
  },
  {
    id: "post-20",
    comunidadId: "com-principal",
    cursoId: "curso-3",
    autorId: "u-m18",
    espacioId: "esp-preguntas-curso-3",
    titulo: "¿Alguien ha probado dar mentoría en grupo pequeño?",
    cuerpo:
      "Estoy pensando en ofrecer mentoría grupal además de mi curso grabado. ¿Cómo estructuran las sesiones quienes ya lo hacen?",
    fijado: false,
    likes: [],
    comentarios: [],
    creadoEl: haceDias(1),
  },
];

// ---------------------------------------------------------------------------
// Comunidad secundaria — 3 posts
// ---------------------------------------------------------------------------

const secundaria: Post[] = [
  {
    id: "post-esp-1",
    comunidadId: "com-esp",
    cursoId: "curso-4",
    autorId: "u-creador2",
    espacioId: "esp-anuncios-curso-4",
    titulo: "Bienvenidos al espacio de práctica de Inglés con Marta",
    cuerpo:
      "¡Hola a todos! Este espacio es para practicar entre clases. Comenten sus dudas, compartan frases nuevas y anímense a hablar sin miedo a equivocarse.",
    fijado: false,
    likes: ["u-m19", "u-m21", "u-m24"],
    comentarios: [
      comentario("post-esp-1-c1", "u-m19", "¡Gracias Marta! Llevo dos clases y ya me siento más segura.", 60),
    ],
    creadoEl: haceDias(180),
  },
  {
    id: "post-esp-2",
    comunidadId: "com-esp",
    cursoId: "curso-4",
    autorId: "u-m19",
    espacioId: "esp-bienvenida-curso-4",
    titulo: "Grupo de práctica los jueves 7pm",
    cuerpo:
      "Organizamos una llamada informal los jueves a las 7pm solo para practicar conversación. ¿Se suman?",
    fijado: false,
    likes: ["u-m21", "u-m23"],
    comentarios: [
      comentario("post-esp-2-c1", "u-m23", "Yo me apunto, ¿en qué link nos vemos?", 12, [], [
        comentario("post-esp-2-c1-r1", "u-m19", "Te escribo el link por el chat de la comunidad.", 12),
      ]),
    ],
    creadoEl: haceDias(15),
  },
  {
    id: "post-esp-3",
    comunidadId: "com-esp",
    cursoId: "curso-4",
    autorId: "u-m21",
    espacioId: "esp-wins-curso-4",
    titulo: "¡Ya puedo mantener una conversación de 5 minutos en inglés!",
    cuerpo:
      "Practiqué con la lección de pedir un café y ayer me animé a hacerlo de verdad en una cafetería. ¡Funcionó!",
    fijado: false,
    likes: ["u-creador2", "u-m19"],
    comentarios: [
      comentario("post-esp-3-c1", "u-creador2", "¡Eso es exactamente el objetivo! Muy orgullosa, Paulina.", 4),
    ],
    creadoEl: haceDias(5),
  },
];

export const mockPosts: Post[] = [...principal, ...secundaria];
