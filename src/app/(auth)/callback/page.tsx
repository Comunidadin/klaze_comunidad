"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { homePorRol } from "@/lib/routes";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

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

  // El destino viaja en la QUERY y no en el fragmento a propósito.
  //
  // El fragmento (`#access_token=…&type=recovery`) lo consume el cliente de
  // Supabase en cuanto alguien lo crea —y `useSession` lo crea en todos los
  // layouts—, así que para cuando esta función miraba, el `type=recovery` ya
  // no estaba. El enlace de recuperación acababa metiendo a la persona en la
  // app en vez de dejarle elegir contraseña.
  const destino = consulta.get("destino");

  if (errorConsulta) return { error: errorConsulta, tipo: null, destino };

  const hash = window.location.hash;
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

    router.replace(user ? homePorRol(user) : "/login");
  }, [canjeado, hydrated, error, tipo, destino, user, router]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">
          No pudimos completar el acceso: {error}
        </p>
        <p className="text-sm text-muted-foreground">
          El enlace puede haber caducado o haberse usado ya. Vuelve a{" "}
          <a href="/login" className="text-primary underline underline-offset-4">
            entrar
          </a>
          .
        </p>
      </div>
    );
  }

  return <FullScreenLoader />;
}
