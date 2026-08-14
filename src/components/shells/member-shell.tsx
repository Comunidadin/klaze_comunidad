"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  Calendar,
  LogOut,
  MessagesSquare,
  Search,
  SearchX,
  Trophy,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useSession } from "@/lib/hooks/use-session";
import { useThemeToggle } from "@/components/shared/theme-toggle";
import { LevelBadge } from "@/components/shared/level-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AcademiaSuspendida } from "@/components/shared/academia-suspendida";
import { Buscador } from "@/components/shared/buscador";
import { Campanita } from "@/components/shared/campanita";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon, type AcademiaMia } from "@/lib/supabase/consultas";
import { useAppStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
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
 * Lo que hay en una academia, además de sus módulos.
 *
 * Las cuatro últimas vivían dentro de cada módulo. Subieron aquí con la
 * comunidad: un alumno no tiene "el ranking de Introducción" y "el ranking de
 * Avanzada", tiene el de su academia.
 */
const NAV = [
  { label: "Módulos", segmento: "/cursos", Icono: BookOpen },
  { label: "Comunidad", segmento: "/comunidad", Icono: MessagesSquare },
  { label: "Calendario", segmento: "/calendario", Icono: Calendar },
  { label: "Miembros", segmento: "/miembros", Icono: Users },
  { label: "Ranking", segmento: "/ranking", Icono: Trophy },
] as const;

/**
 * Shell del área de miembros: cabecera fija con el logo y el nombre de la
 * academia, su navegación y el menú de la cuenta. Aplica `colorAcento` como
 * `--community-accent`, que es de donde sale el color de toda el área.
 */
export function MemberShell({ communitySlug, children }: MemberShellProps) {
  const resultado = useCommunity(communitySlug);
  const { user, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { Icono: IconoTema, etiqueta: etiquetaTema, toggle: toggleTema } = useThemeToggle();
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const misAcademias = useAppStore((s) => s.armazon?.misAcademias);
  const fijarAcademiaActiva = useAppStore((s) => s.fijarAcademiaActiva);
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);

  async function cambiarAcademia(academia: AcademiaMia) {
    // Primero la preferencia, después el armazón nuevo, y por último navegar:
    // así la pantalla de destino ya nace con los datos de la academia elegida.
    fijarAcademiaActiva(academia.id);
    establecerArmazon(await cargarArmazon(crearClienteNavegador(), academia.id));
    router.push(`/c/${academia.slug}/cursos`);
  }

  // ⌘K / Ctrl-K abre el buscador desde cualquier pantalla del área.
  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuscadorAbierto(true);
      }
    }
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, []);

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
    // A la puerta DE ESTA academia, no a la generica de Klaze: quien sale de
    // Vivir de IA debe aterrizar en el login con la marca de Vivir de IA.
    router.replace(`/login/${community.slug}`);
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

          {/* La navegación de la academia. Estas cuatro eran pestañas DENTRO de
              cada módulo; al subir la comunidad al nivel de la academia suben
              con ella, porque ya no dependen de en qué módulo estés. */}
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
            {NAV.map((item) => {
              const href = `/c/${community.slug}${item.segmento}`;
              // `startsWith` y no igualdad: `/comunidad/espacio/preguntas` tiene
              // que dejar «Comunidad» marcada como activa.
              const activo = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
              return (
                <Link
                  key={item.label}
                  href={href}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activo && "bg-primary/10 text-primary"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setBuscadorAbierto(true)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Buscar en la academia"
              title="Buscar (⌘K)"
            >
              <Search className="size-4" />
            </button>
            <Campanita comunidadId={community.id} comunidadSlug={community.slug} />
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
                {misAcademias && misAcademias.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Cambiar de academia
                    </DropdownMenuLabel>
                    {misAcademias
                      .filter((a) => a.id !== community.id)
                      .map((a) => (
                        <DropdownMenuItem
                          key={a.id}
                          onSelect={() => void cambiarAcademia(a)}
                        >
                          <ArrowLeftRight className="size-4" />
                          <span className="truncate">{a.nombre}</span>
                        </DropdownMenuItem>
                      ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  <LogOut className="size-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">{children}</main>

      {/* La barra de pestañas de movil: en el pulgar, no arriba. La superior
          se esconde bajo `md:` — misma lista, dos formas. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-card/85 md:hidden"
        aria-label="Secciones de la academia"
      >
        {NAV.map(({ label, segmento, Icono }) => {
          const href = `/c/${community.slug}${segmento}`;
          const activo = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
          return (
            <Link
              key={segmento}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                activo ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icono className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <Buscador
        comunidadId={community.id}
        comunidadSlug={community.slug}
        open={buscadorAbierto}
        onOpenChange={setBuscadorAbierto}
      />
    </div>
  );
}
