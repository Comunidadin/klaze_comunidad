"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, GraduationCap, LayoutDashboard, Users } from "lucide-react";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { homePorRol } from "@/lib/routes";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { AdminShell, type AdminNavItem } from "@/components/shells/admin-shell";
import { UserSwitcher } from "@/components/shared/user-switcher";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

const ITEMS_BASE: AdminNavItem[] = [
  { titulo: "Panel", href: "/plataforma", icono: LayoutDashboard },
  { titulo: "Comunidades", href: "/plataforma/comunidades", icono: Building2 },
  { titulo: "Creadores", href: "/plataforma/creadores", icono: Users },
  { titulo: "Planes", href: "/plataforma/planes", icono: CreditCard },
];

// Enlace cruzado: solo cuando el superadmin es dueño de alguna comunidad
// (hoy, u-admin con "Academia Klaze") ve el link a su propio admin — un
// superadmin sin comunidad propia no tiene a dónde ir con este link.
const ITEM_MI_ACADEMIA: AdminNavItem = {
  titulo: "Mi academia",
  href: "/admin",
  icono: GraduationCap,
};

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
  const miComunidad = useMyCommunity();
  const items = miComunidad ? [...ITEMS_BASE, ITEM_MI_ACADEMIA] : ITEMS_BASE;

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
      <AdminShell items={items} titulo="Panel de plataforma">
        {children}
      </AdminShell>
      <UserSwitcher />
    </>
  );
}
