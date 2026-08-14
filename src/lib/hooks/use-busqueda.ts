"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Búsqueda del área de alumno: clases, publicaciones y miembros de la
 * academia activa, mientras se escribe.
 *
 * Tres consultas `ilike` por las políticas existentes — RLS ya esconde los
 * borradores, las clases con goteo cerrado y los perfiles de otras academias,
 * así que aquí no hay que repetir ninguna condición de acceso. Sin índices ni
 * infraestructura: a este tamaño `ilike` sobra, y si un día es lento se añade
 * `pg_trgm` sin tocar esta interfaz.
 */
export interface ResultadoClase {
  id: string;
  titulo: string;
  cursoSlug: string;
  cursoTitulo: string;
}

export interface ResultadoPublicacion {
  id: string;
  titulo: string;
  espacioSlug: string;
}

export interface ResultadoMiembro {
  id: string;
  nombre: string;
  avatarUrl: string;
}

export interface Resultados {
  clases: ResultadoClase[];
  publicaciones: ResultadoPublicacion[];
  miembros: ResultadoMiembro[];
}

const VACIO: Resultados = { clases: [], publicaciones: [], miembros: [] };

/** `%`, `_` y los separadores de `.or()` harían de la consulta otra cosa. */
function patronDe(q: string): string {
  return `%${q.replace(/[%_,()]/g, " ").trim()}%`;
}

export function useBusqueda(comunidadId: string, q: string) {
  const [resultados, setResultados] = useState<Resultados>(VACIO);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const limpio = q.trim();

    // El patrón del proyecto: nunca `setState` síncrono dentro de un efecto,
    // ni siquiera en la rama que no espera nada (ver CLAUDE.md).
    if (limpio.length < 2) {
      void Promise.resolve().then(() => {
        if (!vivo) return;
        setResultados(VACIO);
        setBuscando(false);
      });
      return () => {
        vivo = false;
      };
    }

    void Promise.resolve().then(() => {
      if (vivo) setBuscando(true);
    });

    // Rebote: se consulta cuando la persona deja de teclear un momento.
    const timer = setTimeout(() => {
      const supabase = crearClienteNavegador();
      const patron = patronDe(limpio);

      void Promise.all([
        supabase
          .from("lecciones")
          .select("id, titulo, modulos!inner( cursos!inner( slug, titulo, comunidad_id ) )")
          .eq("modulos.cursos.comunidad_id", comunidadId)
          .ilike("titulo", patron)
          .limit(8),
        supabase
          .from("publicaciones")
          .select("id, titulo, espacios ( slug )")
          .eq("comunidad_id", comunidadId)
          .or(`titulo.ilike.${patron},cuerpo.ilike.${patron}`)
          .limit(8),
        supabase
          .from("perfiles")
          .select("id, nombre, avatar_url")
          .ilike("nombre", patron)
          .limit(8),
      ]).then(([lecciones, publicaciones, perfiles]) => {
        if (!vivo) return;
        /* eslint-disable @typescript-eslint/no-explicit-any -- filas anidadas
           de PostgREST sin tipo generado; se normalizan aquí y no salen. */
        const clases = ((lecciones.data ?? []) as any[]).map((l) => {
          const mod = Array.isArray(l.modulos) ? l.modulos[0] : l.modulos;
          const curso = Array.isArray(mod?.cursos) ? mod.cursos[0] : mod?.cursos;
          return {
            id: l.id as string,
            titulo: l.titulo as string,
            cursoSlug: (curso?.slug as string) ?? "",
            cursoTitulo: (curso?.titulo as string) ?? "",
          };
        });
        const posts = ((publicaciones.data ?? []) as any[]).map((p) => {
          const esp = Array.isArray(p.espacios) ? p.espacios[0] : p.espacios;
          return {
            id: p.id as string,
            titulo: p.titulo as string,
            espacioSlug: (esp?.slug as string) ?? "",
          };
        });
        const miembros = ((perfiles.data ?? []) as any[]).map((m) => ({
          id: m.id as string,
          nombre: (m.nombre as string) || "Miembro",
          avatarUrl: (m.avatar_url as string) ?? "",
        }));
        /* eslint-enable @typescript-eslint/no-explicit-any */
        setResultados({ clases, publicaciones: posts, miembros });
        setBuscando(false);
      });
    }, 300);

    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [comunidadId, q]);

  return { ...resultados, buscando };
}
