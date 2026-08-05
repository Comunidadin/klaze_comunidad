"use client";

import { resolverComunidad, useAppStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import type { Community } from "@/lib/types";

/** Comunidad que da nombre a la plataforma — su portada es la del login global. */
const COMUNIDAD_MARCA_ID = "com-principal";

export type MarcaAuth = NonNullable<Community["marcaAuth"]>;

/**
 * Portada de la pantalla de entrada (mitad izquierda del login).
 *
 * `slug` opcional: si se pasa y la comunidad existe, devuelve SU portada —
 * así el login de un creador muestra su propio video. Sin `slug` (o si no
 * existe) cae en la comunidad de la marca, que es la del `/login` global.
 *
 * Pasa por `resolverComunidad` a propósito: la portada se edita desde
 * `/admin/configuracion` y vive como override en el store, igual que el
 * nombre o el color de acento.
 */
export function useMarcaAuth(slug?: string): MarcaAuth {
  const comunidadesCreadas = useAppStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useAppStore((s) => s.comunidadOverrides);

  const porSlug = slug
    ? (comunidadesCreadas.find((c) => c.slug === slug) ??
      mockCommunities.find((c) => c.slug === slug))
    : undefined;

  const base =
    porSlug ??
    comunidadesCreadas.find((c) => c.id === COMUNIDAD_MARCA_ID) ??
    mockCommunities.find((c) => c.id === COMUNIDAD_MARCA_ID);

  if (!base) return {};

  return resolverComunidad(base, comunidadOverrides).marcaAuth ?? {};
}
