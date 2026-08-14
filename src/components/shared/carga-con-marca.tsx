"use client";

import { useMarcaAuth } from "@/lib/hooks/use-marca-auth";
import { MarcaAcademia } from "@/components/shared/marca-academia";

/**
 * Pantalla de carga con la marca de la academia: logo, nombre y el spinner.
 *
 * Es lo que se ve durante la transición de entrar (`/callback`): antes era el
 * split azul de Klaze y desconcertaba — «¿a dónde me metí?». Sin `slug` (la
 * puerta genérica) queda solo el spinner, sin marca de nadie.
 */
export function CargaConMarca({ slug }: { slug?: string }) {
  const marca = useMarcaAuth(slug);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background">
      {marca.nombre && (
        <MarcaAcademia
          nombre={marca.nombre}
          logoUrl={marca.logoUrl}
          colorAcento={marca.colorAcento}
          orientacion="vertical"
        />
      )}
      <div
        className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        // El acento va inline: en plena carga, el `<style>` con la paleta de
        // la academia puede no estar montado aún y el token seguiría en cian.
        style={marca.colorAcento ? { borderTopColor: marca.colorAcento } : undefined}
        role="status"
        aria-label="Cargando"
      />
    </div>
  );
}
