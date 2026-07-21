"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronsLeft, ChevronsRight, LogOut, Menu } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  titulo: string;
  href: string;
  icono: LucideIcon;
}

export interface AdminShellProps {
  items: AdminNavItem[];
  /** Título mostrado en la barra superior (ej. "Panel de creador"). */
  titulo: string;
  children: React.ReactNode;
}

function esActivo(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shell de administración: sidebar colapsable en desktop (con `items` +
 * `titulo` como props), reemplazada por un `Sheet` en mobile. Reutilizable
 * por `(creador)` y `(superadmin)` — cada layout pasa su propia lista de
 * `items`.
 */
export function AdminShell({ items, titulo, children }: AdminShellProps) {
  const [colapsado, setColapsado] = useState(false);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useSession();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function renderNav(compacto: boolean, onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {items.map((item) => {
          const Icono = item.icono;
          const activo = esActivo(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                activo && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                compacto && "justify-center px-2"
              )}
              title={compacto ? item.titulo : undefined}
            >
              <Icono className="size-4 shrink-0" />
              {!compacto && <span className="truncate">{item.titulo}</span>}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex",
          colapsado ? "w-16" : "w-60"
        )}
      >
        <div className={cn("flex h-16 items-center px-4", colapsado ? "justify-center" : "justify-between")}>
          {!colapsado && <Logo size="sm" href="/" />}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setColapsado((v) => !v)}
            aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
          >
            {colapsado ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </Button>
        </div>

        {renderNav(colapsado)}

        <div className="border-t border-border p-3">
          <div className={cn("flex items-center gap-2", colapsado && "flex-col")}>
            <Avatar size="sm">
              <AvatarImage src={user?.avatarUrl} alt={user?.nombre ?? ""} />
              <AvatarFallback>{user?.nombre?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            {!colapsado && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user?.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            )}
            <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Cerrar sesión">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur supports-backdrop-filter:bg-card/85 sm:px-6">
          <Sheet open={sheetAbierto} onOpenChange={setSheetAbierto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 gap-0 p-0">
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <div className="flex h-16 items-center px-4">
                <Logo size="sm" />
              </div>
              {renderNav(false, () => setSheetAbierto(false))}
            </SheetContent>
          </Sheet>

          <h1 className="font-display text-lg font-semibold text-foreground">{titulo}</h1>

          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
