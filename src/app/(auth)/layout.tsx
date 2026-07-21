"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
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
 * `/invitacion/[token]` (Task 6) queda excluida de este guard —tanto del
 * loader por hidratación como del redirect— a propósito: un usuario ya
 * logueado debe poder abrir su propio link de invitación (p. ej. el
 * creador probando el link) sin que lo saquemos de la pantalla, y justo
 * después de `aceptarInvitacion` la sesión pasa de null a un usuario
 * nuevo — sin esta excepción este mismo guard competiría con el redirect
 * explícito de la página hacia `/c/{slug}/cursos` y ganaría el redirect
 * equivocado (`homePorRol` → `/c/{slug}/inicio`). La pantalla de
 * invitación maneja su propio estado de carga vía `useHydrated` interno.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const esInvitacion = pathname?.startsWith("/invitacion") ?? false;

  useEffect(() => {
    if (!hydrated || !user || esInvitacion) return;
    router.replace(homePorRol(user));
  }, [hydrated, user, router, esInvitacion]);

  if (!esInvitacion && (!hydrated || user)) {
    return <FullScreenLoader />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel />
      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
