import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  accion?: EmptyStateAction;
  className?: string;
}

/** Estado vacío genérico: listas sin datos, búsquedas sin resultados, errores 404 suaves. */
export function EmptyState({ icono: Icono, titulo, descripcion, accion, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icono className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">{titulo}</h3>
      <p className="max-w-sm text-sm text-balance text-muted-foreground">{descripcion}</p>
      {accion &&
        (accion.href ? (
          <Button asChild className="mt-2">
            <Link href={accion.href}>{accion.label}</Link>
          </Button>
        ) : (
          <Button className="mt-2" onClick={accion.onClick}>
            {accion.label}
          </Button>
        ))}
    </div>
  );
}
