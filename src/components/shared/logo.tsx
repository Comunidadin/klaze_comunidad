import Link from "next/link";
import { cn } from "@/lib/utils";

const MONOGRAMA_TAMANO: Record<"sm" | "md" | "lg", string> = {
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-10 text-base",
};

const WORDMARK_TAMANO: Record<"sm" | "md" | "lg", string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

export interface LogoProps {
  /** Tamaño del monograma "K" + wordmark. */
  size?: "sm" | "md" | "lg";
  /** Oculta el wordmark "KLAZE" y deja solo el monograma (útil en sidebars colapsadas). */
  soloMonograma?: boolean;
  /** Si se pasa, el logo se renderiza como enlace. */
  href?: string;
  className?: string;
}

/**
 * Wordmark de la marca Klaze: monograma "K" en índigo + wordmark en
 * font-display. No confundir con el logo de una comunidad (ver
 * `MemberShell`, que usa `community.logoUrl`).
 */
export function Logo({ size = "md", soloMonograma = false, href, className }: LogoProps) {
  const contenido = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary font-display font-bold text-primary-foreground",
          MONOGRAMA_TAMANO[size]
        )}
        aria-hidden={!soloMonograma}
      >
        K
      </span>
      {!soloMonograma && (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-foreground",
            WORDMARK_TAMANO[size]
          )}
        >
          KLAZE
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="Klaze" className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        {contenido}
      </Link>
    );
  }

  return contenido;
}
