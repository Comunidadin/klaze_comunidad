"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
 * /recuperar, así que lo mandamos a su home por rol. No mostramos el
 * loader mientras el store no ha hidratado (caso más común: visitante
 * anónimo) para no parpadear una pantalla de carga en cada visita — solo
 * aparece en el breve instante en que detectamos una sesión existente y
 * redirigimos.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || !user) return;
    router.replace(homePorRol(user));
  }, [hydrated, user, router]);

  if (hydrated && user) {
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
