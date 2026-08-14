"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { homePorRol } from "@/lib/routes";
import { CargaConMarca } from "@/components/shared/carga-con-marca";

/**
 * Lee el retorno del enlace de acceso y, si trae credenciales, las canjea.
 *
 * Supabase puede contestar de tres formas distintas, y hay que aceptar las
 * tres o el enlace parece roto sin dar ningún error:
 *
 * 1. `?error_description=...` en la consulta — enlace caducado o ya usado.
 *    Mirar solo el fragmento hacía que esto rebotara al login en silencio,
 *    indistinguible de "no pasa nada".
 * 2. `#access_token=...&refresh_token=...` en el fragmento (flujo implícito).
 *    Es lo que produce `/auth/v1/verify` hoy, tanto desde el correo como
 *    desde `generateLink`. El cliente de `@supabase/ssr` va en modo PKCE y
 *    busca un `?code=` en la consulta, así que **no mira el fragmento**: sin
 *    este canje manual la sesión nunca se crea.
 * 3. `?code=...` (PKCE). Lo canjea el propio cliente al arrancar.
 *
 * Es `async` a propósito aunque algunas ramas no esperen nada: así el
 * `.then()` que actualiza el estado nunca corre de forma síncrona dentro del
 * efecto, que dispararía renders en cascada.
 */
/**
 * El fragmento de la URL, leído al cargar este archivo.
 *
 * Se captura aquí y no dentro de un efecto porque el cliente de Supabase
 * **borra el fragmento** en cuanto alguien lo crea, y `useSession` lo crea en
 * todos los layouts. Cuando el efecto de esta pantalla miraba, el
 * `type=recovery` ya no estaba, y quien pedía recuperar su contraseña acababa
 * dentro de la app sin haberla cambiado.
 *
 * Este módulo se evalúa antes de que se monte ningún componente, así que llega
 * el primero.
 */
const FRAGMENTO_INICIAL =
  typeof window === "undefined" ? "" : window.location.hash;

interface Retorno {
  error: string | null;
  /** `recovery` cuando el enlace venía de "olvidé mi contraseña". */
  tipo: string | null;
  /** A dónde ir después, puesto por quien generó el enlace. */
  destino: string | null;
}

async function resolverRetorno(): Promise<Retorno> {
  const consulta = new URLSearchParams(window.location.search);
  const errorConsulta = consulta.get("error_description") ?? consulta.get("error");

  const destino = consulta.get("destino");

  if (errorConsulta) return { error: errorConsulta, tipo: null, destino };

  const hash = FRAGMENTO_INICIAL || window.location.hash;
  if (!hash.includes("access_token")) return { error: null, tipo: null, destino };

  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const tipo = params.get("type");
  if (!accessToken || !refreshToken) return { error: null, tipo, destino };

  const { error } = await crearClienteNavegador().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // El fragmento lleva un token de sesión completo: fuera de la barra y del
  // historial en cuanto se ha usado.
  window.history.replaceState(null, "", window.location.pathname);

  return { error: error?.message ?? null, tipo, destino };
}

export default function CallbackPage() {
  const [canjeado, setCanjeado] = useState(false);
  // La academia por cuya puerta se entro, si el login la puso en la consulta:
  // pinta la pantalla de carga con SU marca y decide a que login volver si
  // el canje falla. Estado perezoso y no useSearchParams: sin Suspense.
  const [academia] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("academia")
  );
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    let vivo = true;
    void resolverRetorno().then((retorno) => {
      if (!vivo) return;
      if (retorno.error) setError(retorno.error);
      setTipo(retorno.tipo);
      setDestino(retorno.destino);
      setCanjeado(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!canjeado || !hydrated || error) return;

    // Todo pasa por aquí y no por una ruta propia porque `/callback` ya está
    // en las direcciones permitidas de Supabase. Una ruta nueva habría que
    // añadirla allí, y hasta entonces Supabase la ignora y manda el enlace al
    // Site URL — que es como acababa en `localhost` desde producción.
    if (destino === "nueva-clave" || tipo === "recovery") {
      router.replace("/nueva-clave");
      return;
    }

    router.replace(
      user ? homePorRol(user) : academia ? `/login/${academia}` : "/login"
    );
  }, [canjeado, hydrated, error, tipo, destino, user, router, academia]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">
          No pudimos completar el acceso: {error}
        </p>
        <p className="text-sm text-muted-foreground">
          El enlace puede haber caducado o haberse usado ya. Vuelve a{" "}
          <Link
            href={academia ? `/login/${academia}` : "/login"}
            className="text-primary underline underline-offset-4"
          >
            entrar
          </Link>
          .
        </p>
      </div>
    );
  }

  return <CargaConMarca slug={academia ?? undefined} />;
}
