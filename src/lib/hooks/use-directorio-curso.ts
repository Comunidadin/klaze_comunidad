"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { nivelPorPuntos } from "@/lib/levels";
import { nombreVisible } from "@/lib/nombre-visible";

/**
 * Lo que el directorio enseña de una persona, y nada más.
 *
 * No hay correo ni estado de inscripción a propósito: `useMembers` sí los
 * trae, porque el panel del dueño los necesita, pero un compañero de clase no
 * tiene por qué verlos. Los tipos distintos son la forma de que no se cuelen
 * por descuido.
 */
export interface MiembroDirectorio {
  id: string;
  nombre: string;
  avatarUrl: string;
  bio: string;
  puntos: number;
  nivel: number;
  creadoEl: string;
}

interface FilaMiembro {
  usuario_id: string;
  nombre: string;
  /** La parte de delante de la arroba, no el correo. Ver `nombreVisible`. */
  alias: string;
  avatar_url: string;
  bio: string;
  puntos: number;
  creado_el: string;
}

/** Referencia estable: un array nuevo por render relanzaría el efecto en bucle. */
const VACIO: MiembroDirectorio[] = [];

async function leerDirectorio(cursoId: string): Promise<MiembroDirectorio[]> {
  if (!cursoId) return VACIO;

  const { data } = await crearClienteNavegador().rpc("miembros_del_curso", {
    p_curso: cursoId,
  });

  return ((data ?? []) as FilaMiembro[]).map((f) => ({
    id: f.usuario_id,
    nombre: nombreVisible(f.nombre, f.alias),
    avatarUrl: f.avatar_url,
    bio: f.bio,
    puntos: f.puntos,
    nivel: nivelPorPuntos(f.puntos),
    creadoEl: f.creado_el,
  }));
}

/**
 * Quién tiene acceso a este módulo, para el directorio del área de alumno.
 *
 * NO usa `useMembers`. Aquel lee `inscripciones`, y esa tabla solo se la
 * enseña RLS a su dueño y al de la academia — así que a un alumno le devolvía
 * su propia fila y el directorio decía "1 persona" siempre. Callado, además:
 * RLS filtra, no da error.
 *
 * Aquí se pregunta por `miembros_del_curso`, que responde esa pregunta
 * concreta sin abrir la tabla.
 */
export function useDirectorioCurso(cursoId: string): MiembroDirectorio[] {
  const [miembros, setMiembros] = useState<MiembroDirectorio[]>(VACIO);

  useEffect(() => {
    let vivo = true;

    // `async` aunque la rama sin curso no espere nada: el `.then()` que fija el
    // estado no debe correr de forma síncrona dentro del efecto (ver CLAUDE.md).
    void leerDirectorio(cursoId).then((m) => {
      if (vivo) setMiembros(m);
    });

    return () => {
      vivo = false;
    };
  }, [cursoId]);

  return miembros;
}
