"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  crearInvitaciones,
  listarInvitaciones,
  type InvitacionCreada,
} from "@/lib/supabase/invitaciones";
import type { Invitation } from "@/lib/types";

export interface UseInvitationsResult {
  invitaciones: Invitation[];
  cargando: boolean;
  /**
   * Crea las invitaciones y devuelve las creadas, con su token.
   *
   * Es asíncrona porque escribir en un servidor no es instantáneo, y fingir
   * que sí produce interfaces que mienten: el listado se quedaría sin la
   * invitación recién creada hasta la siguiente recarga.
   */
  crear: (
    emails: string[],
    cursoIds: string[] | "todos"
  ) => Promise<InvitacionCreada[]>;
  recargar: () => Promise<void>;
}

/**
 * Es `async` aunque la rama sin comunidad no espere nada: así el `.then()` que
 * actualiza el estado nunca corre de forma síncrona dentro del efecto, que
 * dispararía renders en cascada.
 */
async function leerInvitaciones(comunidadId: string): Promise<Invitation[]> {
  if (!comunidadId) return [];
  return listarInvitaciones(crearClienteNavegador(), comunidadId);
}

export function useInvitations(comunidadId: string): UseInvitationsResult {
  const [invitaciones, setInvitaciones] = useState<Invitation[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const lista = await leerInvitaciones(comunidadId);
    setInvitaciones(lista);
    setCargando(false);
  }, [comunidadId]);

  useEffect(() => {
    let vivo = true;
    void leerInvitaciones(comunidadId).then((lista) => {
      if (!vivo) return;
      setInvitaciones(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId]);

  const crear = useCallback(
    async (emails: string[], cursoIds: string[] | "todos") => {
      const creadas = await crearInvitaciones(
        crearClienteNavegador(),
        comunidadId,
        emails,
        cursoIds
      );
      await recargar();
      return creadas;
    },
    [comunidadId, recargar]
  );

  return { invitaciones, cargando, crear, recargar };
}
