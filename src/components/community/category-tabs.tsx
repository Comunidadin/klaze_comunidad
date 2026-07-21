"use client";

import { cn } from "@/lib/utils";

/** Sentinela para "sin filtro de categoría" — no es una categoría real de ninguna comunidad. */
export const TODAS_LAS_CATEGORIAS = "Todas";

export interface CategoryTabsProps {
  /** Categorías propias de la comunidad (`community.categorias`), sin "Todas". */
  categorias: string[];
  activa: string;
  onCambiar: (categoria: string) => void;
  className?: string;
}

/**
 * Barra de pestañas por categoría, estilo píldora sobre fondo `bg-muted`
 * (mismo lenguaje visual que `TabsList` de shadcn). Reutilizable: el feed
 * (T10) filtra posts con ella, y la moderación de comunidad (T14) la usará
 * para filtrar la cola de reportes/posts por categoría.
 */
export function CategoryTabs({ categorias, activa, onCambiar, className }: CategoryTabsProps) {
  const opciones = [TODAS_LAS_CATEGORIAS, ...categorias];

  return (
    <div
      role="tablist"
      aria-label="Filtrar por categoría"
      className={cn(
        "flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1",
        className
      )}
    >
      {opciones.map((categoria) => {
        const activo = categoria === activa;
        return (
          <button
            key={categoria}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onCambiar(categoria)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activo
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {categoria}
          </button>
        );
      })}
    </div>
  );
}
