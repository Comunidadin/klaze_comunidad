import Link from "next/link";
import { MarcaAcademia } from "@/components/shared/marca-academia";

export interface SiteFooterProps {
  /** Slug de la comunidad activa — las rutas del área de miembros cuelgan de él. */
  comunidadSlug: string;
  /** Nombre de la academia: marca y línea de copyright. */
  nombreComunidad: string;
  logoUrl?: string;
  colorAcento?: string;
}

/** Año fijo: la demo no usa `Date.now()` en render (ver la regla de determinismo en CLAUDE.md). */
const ANIO = 2026;

/**
 * Pie del área de miembros: marca a la izquierda y columnas de enlaces.
 *
 * Todos los enlaces apuntan a rutas que existen de verdad. La columna de
 * términos y políticas de la referencia no está porque este proyecto no
 * tiene esas páginas: ponerlas llevaría a un 404, que es peor que no
 * ofrecerlas. Cuando existan, se agregan aquí.
 *
 * Desde Cambio 3 el nivel superior del área de miembros es solo la lista de
 * cursos — Calendario/Miembros/Ranking dejaron de ser rutas de comunidad
 * (ahora son pestañas DENTRO de cada curso, sin un destino único al que
 * este pie —que no sabe en qué curso está el visitante— pueda enlazar), así
 * que esas columnas se quitaron. Solo quedan enlaces a rutas de nivel de
 * comunidad reales.
 */
export function SiteFooter({
  comunidadSlug,
  nombreComunidad,
  logoUrl,
  colorAcento,
}: SiteFooterProps) {
  const base = `/c/${comunidadSlug}`;

  const columnas = [
    {
      titulo: "Mapa del sitio",
      enlaces: [
        { label: "Mis vitrinas", href: `${base}/cursos` },
        { label: "Mi perfil", href: "/perfil" },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border pt-10 pb-4">
      <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
        <div>
          <MarcaAcademia
            nombre={nombreComunidad}
            logoUrl={logoUrl}
            colorAcento={colorAcento}
            href={`${base}/cursos`}
            orientacion="vertical"
            className="sm:items-start sm:text-left"
          />
        </div>

        <div className="grid grid-cols-1 gap-10 sm:gap-16">
          {columnas.map((columna) => (
            <div key={columna.titulo}>
              <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {columna.titulo}
              </p>
              <ul className="space-y-2.5">
                {columna.enlaces.map((enlace) => (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      className="rounded text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {enlace.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        © {ANIO} {nombreComunidad}. Todos los derechos reservados.
      </p>
    </footer>
  );
}
