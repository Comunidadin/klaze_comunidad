import Link from "next/link";
import { cn } from "@/lib/utils";

const NOMBRE_PLATAFORMA = "Klaze";

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

export interface LogoPlataformaProps {
  /** Tamaño de la marca gráfica + wordmark. */
  size?: "sm" | "md" | "lg";
  /** Oculta el wordmark y deja solo la marca gráfica (útil en sidebars colapsadas). */
  soloMonograma?: boolean;
  /** Si se pasa, el logo se renderiza como enlace. */
  href?: string;
  /** `vertical` apila marca sobre wordmark y centra — para portadas y pantallas de entrada. */
  orientacion?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Marca de **Klaze, la plataforma**. Solo aparece donde el dueño de la
 * plataforma es el usuario: `/plataforma` y la pantalla de entrada genérica.
 *
 * Para la marca de una academia concreta está `MarcaAcademia`. La distinción
 * importa: durante un tiempo esta constante estuvo fija en "Comunidad del
 * Intercambio" y todo creador veía el nombre de una empresa ajena dentro de su
 * propio panel.
 *
 * El icono es todavía el de Comunidad del Intercambio, a falta de uno de
 * Klaze. Se sustituye cambiando un archivo.
 *
 * La imagen va sobre una teja blanca a propósito: el logo tiene el globo
 * blanco con los continentes en negro, así que recortarle el fondo lo
 * volvería ilegible en modo oscuro (negro sobre negro). La teja blanca lo
 * mantiene idéntico en ambos temas, que es como se usa un logo de marca.
 */
export function LogoPlataforma({
  size = "md",
  soloMonograma = false,
  href,
  orientacion = "horizontal",
  className,
}: LogoPlataformaProps) {
  const vertical = orientacion === "vertical";

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
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/10",
          vertical ? "size-14 rounded-2xl" : MARCA_TAMANO[size]
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- asset local estático; next/image no aporta aquí */}
        <img
          src="/marca/icono-64.png"
          alt=""
          aria-hidden="true"
          className="size-full object-contain p-0.5"
        />
      </span>
      {!soloMonograma && (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-balance text-foreground",
            vertical ? "text-xl leading-tight" : WORDMARK_TAMANO[size]
          )}
        >
          {NOMBRE_PLATAFORMA}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={NOMBRE_PLATAFORMA}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {contenido}
      </Link>
    );
  }

  return contenido;
}
