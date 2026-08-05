import type { CommunitySection } from "@/lib/types";

/**
 * Secciones/espacios por defecto — usadas tanto por el seed de
 * `mocks/communities.ts` (`Community.secciones`, sin `cursoId`: ambas
 * comunidades comparten los mismos ids) como por `registrarCreador` en
 * `store.ts` para una comunidad nueva, y por `mocks/courses.ts` /
 * `/admin/cursos` (Cambio 3) para sembrar `Course.secciones` de cada curso.
 *
 * `cursoId`, si se pasa, se agrega como sufijo a cada id (`esp-general-curso-1`)
 * para que los espacios de cursos distintos nunca colisionen — dos cursos
 * llamando esta función sin sufijo terminarían compartiendo literalmente el
 * mismo id `esp-general`, lo que rompería `espaciosVistos` (keyed por
 * espacioId global) y el remapeo de posts a su espacio de respaldo. Sin
 * `cursoId` (comunidad), los ids quedan exactamente como antes de Cambio 3 —
 * no rompe `/admin/comunidad`, que sigue editando `Community.secciones`.
 *
 * Es una función (no una constante) para que cada llamada devuelva
 * arrays/objetos nuevos — nadie muta esta estructura in place (las
 * ediciones de `/admin/comunidad` pasan por `guardarSecciones`, que siempre
 * reemplaza el array completo en `comunidadOverrides`), pero evitar la
 * referencia compartida es gratis y elimina esa clase de bug de raíz.
 */
export function crearSeccionesDefault(cursoId?: string): CommunitySection[] {
  const id = (base: string) => (cursoId ? `${base}-${cursoId}` : base);

  return [
    {
      id: id("sec-empieza"),
      titulo: "Comienza aquí",
      orden: 1,
      espacios: [
        { id: id("esp-bienvenida"), slug: "bienvenida", nombre: "Preséntate", icono: "👋", orden: 1 },
        {
          id: id("esp-guia"),
          slug: "guia",
          nombre: "Cómo usar la comunidad",
          icono: "📕",
          orden: 2,
        },
      ],
    },
    {
      id: id("sec-comunidad"),
      titulo: "Comunidad",
      orden: 2,
      espacios: [
        {
          id: id("esp-anuncios"),
          slug: "anuncios",
          nombre: "Anuncios",
          icono: "📣",
          orden: 1,
          soloLectura: true,
        },
        { id: id("esp-general"), slug: "general", nombre: "General", icono: "💬", orden: 2 },
        { id: id("esp-wins"), slug: "wins", nombre: "Wins", icono: "🏆", orden: 3 },
        { id: id("esp-preguntas"), slug: "preguntas", nombre: "Preguntas", icono: "❓", orden: 4 },
      ],
    },
  ];
}
