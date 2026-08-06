"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { homePorRol } from "@/lib/routes";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

/**
 * Aterrizaje del enlace de correo.
 *
 * El cliente de Supabase canjea el enlace por una sesión al arrancar;
 * `useHydrated` espera a que eso termine y a que lleguen los datos. En cuanto
 * hay usuario, se redirige según su rol — la misma tabla (`homePorRol`) que
 * usa el resto de la app, para no tener dos versiones de esa decisión.
 *
 * Si el enlace ya caducó o fue usado, no hay sesión y se vuelve a `/login`.
 */
export default function CallbackPage() {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(user ? homePorRol(user) : "/login");
  }, [hydrated, user, router]);

  return <FullScreenLoader />;
}
