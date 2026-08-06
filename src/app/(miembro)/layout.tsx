"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return <FullScreenLoader />;
  }

  return (
    <>
      {children}
    </>
  );
}
