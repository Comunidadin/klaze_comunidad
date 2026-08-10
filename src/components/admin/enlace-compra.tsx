"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { useRecepciones } from "@/lib/hooks/use-canales-venta";
import { formatFechaLarga } from "@/lib/format-fecha";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Las piezas que comparten los dos niveles de enlace de compra: el que da
 * acceso a un alumno (`/admin/accesos`) y el que da de alta una academia
 * entera (`/plataforma`).
 *
 * Viven aquí y no duplicadas porque son exactamente lo mismo con otro texto —
 * una dirección que se copia, y el registro de lo que ha llegado por ella.
 */

/** Cómo se lee cada resultado del registro, y de qué color se pinta. */
export const RESULTADOS: Record<
  string,
  { texto: string; tono: "ok" | "aviso" | "malo" }
> = {
  creado: { texto: "Cuenta creada", tono: "ok" },
  ya_tenia: { texto: "Ya tenía cuenta", tono: "ok" },
  suspendido: { texto: "Acceso suspendido", tono: "aviso" },
  sin_email: { texto: "Sin correo en el envío", tono: "malo" },
  sin_cuenta: { texto: "No tenía acceso aquí", tono: "aviso" },
  rechazado: { texto: "Rechazado", tono: "malo" },
  academia_creada: { texto: "Academia creada", tono: "ok" },
  academia_reactivada: { texto: "Academia reactivada", tono: "ok" },
  academia_suspendida: { texto: "Academia suspendida", tono: "aviso" },
};

export function BotonCopiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1600);
        } catch {
          toast.error("Tu navegador no dejó copiar. Selecciona la dirección a mano.");
        }
      }}
    >
      {copiado ? <Check /> : <Copy />}
      {etiqueta}
    </Button>
  );
}

export function Direccion({
  titulo,
  descripcion,
  url,
}: {
  titulo: string;
  descripcion: string;
  url: string;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
          {url}
        </code>
        <BotonCopiar texto={url} etiqueta="Copiar" />
      </div>
    </div>
  );
}

export function Recepciones({ canalId, vacio }: { canalId: string; vacio: string }) {
  const { recepciones, cargando } = useRecepciones(canalId);

  if (cargando) {
    return <p className="text-xs text-muted-foreground">Cargando…</p>;
  }

  if (recepciones.length === 0) {
    return <p className="text-xs text-muted-foreground">{vacio}</p>;
  }

  return (
    <ul className="space-y-2">
      {recepciones.map((r) => {
        const info = RESULTADOS[r.resultado] ?? {
          texto: r.resultado,
          tono: "aviso" as const,
        };
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-muted-foreground">{formatFechaLarga(r.recibidaEl)}</span>
            <span className="font-medium text-foreground">{r.email ?? "sin correo"}</span>
            <Badge
              variant={info.tono === "ok" ? "secondary" : "outline"}
              className={
                info.tono === "malo" ? "border-destructive/40 text-destructive" : ""
              }
            >
              {r.accion === "baja" ? "Baja · " : ""}
              {info.texto}
            </Badge>
            {r.detalle && <span className="text-muted-foreground">{r.detalle}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * La dirección real donde vive la app.
 *
 * `window` no existe al renderizar en el servidor, y leerlo en el valor inicial
 * daría una discrepancia de hidratación: el servidor pintaría vacío y el
 * navegador el dominio. El `.then()` tampoco es adorno — fijar el estado de
 * forma síncrona dentro de un efecto dispara renders en cascada.
 */
export function useOrigen(): string {
  const [origen, setOrigen] = useState("");
  useEffect(() => {
    void Promise.resolve(window.location.origin).then(setOrigen);
  }, []);
  return origen;
}
