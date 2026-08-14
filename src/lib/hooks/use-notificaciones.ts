"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { fechaDeApertura } from "@/lib/goteo";
import { useAppStore } from "@/lib/store";

/**
 * Las novedades de la academia desde la última vez que miraste, DERIVADAS:
 * sin tabla de notificaciones ni triggers. Tres fuentes, todas por las
 * políticas existentes:
 *
 * - comentarios de otros sobre TUS publicaciones,
 * - anuncios (publicaciones de otros en espacios de solo lectura),
 * - módulos recién abiertos por goteo (calculado con `fechaDeApertura`, el
 *   mismo reloj del candado).
 *
 * La marca de «visto» vive en el store por academia; la primera vez se usa
 * la fecha de entrada a la academia — nadie estrena cuenta con 40 avisos.
 */
export interface Notificacion {
  id: string;
  tipo: "comentario" | "anuncio" | "clase";
  texto: string;
  fecha: string;
  href: string;
}

export function useNotificaciones(comunidadId: string, comunidadSlug: string) {
  const yo = useAppStore((s) => s.currentUserId);
  const entradaEl = useAppStore((s) => s.armazon?.entradaEl);
  const cursos = useAppStore((s) => s.armazon?.cursos);
  const vistas = useAppStore((s) => s.notificacionesVistas);
  const marcarNotificacionesVistas = useAppStore((s) => s.marcarNotificacionesVistas);

  const desde = vistas[comunidadId] ?? entradaEl ?? new Date().toISOString();

  const [lista, setLista] = useState<Notificacion[]>([]);

  useEffect(() => {
    if (!comunidadId || !yo) return;
    let vivo = true;
    const supabase = crearClienteNavegador();

    void Promise.all([
      supabase
        .from("comentarios")
        .select(
          "id, creado_el, autor_id, perfiles!comentarios_autor_id_fkey(nombre), publicaciones!inner(titulo, autor_id, comunidad_id, espacios(slug))"
        )
        .eq("publicaciones.comunidad_id", comunidadId)
        .eq("publicaciones.autor_id", yo)
        .neq("autor_id", yo)
        .gt("creado_el", desde)
        .order("creado_el", { ascending: false })
        .limit(10),
      supabase
        .from("publicaciones")
        .select("id, titulo, creado_el, autor_id, espacios!inner(slug, solo_lectura)")
        .eq("comunidad_id", comunidadId)
        .eq("espacios.solo_lectura", true)
        .neq("autor_id", yo)
        .gt("creado_el", desde)
        .order("creado_el", { ascending: false })
        .limit(10),
    ]).then(([comentarios, anuncios]) => {
      if (!vivo) return;

      /* eslint-disable @typescript-eslint/no-explicit-any -- filas anidadas
         de PostgREST sin tipo generado; se normalizan aquí y no salen. */
      const deComentarios: Notificacion[] = ((comentarios.data ?? []) as any[]).map(
        (c) => {
          const post = Array.isArray(c.publicaciones) ? c.publicaciones[0] : c.publicaciones;
          const esp = Array.isArray(post?.espacios) ? post.espacios[0] : post?.espacios;
          const quien = Array.isArray(c.perfiles) ? c.perfiles[0] : c.perfiles;
          return {
            id: `c-${c.id}`,
            tipo: "comentario" as const,
            texto: `${quien?.nombre || "Alguien"} comentó «${post?.titulo ?? "tu publicación"}»`,
            fecha: c.creado_el as string,
            href: esp?.slug
              ? `/c/${comunidadSlug}/comunidad/espacio/${esp.slug}`
              : `/c/${comunidadSlug}/comunidad`,
          };
        }
      );

      const deAnuncios: Notificacion[] = ((anuncios.data ?? []) as any[]).map((p) => {
        const esp = Array.isArray(p.espacios) ? p.espacios[0] : p.espacios;
        return {
          id: `a-${p.id}`,
          tipo: "anuncio" as const,
          texto: `Anuncio nuevo: «${p.titulo}»`,
          fecha: p.creado_el as string,
          href: esp?.slug
            ? `/c/${comunidadSlug}/comunidad/espacio/${esp.slug}`
            : `/c/${comunidadSlug}/comunidad`,
        };
      });
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // Módulos que estaban cerrados por goteo en la última visita y ya no:
      // cerrado a la fecha de la marca, abierto ahora.
      const ahora = new Date();
      const marca = new Date(desde);
      const deGoteo: Notificacion[] = (cursos ?? [])
        .filter((curso) => {
          const config = {
            goteoModo: curso.goteoModo,
            goteoDias: curso.goteoDias,
            goteoDesde: curso.goteoDesde,
          };
          return (
            fechaDeApertura(config, entradaEl ?? null, marca) !== null &&
            fechaDeApertura(config, entradaEl ?? null, ahora) === null
          );
        })
        .map((curso) => ({
          id: `g-${curso.id}`,
          tipo: "clase" as const,
          texto: `Se desbloqueó «${curso.titulo}»`,
          fecha: ahora.toISOString(),
          href: `/c/${comunidadSlug}/cursos/${curso.slug}`,
        }));

      setLista(
        [...deComentarios, ...deAnuncios, ...deGoteo].sort((a, b) =>
          b.fecha.localeCompare(a.fecha)
        )
      );
    });

    return () => {
      vivo = false;
    };
    // `desde` a propósito FUERA de las dependencias: al abrir la campanita la
    // marca avanza, y refetchear en ese momento vaciaría la lista que la
    // persona está leyendo. Se consulta al montar (una vez por pantalla).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunidadId, comunidadSlug, yo]);

  return {
    notificaciones: lista,
    /** Adelanta la marca: el contador se apaga, la lista abierta se queda. */
    marcarVisto: () => marcarNotificacionesVistas(comunidadId),
    /** Si la marca ya avanzó, el contador no cuenta lo ya visto. */
    sinVer: lista.filter((n) => n.fecha > (vistas[comunidadId] ?? desde)).length,
  };
}
