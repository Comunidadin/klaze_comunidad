import Link from "next/link";
import { cn } from "@/lib/utils";

const MARCA_TAMANO: Record<"sm" | "md" | "lg", string> = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
};

const WORDMARK_TAMANO: Record<"sm" | "md" | "lg", string> = {
  sm: "text-[0.7rem] leading-tight",
  md: "text-sm leading-tight",
  lg: "text-lg leading-tight",
};

const MONOGRAMA_TAMANO: Record<"sm" | "md" | "lg", string> = {
  sm: "text-[0.65rem]",
  md: "text-sm",
  lg: "text-lg",
};

export interface MarcaAcademiaProps {
  nombre: string;
  /** Vacío en casi todas: ninguna academia nace con logo. Ver el monograma. */
  logoUrl?: string;
  /** Color de acento de la academia; da el fondo del monograma. */
  colorAcento?: string;
  size?: "sm" | "md" | "lg";
  /** Oculta el nombre y deja solo la marca gráfica (sidebars colapsadas). */
  soloMonograma?: boolean;
  href?: string;
  orientacion?: "horizontal" | "vertical";
  className?: string;
}

/** Primera letra útil del nombre, en mayúscula. `"élite v2"` → `"É"`. */
function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Marca de una academia concreta: su nombre y su logo.
 *
 * **Sin logo dibuja un monograma** —la inicial sobre su color de acento— y ese
 * es el caso normal, no la excepción: `logo_url` nace vacío y ningún creador
 * sube nada el primer día. Si la marca blanca dependiera de que lo hicieran,
 * lo que vería casi todo el mundo sería un hueco.
 *
 * No confundir con `LogoPlataforma`, que es la marca de Klaze y solo aparece
 * en `/plataforma` y en la pantalla de entrada genérica. Un creador nunca ve
 * la marca de su proveedor dentro de su propio panel: para él, la herramienta
 * es suya.
 */
export function MarcaAcademia({
  nombre,
  logoUrl,
  colorAcento,
  size = "md",
  soloMonograma = false,
  href,
  orientacion = "horizontal",
  className,
}: MarcaAcademiaProps) {
  const vertical = orientacion === "vertical";
  const tieneLogo = Boolean(logoUrl?.trim());

  const contenido = (
    <span
      className={cn(
        "inline-flex",
        vertical ? "flex-col items-center gap-3 text-center" : "items-center gap-2.5",
        className
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-black/10",
          tieneLogo && "bg-white",
          vertical ? "size-14 rounded-2xl" : MARCA_TAMANO[size]
        )}
        // El acento va inline porque es dato de cada academia, no un token del
        // tema: no hay clase de Tailwind que lo cubra.
        style={
          tieneLogo
            ? undefined
            : { backgroundColor: colorAcento || "var(--primary)" }
        }
      >
        {tieneLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element -- logo subido por el creador, dominio arbitrario: next/image exigiría configurarlos todos */
          <img
            src={logoUrl}
            alt=""
            aria-hidden="true"
            className="size-full object-contain p-0.5"
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "font-display font-bold text-white",
              vertical ? "text-2xl" : MONOGRAMA_TAMANO[size]
            )}
          >
            {inicial(nombre)}
          </span>
        )}
      </span>
      {!soloMonograma && (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-balance text-foreground",
            vertical ? "text-xl leading-tight" : WORDMARK_TAMANO[size]
          )}
        >
          {nombre}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={nombre}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {contenido}
      </Link>
    );
  }

  return contenido;
}
