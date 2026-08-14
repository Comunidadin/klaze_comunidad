"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { useMarcaAuth } from "@/lib/hooks/use-marca-auth";
import { MarcaAuthContext } from "./_components/marca-auth-context";
import { homePorRol } from "@/lib/routes";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";
import { AuthBrandPanel } from "./_components/auth-brand-panel";

/**
 * Layout del grupo `(auth)`: split-screen con branding a la izquierda
 * (oculto en móvil) y el formulario a la derecha.
 *
 * También hace de guard inverso al de los grupos protegidos: si ya hay
 * sesión, no tiene sentido dejar a alguien parado en /login, /registro o
 * /recuperar, así que lo mandamos a su home por rol. Igual que los guards
 * de T4 ((miembro)/(creador)/(superadmin)), mostramos `FullScreenLoader`
 * mientras el store no ha hidratado: la alternativa (renderizar el form de
 * inmediato) deja ver un flash del login a un usuario que en realidad ya
 * tiene sesión activa, apenas antes de que la hidratación lo redirija.
 *
 * Dos rutas quedan excluidas de este guard, y por la misma razón: en las dos
 * llega una sesión ANTES de que la persona haya terminado lo que venía a hacer.
 *
 * `/nueva-clave` es donde aterriza el enlace de "olvidé mi contraseña", y ese
 * enlace deja la sesión abierta al llegar. Sin esta excepción, el guard veía
 * un usuario con sesión y lo mandaba a la app —así que quien pedía recuperar
 * su contraseña acababa dentro sin haberla cambiado, que es exactamente lo que
 * no quería.
 *
 * `/invitacion/[token]` (Task 6) queda excluida de este guard —tanto del
 * loader por hidratación como del redirect— a propósito: un usuario ya
 * logueado debe poder abrir su propio link de invitación (p. ej. el
 * creador probando el link) sin que lo saquemos de la pantalla, y justo
 * después de `aceptarInvitacion` la sesión pasa de null a un usuario
 * nuevo — sin esta excepción este mismo guard competiría con el redirect
 * explícito de la página hacia `/c/{slug}/cursos`. La pantalla de
 * invitación maneja su propio estado de carga vía `useHydrated` interno.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const exenta =
    (pathname?.startsWith("/invitacion") ?? false) ||
    (pathname?.startsWith("/nueva-clave") ?? false);
  // `/callback` va SIN el split y fuera del guard: es la transición de entrar
  // y pinta su propia pantalla de carga con la marca de la academia
  // (`CargaConMarca`). Antes montaba el split azul de Klaze un instante y
  // desconcertaba. Su página ya redirige por rol en cuanto hay sesión.
  const esCallback = pathname?.startsWith("/callback") ?? false;

  useEffect(() => {
    if (!hydrated || !user || exenta || esCallback) return;
    router.replace(homePorRol(user));
  }, [hydrated, user, router, exenta, esCallback]);

  if (esCallback) {
    return <>{children}</>;
  }

  if (!exenta && (!hydrated || user)) {
    return <FullScreenLoader />;
  }

  return <AuthSplit>{children}</AuthSplit>;
}

/**
 * Split-screen de auth: portada a sangre a la izquierda (video de la
 * comunidad) y formulario a la derecha.
 *
 * El panel del formulario lleva la clase `light` siempre, sin importar el
 * tema del usuario. No es un descuido: la pantalla de entrada es una
 * portada de marca —cian sobre blanco, como el logo— y se ve igual para
 * todo el mundo. Poner `light` como ancestro basta para que todos los
 * tokens (`bg-background`, `text-foreground`, los `Input`, el `Button`)
 * usen sus valores claros sin tocar una sola de las páginas hijas; ese
 * selector se declara junto a `:root` en `globals.css`.
 *
 * Va en un componente aparte porque los hooks no pueden ir después de los
 * `return` tempranos del guard de arriba.
 */
function AuthSplit({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // La academia sale de la URL: `/login/mentoria-v7` → "mentoria-v7". El
  // `/login` pelado no pertenece a ninguna, y entonces la pantalla es de Klaze.
  //
  // `/callback` no lleva slug en la ruta, así que el login se lo pasa como
  // `?academia=` — sin esto, la transición tras entrar por la puerta de una
  // academia parpadeaba en azul Klaze. Se lee de `window.location` y no de
  // `useSearchParams` para no obligar a un límite de Suspense; el estado
  // perezoso basta porque la marca arranca vacía igual en servidor y cliente.
  const [slugConsulta] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("academia")
  );
  const partes = (pathname ?? "").split("/").filter(Boolean);
  const slug =
    partes[0] === "login" ? partes[1] : (slugConsulta ?? undefined);
  const marca = useMarcaAuth(slug);

  return (
    // Por contexto y no por props: `AuthFormCard` lo monta cada página hija,
    // así que pasarlo a mano obligaría a que las cinco supieran de esto.
    <MarcaAuthContext.Provider value={marca}>
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
        <AuthBrandPanel
          videoUrl={marca.portada.videoUrl}
          posterUrl={marca.portada.posterUrl}
        />
        <div className="light flex items-center justify-center bg-background px-6 py-12 text-foreground sm:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </MarcaAuthContext.Provider>
  );
}
