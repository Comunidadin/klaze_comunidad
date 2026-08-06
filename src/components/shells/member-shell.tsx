"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, LogOut, SearchX, User as UserIcon } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useSession } from "@/lib/hooks/use-session";
import { useThemeToggle } from "@/components/shared/theme-toggle";
import { LevelBadge } from "@/components/shared/level-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
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

  // Bloqueo de comunidad suspendida (T15): el superadmin la suspende desde
  // `/plataforma/comunidades` (`cambiarEstadoComunidad`, override aplicado
  // por `resolverComunidad` — ver `useCommunity`). Cualquier miembro no
  // superadmin (incluido el creador dueño) pierde el área de miembros
  // `/c/[slug]/*` mientras dure la suspensión; el propio superadmin puede
  // seguir entrando para verificar/reactivar. A propósito NO se replica este
  // check en `/admin` (panel del creador): el brief pide mantenerlo simple
  // y solo bloquear el área de miembros, así el creador conserva acceso a
  // su contenido para poder, por ejemplo, contactar a Comunidad del Intercambio o revisar qué
  // pasó — igual que la reactivación, ambos casos son responsabilidad del
  // superadmin, no del alumno.
  if (community.estado === "suspendida" && user?.rol !== "superadmin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <Logo />
        <div className="mt-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Lock className="size-7" />
        </div>
        <h1 className="max-w-sm font-display text-2xl font-bold tracking-tight text-foreground">
          Esta comunidad está temporalmente suspendida
        </h1>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">
          {community.nombre} no está disponible en este momento. Si crees que esto es un error,
          contacta al equipo de Comunidad del Intercambio.
        </p>
        <Button variant="outline" onClick={handleLogout} className="mt-2">
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </div>
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
