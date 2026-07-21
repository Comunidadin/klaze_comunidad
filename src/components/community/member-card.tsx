"use client";

import { LevelBadge } from "@/components/shared/level-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

export interface MemberCardProps {
  usuario: User;
  onClick?: () => void;
  className?: string;
}

/** Tarjeta de miembro del directorio: avatar + nivel, nombre, bio corta. Clickeable para abrir el perfil completo en un Dialog. */
export function MemberCard({ usuario, onClick, className }: MemberCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-3 rounded-2xl bg-card p-5 text-center ring-1 ring-foreground/10 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="relative">
        <Avatar size="lg">
          <AvatarImage src={usuario.avatarUrl} alt={usuario.nombre} />
          <AvatarFallback>{usuario.nombre[0]}</AvatarFallback>
        </Avatar>
        <LevelBadge
          nivel={usuario.nivel}
          size="sm"
          className="absolute -right-1.5 -bottom-1.5"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-foreground">
          {usuario.nombre}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-pretty text-muted-foreground">
          {usuario.bio || "Sin biografía todavía."}
        </p>
      </div>
    </button>
  );
}
