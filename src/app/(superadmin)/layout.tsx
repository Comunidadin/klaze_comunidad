"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, LayoutDashboard, Users } from "lucide-react";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { homePorRol } from "@/lib/routes";
import { AdminShell, type AdminNavItem } from "@/components/shells/admin-shell";
import { UserSwitcher } from "@/components/shared/user-switcher";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

const ITEMS: AdminNavItem[] = [
  { titulo: "Dashboard", href: "/plataforma", icono: LayoutDashboard },
  { titulo: "Comunidades", href: "/plataforma/comunidades", icono: Building2 },
  { titulo: "Creadores", href: "/plataforma/creadores", icono: Users },
  { titulo: "Planes", href: "/plataforma/planes", icono: CreditCard },
];

/**
 * Guard del grupo `(superadmin)`: solo `rol === "superadmin"`. Cualquier
 * otro rol logueado se manda a su propio home (nunca a `/login`, ya que
 * sí tiene sesión — solo no tiene permiso para esta sección).
 */
export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();
  const autorizado = user !== null && user.rol === "superadmin";

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!autorizado) {
      router.replace(homePorRol(user));
    }
  }, [hydrated, user, autorizado, router]);

  if (!hydrated || !user || !autorizado) {
    return <FullScreenLoader />;
  }

  return (
    <>
      <AdminShell items={ITEMS} titulo="Panel de plataforma">
        {children}
      </AdminShell>
      <UserSwitcher />
    </>
  );
}
