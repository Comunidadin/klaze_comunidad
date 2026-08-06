import type { CommunitySection } from "@/lib/types";

/**
 * Secciones y espacios con los que nace un curso.
 *
 * No es un dato semilla: lo usa código de producción cuando se crea un curso
 * real, y por eso vive aquí y no en `src/lib/mocks/`. Sembrar el curso con esta
 * estructura evita que su pestaña de comunidad arranque en blanco, que es la
 * forma más rápida de que nadie la use.
 *
 * **Los identificadores son UUID generados al vuelo**, no cadenas como
 * `esp-general`. Antes lo eran, y funcionaba mientras todo vivía en memoria;
 * ahora van a columnas `uuid` de Postgres y una cadena así sería rechazada.
 * Generarlos aquí —y no dejarlos a la base— permite además guardar secciones y
 * espacios de una vez, sin ida y vuelta para conocer el id del padre.
 *
 * Devuelve objetos nuevos en cada llamada: dos cursos creados en la misma
 * sesión nunca comparten referencias ni identificadores.
 */
export function crearSeccionesDefault(): CommunitySection[] {
  return [
    {
      id: crypto.randomUUID(),
      titulo: "Comienza aquí",
      orden: 1,
      espacios: [
        {
          id: crypto.randomUUID(),
          slug: "bienvenida",
          nombre: "Preséntate",
          icono: "👋",
          orden: 1,
        },
        {
          id: crypto.randomUUID(),
          slug: "guia",
          nombre: "Cómo usar la comunidad",
          icono: "📕",
          orden: 2,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      titulo: "Comunidad",
      orden: 2,
      espacios: [
        {
          id: crypto.randomUUID(),
          slug: "anuncios",
          nombre: "Anuncios",
          icono: "📣",
          orden: 1,
          // Solo el dueño publica aquí: si cualquiera puede, deja de ser el
          // sitio donde se mira cuando hay algo importante.
          soloLectura: true,
        },
        {
          id: crypto.randomUUID(),
          slug: "general",
          nombre: "General",
          icono: "💬",
          orden: 2,
        },
        {
          id: crypto.randomUUID(),
          slug: "wins",
          nombre: "Wins",
          icono: "🏆",
          orden: 3,
        },
        {
          id: crypto.randomUUID(),
          slug: "preguntas",
          nombre: "Preguntas",
          icono: "❓",
          orden: 4,
        },
      ],
    },
  ];
}
