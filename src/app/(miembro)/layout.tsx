"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

/**
 * Guard del grupo `(miembro)`: cualquier usuario logueado puede entrar
 * (alumno, creador o superadmin — todos tienen `/perfil` y pueden navegar
 * comunidades). No aplica ningún shell visual aquí: `MemberShell` vive en
 * `(miembro)/c/[comunidad]/layout.tsx` porque necesita el slug del
 * segmento de ruta, que este layout no tiene.
 */
export default function MiembroLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      // A la puerta de la academia en la que estabas, si la ruta la nombra:
      // quien sale (o caduca) dentro de `/c/vivir-de-ia/...` aterriza en
      // `/login/vivir-de-ia`, con SU marca. Este guard compite con el
      // redirect de `handleLogout` y suele ganar — por eso la regla vive
      // aquí, no solo en el botón de salir.
      const slug = pathname?.startsWith("/c/") ? pathname.split("/")[2] : null;
      router.replace(slug ? `/login/${slug}` : "/login");
    }
  }, [hydrated, user, router, pathname]);

  if (!hydrated || !user) {
    return <FullScreenLoader />;
  }

  return (
    <>
      {children}
    </>
  );
}
