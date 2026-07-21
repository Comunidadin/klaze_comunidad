"use client";

import { ChevronsUpDown } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { mockUsers } from "@/lib/mocks/users";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/lib/types";

// u-creador (Daniel) ya no es el chip de "creador": tras Cambio 1, esa
// cuenta pasó a Marta (u-creador2, dueña de "Inglés con Marta") y Daniel
// quedó como alumno normal — ver `mocks/users.ts`.
const IDS_SEMILLA = ["u-alumno", "u-creador2", "u-admin"] as const;

const USUARIOS_SEMILLA = IDS_SEMILLA.map((id) => mockUsers.find((u) => u.id === id)).filter(
  (u) => u != null
);

const ETIQUETA_ROL: Record<UserRole, string> = {
  alumno: "Alumno",
  creador: "Creadora",
  superadmin: "Super-admin",
};

/**
 * Pill flotante inferior-derecha, solo para demo: permite saltar entre los
 * 3 usuarios semilla sin pasar por el login. Se monta en los 3 layouts de
 * grupo (miembro/creador/superadmin), siempre con sesión ya garantizada
 * por el guard del layout — si por algo se renderiza sin usuario, no
 * muestra nada.
 */
export function UserSwitcher() {
  const { user, login } = useSession();

  if (!user) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-border bg-card/95 py-1.5 pr-3 pl-1.5 text-sm shadow-lg backdrop-blur transition-colors hover:bg-muted supports-backdrop-filter:bg-card/85"
          >
            <Avatar size="sm">
              <AvatarImage src={user.avatarUrl} alt={user.nombre} />
              <AvatarFallback>{user.nombre[0]}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{user.nombre.split(" ")[0]}</span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              demo
            </Badge>
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-64">
          <DropdownMenuLabel>Cambiar de usuario (demo)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {USUARIOS_SEMILLA.map((seed) => (
            <DropdownMenuItem
              key={seed.id}
              disabled={seed.id === user.id}
              onSelect={() => login(seed.email)}
              className="gap-2 py-1.5"
            >
              <Avatar size="sm">
                <AvatarImage src={seed.avatarUrl} alt={seed.nombre} />
                <AvatarFallback>{seed.nombre[0]}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-foreground">{seed.nombre}</span>
                <span className="text-xs text-muted-foreground">{ETIQUETA_ROL[seed.rol]}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
