"use client";

import { useState } from "react";
import { mockUsers } from "@/lib/mocks/users";
import { haceDias } from "@/lib/mocks/fechas";
import type { User } from "@/lib/types";

export interface LessonCommentConAutor {
  id: string;
  autor: User;
  cuerpo: string;
  creadoEl: string;
}

const AUTOR_DESCONOCIDO: User = {
  id: "u-desconocido",
  email: "",
  nombre: "Usuario",
  avatarUrl: "https://i.pravatar.cc/150?u=u-desconocido",
  bio: "",
  rol: "alumno",
  comunidadIds: [],
  puntos: 0,
  nivel: 1,
  creadoEl: "2026-07-20T12:00:00.000Z",
};

// Textos genéricos que funcionan para cualquier lección — se combinan con
// un hash determinístico del id de lección para variar autor/texto sin
// necesitar contenido a medida por lección.
const PLANTILLAS = [
  "Excelente explicación, ya lo apliqué en mi negocio esta semana.",
  "¿Alguien más lo probó con un producto físico? Cuéntenme cómo les fue.",
  "De los módulos que más me ha servido hasta ahora, gracias por lo claro.",
  "Tuve que verlo dos veces pero ahora quedó clarísimo.",
  "¿Existe una plantilla descargable de esto o toca hacerlo desde cero?",
  "Justo el empujón que necesitaba para animarme a lanzar.",
];

function hashDeterministico(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Siembra 2 comentarios mock por lección, solo para el curso 1 (el que se
 * usa en las demos/verificación). Autor y texto se derivan de un hash
 * determinístico del id de lección — nunca `Math.random()` — así que la
 * lista es estable entre renders y entre servidor/cliente.
 */
function comentariosSemilla(leccionId: string): Omit<LessonCommentConAutor, "id">[] {
  if (!leccionId.startsWith("c1-")) return [];

  const candidatos = mockUsers.filter((u) => u.rol === "alumno" && u.id !== "u-alumno");
  if (candidatos.length < 2) return [];

  const base = hashDeterministico(leccionId);
  const autor1 = candidatos[base % candidatos.length];
  const autor2 = candidatos[(base + 7) % candidatos.length];

  return [
    {
      autor: autor1,
      cuerpo: PLANTILLAS[base % PLANTILLAS.length],
      creadoEl: haceDias(3 + (base % 5)),
    },
    {
      autor: autor2,
      cuerpo: PLANTILLAS[(base + 3) % PLANTILLAS.length],
      creadoEl: haceDias(1 + (base % 3)),
    },
  ];
}

function sembrarConId(leccionId: string): LessonCommentConAutor[] {
  return comentariosSemilla(leccionId).map((c, i) => ({ id: `${leccionId}-seed-${i}`, ...c }));
}

export interface UseLessonCommentsResult {
  comentarios: LessonCommentConAutor[];
  /** Agrega un comentario local (no persistido) firmado por `userId`. */
  agregar: (userId: string, cuerpo: string) => void;
}

/**
 * Comentarios de una lección: 2 semillas determinísticas (solo curso 1) +
 * lo que el usuario agregue en esta sesión. Estado 100% local (`useState`),
 * se pierde al recargar — no hay persistencia ni backend para comentarios.
 */
export function useLessonComments(leccionId: string): UseLessonCommentsResult {
  // Si `leccionId` cambia (navegación a otra lección) reseteamos el estado
  // sincrónicamente durante el render — patrón recomendado por React para
  // "resetear estado cuando cambia una prop" sin depender de que el
  // componente se remonte (no podemos garantizarlo en App Router).
  const [leccionIdPrevia, setLeccionIdPrevia] = useState(leccionId);
  const [comentarios, setComentarios] = useState<LessonCommentConAutor[]>(() =>
    sembrarConId(leccionId)
  );

  if (leccionId !== leccionIdPrevia) {
    setLeccionIdPrevia(leccionId);
    setComentarios(sembrarConId(leccionId));
  }

  function agregar(userId: string, cuerpo: string) {
    const texto = cuerpo.trim();
    if (!texto) return;
    const autor = mockUsers.find((u) => u.id === userId) ?? AUTOR_DESCONOCIDO;
    setComentarios((prev) => [
      ...prev,
      {
        id: `${leccionId}-local-${prev.length}`,
        autor,
        cuerpo: texto,
        creadoEl: new Date().toISOString(),
      },
    ]);
  }

  return { comentarios, agregar };
}
