"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Globe,
  KeyRound,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Users,
  Eye,
} from "lucide-react";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { useAppStore } from "@/lib/store";
import { AcademiaSuspendida } from "@/components/shared/academia-suspendida";
import { MarcaAcademia } from "@/components/shared/marca-academia";
import { homePorRol } from "@/lib/routes";
import { AdminShell, type AdminNavItem } from "@/components/shells/admin-shell";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

const ITEMS_BASE: AdminNavItem[] = [
  { titulo: "Panel", href: "/admin", icono: LayoutDashboard },
  { titulo: "Alumnos", href: "/admin/alumnos", icono: Users },
  { titulo: "Accesos", href: "/admin/accesos", icono: KeyRound },
  { titulo: "Módulos", href: "/admin/cursos", icono: BookOpen },
  { titulo: "Comunidad", href: "/admin/comunidad", icono: MessagesSquare },
  { titulo: "Eventos", href: "/admin/eventos", icono: CalendarDays },
  { titulo: "Reportes", href: "/admin/reportes", icono: BarChart3 },
  { titulo: "Configuración", href: "/admin/configuracion", icono: Settings },
];

// Enlace cruzado: solo el superadmin (dueño de Comunidad del Intercambio) ve el link a su panel
// de plataforma desde el admin de "su" academia — un creador normal (p. ej.
// Marta) no administra la plataforma y no debe verlo.
const ITEM_PLATAFORMA: AdminNavItem = {
  titulo: "Panel plataforma",
  href: "/plataforma",
  icono: Globe,
};

/**
 * Ver la academia como la ve un alumno.
 *
 * No es un capricho: el creador decide portadas, orden y qué publica sin haber
 * visto nunca el resultado. Solo aparece si hay academia en el armazón —sin
 * slug el enlace no lleva a ninguna parte— y hace falta que el creador esté
 * inscrito en la suya, que es lo que `crearAcademia` ahora garantiza.
 */
function itemAreaAlumno(slug: string): AdminNavItem {
  return { titulo: "Ver como alumno", href: `/c/${slug}/cursos`, icono: Eye };
}

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
  const comunidad = useAppStore((s) => s.armazon)?.comunidad;
  const items = [
    ...ITEMS_BASE,
    ...(comunidad?.slug ? [itemAreaAlumno(comunidad.slug)] : []),
    ...(user?.rol === "superadmin" ? [ITEM_PLATAFORMA] : []),
  ];

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

  // El superadmin queda fuera: es quien reactiva. Si se le cerrara la puerta,
  // suspender su propia academia seria irreversible.
  if (comunidad?.estado === "suspendida" && user.rol !== "superadmin") {
    return (
      <AcademiaSuspendida
        nombre={comunidad.nombre}
        logoUrl={comunidad.logoUrl}
        colorAcento={comunidad.colorAcento}
        quien="creador"
      />
    );
  }

  return (
    <>
      <AdminShell
        items={items}
        titulo="Panel de creador"
        marca={(compacto) => (
          <MarcaAcademia
            nombre={comunidad?.nombre ?? "Tu academia"}
            logoUrl={comunidad?.logoUrl}
            colorAcento={comunidad?.colorAcento}
            size="sm"
            href="/admin"
            soloMonograma={compacto}
          />
        )}
      >
        {children}
      </AdminShell>
    </>
  );
}
