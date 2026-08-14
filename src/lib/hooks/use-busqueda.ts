"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Búsqueda del área de alumno: clases, publicaciones y miembros de la
 * academia activa, mientras se escribe.
 *
 * Llama a `buscar_en_comunidad`, que busca POR PALABRAS y sin acentos:
 * «como comunidad» encuentra «Cómo usar la comunidad». La función es
 * `security invoker`, así que las políticas se aplican solas — solo aparece
 * lo que esa persona ya puede ver (ni borradores, ni goteo cerrado, ni
 * perfiles de otras academias).
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

interface FilaBusqueda {
  tipo: "clase" | "publicacion" | "miembro";
  id: string;
  titulo: string;
  detalle: string | null;
  ruta_slug: string | null;
}

export function useBusqueda(comunidadId: string, q: string) {
  const [resultados, setResultados] = useState<Resultados>(VACIO);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const limpio = q.trim();

    // El patrón del proyecto: nunca `setState` síncrono dentro de un efecto,
    // ni siquiera en la rama que no espera nada (ver CLAUDE.md).
    if (limpio.length < 2 || !comunidadId) {
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
      void crearClienteNavegador()
        .rpc("buscar_en_comunidad", { p_comunidad: comunidadId, p_q: limpio })
        .then(({ data }) => {
          if (!vivo) return;
          const filas = (data ?? []) as FilaBusqueda[];
          setResultados({
            clases: filas
              .filter((f) => f.tipo === "clase")
              .map((f) => ({
                id: f.id,
                titulo: f.titulo,
                cursoSlug: f.ruta_slug ?? "",
                cursoTitulo: f.detalle ?? "",
              })),
            publicaciones: filas
              .filter((f) => f.tipo === "publicacion")
              .map((f) => ({
                id: f.id,
                titulo: f.titulo,
                espacioSlug: f.ruta_slug ?? "",
              })),
            miembros: filas
              .filter((f) => f.tipo === "miembro")
              .map((f) => ({
                id: f.id,
                nombre: f.titulo || "Miembro",
                avatarUrl: f.detalle ?? "",
              })),
          });
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
