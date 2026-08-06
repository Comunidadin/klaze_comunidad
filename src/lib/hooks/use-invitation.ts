"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export interface UseInvitationResult {
  /** Correo al que se dirigió la invitación. */
  email: string;
  comunidadNombre: string;
  comunidadLogo: string;
  comunidadColor: string;
  todosLosCursos: boolean;
  /** Títulos de los cursos incluidos. Vacío cuando `todosLosCursos` es true. */
  cursos: string[];
}

/**
 * Resuelve una invitación por su token, **sin sesión**.
 *
 * Llama a `invitacion_publica`, la función del esquema que devuelve un
 * conjunto fijo de columnas: la marca de la academia y los títulos de los
 * cursos incluidos. No devuelve la `Community` entera porque la pantalla no
 * necesita más, y porque esa función es una de las dos únicas puertas abiertas
 * a quien no ha iniciado sesión.
 *
 * Devuelve `null` para un token inexistente, uno ya aceptado o una academia
 * suspendida — sin distinguir cuál de los tres. Distinguirlos permitiría
 * averiguar qué tokens existen, que es justo lo que protege el correo del
 * invitado.
 *
 * `cargando` importa aquí y no en otros hooks: la pantalla no puede decidir
 * entre "bienvenido" y "esta invitación no vale" hasta tener la respuesta.
 */
export function useInvitation(token: string): {
  invitacion: UseInvitationResult | null;
  cargando: boolean;
} {
  const [invitacion, setInvitacion] = useState<UseInvitationResult | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;

    void crearClienteNavegador()
      .rpc("invitacion_publica", { p_token: token })
      .then(({ data }) => {
        if (!vivo) return;
        const fila = data?.[0];
        setInvitacion(
          fila
            ? {
                email: fila.email,
                comunidadNombre: fila.comunidad_nombre,
                comunidadLogo: fila.comunidad_logo,
                comunidadColor: fila.comunidad_color,
                todosLosCursos: fila.todos_los_cursos,
                cursos: fila.cursos ?? [],
              }
            : null
        );
        setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [token]);

  return { invitacion, cargando };
}
