"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  KeyRound,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { homePorRol } from "@/lib/routes";
import { AdminShell, type AdminNavItem } from "@/components/shells/admin-shell";
import { UserSwitcher } from "@/components/shared/user-switcher";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

const ITEMS: AdminNavItem[] = [
  { titulo: "Panel", href: "/admin", icono: LayoutDashboard },
  { titulo: "Alumnos", href: "/admin/alumnos", icono: Users },
  { titulo: "Accesos", href: "/admin/accesos", icono: KeyRound },
  { titulo: "Cursos", href: "/admin/cursos", icono: BookOpen },
  { titulo: "Comunidad", href: "/admin/comunidad", icono: MessagesSquare },
  { titulo: "Eventos", href: "/admin/eventos", icono: CalendarDays },
  { titulo: "Reportes", href: "/admin/reportes", icono: BarChart3 },
  { titulo: "Configuración", href: "/admin/configuracion", icono: Settings },
];

/**
 * Guard del grupo `(creador)`: solo `rol === "creador"` o `"superadmin"`
 * (el superadmin también puede entrar a inspeccionar el admin de una
 * comunidad). Cualquier otro rol se manda a su propio home.
 */
export default function CreadorLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();
  const autorizado = user !== null && (user.rol === "creador" || user.rol === "superadmin");

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
      <AdminShell items={ITEMS} titulo="Panel de creador">
        {children}
      </AdminShell>
      <UserSwitcher />
    </>
  );
}
