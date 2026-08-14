"use client";

import { useState } from "react";
import { Share, SquarePlus, Smartphone, X } from "lucide-react";
import { useInstalarPwa } from "@/lib/hooks/use-instalar-pwa";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * El aviso de «Instala la app»: una franja sobre la barra inferior del móvil.
 *
 * Existe porque «Añadir a pantalla de inicio» vive enterrado en el menú del
 * navegador y nadie lo encuentra solo. En Android, el botón dispara el
 * diálogo nativo de instalación; en iPhone —donde Apple no da botón— abre
 * los dos pasos con dibujos. Descartable por academia, y no aparece si la
 * app ya está instalada.
 */
export function InstalarApp({
  comunidadId,
  nombreAcademia,
}: {
  comunidadId: string;
  nombreAcademia: string;
}) {
  const { puedeInstalar, esIOS, instalar } = useInstalarPwa();
  const oculto = useAppStore((s) => s.instalarAppOculto[comunidadId] ?? false);
  const ocultarInstalarApp = useAppStore((s) => s.ocultarInstalarApp);
  const [pasosIOS, setPasosIOS] = useState(false);

  if (oculto || (!puedeInstalar && !esIOS)) return null;

  async function handleInstalar() {
    if (puedeInstalar) {
      const acepto = await instalar();
      if (acepto) ocultarInstalarApp(comunidadId);
      return;
    }
    setPasosIOS(true);
  }

  return (
    <>
      {/* Sobre la barra de pestañas del móvil; en escritorio no hace falta
          invitar — el navegador ya enseña su icono de instalar en la barra. */}
      <div className="fixed inset-x-0 bottom-14 z-40 mb-[env(safe-area-inset-bottom)] flex items-center gap-3 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur supports-backdrop-filter:bg-card/85 md:hidden">
        <Smartphone className="size-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-xs text-pretty text-foreground">
          Instala <span className="font-semibold">{nombreAcademia}</span> en tu
          teléfono — acceso directo, pantalla completa.
        </p>
        <Button size="sm" onClick={() => void handleInstalar()}>
          Instalar
        </Button>
        <button
          type="button"
          onClick={() => ocultarInstalarApp(comunidadId)}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label="Descartar el aviso de instalación"
        >
          <X className="size-4" />
        </button>
      </div>

      <Dialog open={pasosIOS} onOpenChange={setPasosIOS}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Instala {nombreAcademia}</DialogTitle>
            <DialogDescription>
              En iPhone se hace desde Safari, en dos toques:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            <li className="flex items-center gap-3 text-sm text-foreground">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Share className="size-4.5 text-primary" />
              </span>
              <span>
                Toca <span className="font-semibold">Compartir</span> (el
                cuadrado con la flecha, abajo en Safari).
              </span>
            </li>
            <li className="flex items-center gap-3 text-sm text-foreground">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <SquarePlus className="size-4.5 text-primary" />
              </span>
              <span>
                Elige{" "}
                <span className="font-semibold">Añadir a pantalla de inicio</span>{" "}
                y confirma.
              </span>
            </li>
          </ol>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setPasosIOS(false);
                ocultarInstalarApp(comunidadId);
              }}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
