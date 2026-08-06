"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, SearchX, User as UserIcon } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useSession } from "@/lib/hooks/use-session";
import { useThemeToggle } from "@/components/shared/theme-toggle";
import { LevelBadge } from "@/components/shared/level-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AcademiaSuspendida } from "@/components/shared/academia-suspendida";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MemberShellProps {
  /** Slug de la comunidad (segmento `[comunidad]` de la ruta). */
  communitySlug: string;
  children: React.ReactNode;
}

/**
 * Shell del área de miembros: header sticky con logo/nombre de la comunidad
 * y menú de avatar. Aplica `colorAcento` de la comunidad como
 * `--community-accent` para personalización visual por comunidad.
 *
 * Desde Cambio 3 el nivel superior del área de miembros es solo la lista de
 * cursos — ya no hay tabs de Inicio/Calendario/Miembros/Ranking a este
 * nivel (esas 4 pantallas viven ahora DENTRO de cada curso, ver
 * `cursos/[curso]/(tabs)/_curso-tabs-shell.tsx`), así que este shell dejó de
 * necesitar la nav de tabs y el layout de 3 columnas que tenía antes: es una
 * sola columna centrada para toda página de `/c/[comunidad]/*`.
 */
export function MemberShell({ communitySlug, children }: MemberShellProps) {
  const resultado = useCommunity(communitySlug);
  const { user, logout } = useSession();
  const router = useRouter();
  const { Icono: IconoTema, etiqueta: etiquetaTema, toggle: toggleTema } = useThemeToggle();

  if (!resultado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState
          icono={SearchX}
          titulo="Comunidad no encontrada"
          descripcion={`No existe ninguna comunidad con el enlace "${communitySlug}".`}
          accion={{ label: "Volver al inicio", href: "/" }}
        />
      </div>
    );
  }

  const { community } = resultado;

  async function handleLogout() {
    // `logout` es asincrono: cierra la sesion en Supabase. Sin el await, el
    // redirect puede adelantarse y dejar la cookie viva un instante, con lo
    // que el guard del layout te devuelve dentro.
    await logout();
    router.replace("/login");
  }

  // Academia suspendida: el superadmin la suspende desde
  // `/plataforma/comunidades`, y desde la rebanada 4 eso revoca acceso REAL en
  // la base — no solo esta pantalla. El propio superadmin sigue entrando,
  // porque es quien reactiva.
  //
  // El comentario que había aquí decía que el creador conservaba su panel
  // mientras durase la suspensión. Dejó de ser cierto: las políticas también
  // lo dejan fuera, y el layout de `(creador)` enseña esta misma pantalla.
  if (community.estado === "suspendida" && user?.rol !== "superadmin") {
    return (
      <AcademiaSuspendida
        nombre={community.nombre}
        logoUrl={community.logoUrl}
        colorAcento={community.colorAcento}
        quien="miembro"
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{ "--community-accent": community.colorAcento } as React.CSSProperties}
    >
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={`/c/${community.slug}/cursos`}
            className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- logo mock (dicebear) sin dominio configurado en next/image */}
            <img
              src={community.logoUrl}
              alt=""
              className="size-9 shrink-0 rounded-lg border border-border object-cover"
              style={{ boxShadow: "0 0 0 2px var(--community-accent)" }}
            />
            <span className="hidden truncate font-display text-base font-semibold text-foreground sm:inline">
              {community.nombre}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-3">
            {user && <LevelBadge nivel={user.nivel} size="sm" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Menú de cuenta"
                >
                  <Avatar>
                    <AvatarImage src={user?.avatarUrl} alt={user?.nombre ?? ""} />
                    <AvatarFallback>{user?.nombre?.[0] ?? "?"}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.nombre}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/perfil">
                    <UserIcon className="size-4" /> Mi perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleTema();
                  }}
                >
                  <IconoTema className="size-4" /> {etiquetaTema}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  <LogOut className="size-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
