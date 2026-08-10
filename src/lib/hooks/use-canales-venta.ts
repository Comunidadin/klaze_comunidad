"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  borrarCanal,
  cambiarEstadoCanal,
  crearCanal,
  crearCanalPlataforma,
  listarCanales,
  listarCanalesPlataforma,
  listarRecepciones,
  regenerarToken,
  type CanalVenta,
  type RecepcionCanal,
} from "@/lib/supabase/canales-venta";

export interface UseCanalesVentaResult {
  canales: CanalVenta[];
  cargando: boolean;
  crear: (nombre: string, cursoIds: string[] | "todos") => Promise<CanalVenta>;
  cambiarEstado: (canalId: string, activo: boolean) => Promise<void>;
  regenerar: (canalId: string) => Promise<string>;
  borrar: (canalId: string) => Promise<void>;
  recargar: () => Promise<void>;
}

/** `async` aunque la rama sin comunidad no espere nada: ver `useInvitations`. */
async function leer(comunidadId: string): Promise<CanalVenta[]> {
  if (!comunidadId) return [];
  return listarCanales(crearClienteNavegador(), comunidadId);
}

export function useCanalesVenta(comunidadId: string): UseCanalesVentaResult {
  const [canales, setCanales] = useState<CanalVenta[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCanales(await leer(comunidadId));
    setCargando(false);
  }, [comunidadId]);

  useEffect(() => {
    let vivo = true;
    void leer(comunidadId).then((lista) => {
      if (!vivo) return;
      setCanales(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [comunidadId]);

  const crear = useCallback(
    async (nombre: string, cursoIds: string[] | "todos") => {
      const canal = await crearCanal(
        crearClienteNavegador(),
        comunidadId,
        nombre,
        cursoIds
      );
      await recargar();
      return canal;
    },
    [comunidadId, recargar]
  );

  const cambiarEstado = useCallback(
    async (canalId: string, activo: boolean) => {
      await cambiarEstadoCanal(crearClienteNavegador(), canalId, activo);
      await recargar();
    },
    [recargar]
  );

  const regenerar = useCallback(
    async (canalId: string) => {
      const token = await regenerarToken(crearClienteNavegador(), canalId);
      await recargar();
      return token;
    },
    [recargar]
  );

  const borrar = useCallback(
    async (canalId: string) => {
      await borrarCanal(crearClienteNavegador(), canalId);
      await recargar();
    },
    [recargar]
  );

  return { canales, cargando, crear, cambiarEstado, regenerar, borrar, recargar };
}

export interface UseCanalesPlataformaResult {
  canales: CanalVenta[];
  cargando: boolean;
  crear: (nombre: string, planId: string) => Promise<CanalVenta>;
  cambiarEstado: (canalId: string, activo: boolean) => Promise<void>;
  regenerar: (canalId: string) => Promise<string>;
  borrar: (canalId: string) => Promise<void>;
}

/**
 * Los enlaces que venden Klaze entero. Solo los ve el superadmin.
 *
 * Hermano de `useCanalesVenta` y no una bandera dentro de él: el que crea un
 * canal de academia pasa módulos y el que crea uno de plataforma pasa plan, y
 * una función que recibe «o esto o lo otro» acaba aceptando ninguno de los dos.
 * Lo que sí comparten —apagar, regenerar, borrar— es la misma llamada.
 */
export function useCanalesPlataforma(): UseCanalesPlataformaResult {
  const [canales, setCanales] = useState<CanalVenta[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCanales(await listarCanalesPlataforma(crearClienteNavegador()));
    setCargando(false);
  }, []);

  useEffect(() => {
    let vivo = true;
    void listarCanalesPlataforma(crearClienteNavegador()).then((lista) => {
      if (!vivo) return;
      setCanales(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const crear = useCallback(
    async (nombre: string, planId: string) => {
      const canal = await crearCanalPlataforma(crearClienteNavegador(), nombre, planId);
      await recargar();
      return canal;
    },
    [recargar]
  );

  const cambiarEstado = useCallback(
    async (canalId: string, activo: boolean) => {
      await cambiarEstadoCanal(crearClienteNavegador(), canalId, activo);
      await recargar();
    },
    [recargar]
  );

  const regenerar = useCallback(
    async (canalId: string) => {
      const token = await regenerarToken(crearClienteNavegador(), canalId);
      await recargar();
      return token;
    },
    [recargar]
  );

  const borrar = useCallback(
    async (canalId: string) => {
      await borrarCanal(crearClienteNavegador(), canalId);
      await recargar();
    },
    [recargar]
  );

  return { canales, cargando, crear, cambiarEstado, regenerar, borrar };
}

/**
 * Lo último que llegó a un canal.
 *
 * Va en su propio hook y no dentro de `useCanalesVenta` porque solo se mira al
 * desplegar un enlace: pedirlas para todos al entrar en la página sería una
 * consulta por canal para algo que casi nunca se abre.
 */
export function useRecepciones(canalId: string): {
  recepciones: RecepcionCanal[];
  cargando: boolean;
} {
  const [recepciones, setRecepciones] = useState<RecepcionCanal[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const leerlas = async () => {
      if (!canalId) return [];
      return listarRecepciones(crearClienteNavegador(), canalId);
    };
    void leerlas().then((lista) => {
      if (!vivo) return;
      setRecepciones(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [canalId]);

  return { recepciones, cargando };
}
