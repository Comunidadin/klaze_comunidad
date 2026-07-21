"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, SearchX, User as UserIcon } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useSession } from "@/lib/hooks/use-session";
import { useThemeToggle } from "@/components/shared/theme-toggle";
import { LevelBadge } from "@/components/shared/level-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Inicio", segmento: "inicio" },
  { label: "Cursos", segmento: "cursos" },
  { label: "Calendario", segmento: "calendario" },
  { label: "Miembros", segmento: "miembros" },
  { label: "Ranking", segmento: "ranking" },
] as const;

export interface MemberShellProps {
  /** Slug de la comunidad (segmento `[comunidad]` de la ruta). */
  communitySlug: string;
  children: React.ReactNode;
}

/**
 * Shell del área de miembros: header sticky con logo/nombre de la
 * comunidad, tabs de navegación estilo Skool y menú de avatar. Aplica
 * `colorAcento` de la comunidad como `--community-accent` para
 * personalización visual por comunidad.
 */
export function MemberShell({ communitySlug, children }: MemberShellProps) {
  const resultado = useCommunity(communitySlug);
  const { user, logout } = useSession();
  const pathname = usePathname();
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

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{ "--community-accent": community.colorAcento } as React.CSSProperties}
    >
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={`/c/${community.slug}/inicio`}
            className="flex min-w-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
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

          <nav className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const href = `/c/${community.slug}/${tab.segmento}`;
              const activo = pathname?.startsWith(href) ?? false;
              return (
                <Link
                  key={tab.segmento}
                  href={href}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activo && "bg-primary/10 text-primary"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

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
