"use client";

import { useMemo } from "react";
import { resolverComunidad, useAppStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { mockPosts } from "@/lib/mocks/posts";
import { cursosDeComunidad } from "@/lib/hooks/use-courses";
import type { CommunitySection, CommunitySpace } from "@/lib/types";

export type EspacioConNoLeidos = CommunitySpace & { noLeidos: number };
// `Omit` (no una intersección directa con `CommunitySection`) porque esa
// interfaz ya declara `espacios: CommunitySpace[]` — intersecar en vez de
// sobrescribir deja `espacios` tipado como `CommunitySpace[] & EspacioConNoLeidos[]`,
// y TypeScript resuelve `.map()` sobre esa intersección usando la firma de
// `CommunitySpace[]`, perdiendo `noLeidos` en el callback.
export type SeccionConEspacios = Omit<CommunitySection, "espacios"> & {
  espacios: EspacioConNoLeidos[];
};

/**
 * Secciones/espacios resueltos, con el contador de "no leídos" de cada
 * espacio: posts creados después de `espaciosVistos[espacioId]` (o todos,
 * si nunca se visitó).
 *
 * Sin `cursoId`: resuelve `Community.secciones` (overrides de
 * `/admin/comunidad` aplicados) — comportamiento histórico, usado por
 * `PostModeracionRow` en ese panel. Con `cursoId` (Cambio 3: la comunidad
 * social vive dentro de cada curso): resuelve `Course.secciones` de ESE
 * curso — usado por `EspaciosSidebar`, `ContextoRail` y `Feed` en el área de
 * miembros.
 *
 * Selecciona los arrays crudos del store y deriva todo con `useMemo` —
 * nunca `.filter()`/`.map()` dentro del selector de zustand, que rompe el
 * invariante de `useSyncExternalStore` en React 19 (ver CLAUDE.md y
 * `use-invitations.ts`/`use-ahora.ts`, que se corrigieron por esto mismo).
 */
export function useEspacios(comunidadId: string, cursoId?: string): { secciones: SeccionConEspacios[] } {
  const comunidadesCreadas = useAppStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useAppStore((s) => s.comunidadOverrides);
  const armazon = useAppStore((s) => s.armazon);
  const postsCreados = useAppStore((s) => s.postsCreados);
  const postsEliminados = useAppStore((s) => s.postsEliminados);
  const espaciosVistos = useAppStore((s) => s.espaciosVistos);

  return useMemo(() => {
    let seccionesBase: CommunitySection[] | null = null;

    if (cursoId) {
      const curso = cursosDeComunidad(comunidadId, armazon?.cursos ?? []).find((c) => c.id === cursoId);
      seccionesBase = curso?.secciones ?? null;
    } else {
      const base =
        comunidadesCreadas.find((c) => c.id === comunidadId) ??
        mockCommunities.find((c) => c.id === comunidadId);
      seccionesBase = base ? resolverComunidad(base, comunidadOverrides).secciones : null;
    }

    if (!seccionesBase) return { secciones: [] };
    const seccionesResueltas = seccionesBase;

    const idsValidos = new Set(seccionesResueltas.flatMap((s) => s.espacios.map((e) => e.id)));
    const respaldoId = seccionesResueltas
      .flatMap((s) => s.espacios)
      .find((e) => e.slug === "general")?.id;

    const posts = [...mockPosts, ...postsCreados].filter(
      (p) =>
        (cursoId ? p.cursoId === cursoId : p.comunidadId === comunidadId) &&
        !postsEliminados.includes(p.id)
    );

    const secciones: SeccionConEspacios[] = seccionesResueltas
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((seccion) => ({
        ...seccion,
        espacios: seccion.espacios
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((espacio) => {
            const vistoEl = espaciosVistos[espacio.id];
            const noLeidos = posts.filter((post) => {
              const espacioEfectivo = idsValidos.has(post.espacioId)
                ? post.espacioId
                : (respaldoId ?? post.espacioId);
              if (espacioEfectivo !== espacio.id) return false;
              if (!vistoEl) return true;
              return new Date(post.creadoEl).getTime() > new Date(vistoEl).getTime();
            }).length;
            return { ...espacio, noLeidos };
          }),
      }));

    return { secciones };
  }, [
    comunidadId,
    cursoId,
    comunidadesCreadas,
    comunidadOverrides,
    armazon,
    postsCreados,
    postsEliminados,
    espaciosVistos,
  ]);
}
