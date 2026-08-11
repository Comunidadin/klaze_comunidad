"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, RotateCcw, Save } from "lucide-react";
import { usePlantillas } from "@/lib/hooks/use-plantillas";
import {
  DESCRIPCIONES,
  ETIQUETAS,
  PLANTILLAS_POR_DEFECTO,
  TIPOS,
  bloqueAcceso,
  bloqueRecuperacion,
  componerCorreo,
  type Plantilla,
  type TipoPlantilla,
} from "@/lib/plantillas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

/**
 * «Correos a tus alumnos»: el editor de las tres plantillas.
 *
 * Lo que se ve aquí es lo que le llega a un alumno, no una aproximación: la
 * vista previa usa exactamente `componerCorreo`, el mismo que corre en el
 * servidor. Un editor cuyo preview se pinta aparte acaba mintiendo el día que
 * uno de los dos cambia.
 *
 * El **bloque de acceso** se enseña debajo, apagado y sin poder tocarlo. Tenía
 * que verse: quien no sepa que las credenciales se añaden solas las escribirá
 * otra vez, y quien no lo sepa al revés mandará una bienvenida sin forma de
 * entrar.
 */

/** Valores de ejemplo para la vista previa. Ninguna consulta: son de mentira. */
function ejemplo(academia: string) {
  return { academia, correo: "alumno@ejemplo.com", nombre: "María" };
}

function bloqueDeMuestra(tipo: TipoPlantilla, origen: string, slug: string): string {
  if (tipo === "bienvenida") {
    return bloqueAcceso({
      loginUrl: `${origen}/login/${slug}`,
      correo: "alumno@ejemplo.com",
      password: "Klaze-a1b2c3d4e5",
    });
  }
  if (tipo === "recuperacion") {
    return bloqueRecuperacion("#");
  }
  return "";
}

interface EditorProps {
  tipo: TipoPlantilla;
  academia: string;
  slug: string;
  guardada?: Plantilla;
  onGuardar: (tipo: TipoPlantilla, p: Plantilla) => Promise<void>;
  onRestaurar: (tipo: TipoPlantilla) => Promise<void>;
}

function EditorPlantilla({
  tipo,
  academia,
  slug,
  guardada,
  onGuardar,
  onRestaurar,
}: EditorProps) {
  const porDefecto = PLANTILLAS_POR_DEFECTO[tipo];
  const [asunto, setAsunto] = useState(guardada?.asunto ?? porDefecto.asunto);
  const [cuerpo, setCuerpo] = useState(guardada?.cuerpo ?? porDefecto.cuerpo);
  const [ocupado, setOcupado] = useState(false);
  // `window` no existe al renderizar en el servidor; en la vista previa da
  // igual el valor exacto, es un ejemplo.
  const origen = typeof window === "undefined" ? "" : window.location.origin;

  const sucio = asunto !== (guardada?.asunto ?? porDefecto.asunto) ||
    cuerpo !== (guardada?.cuerpo ?? porDefecto.cuerpo);

  const vista = componerCorreo(
    { asunto, cuerpo },
    ejemplo(academia),
    bloqueDeMuestra(tipo, origen, slug)
  );

  async function guardar() {
    if (!asunto.trim() || !cuerpo.trim()) {
      toast.error("El asunto y el texto no pueden quedar vacíos.");
      return;
    }
    setOcupado(true);
    try {
      await onGuardar(tipo, { asunto, cuerpo });
      toast.success("Correo guardado. Los próximos salen con este texto.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setOcupado(false);
    }
  }

  async function restaurar() {
    setOcupado(true);
    try {
      await onRestaurar(tipo);
      setAsunto(porDefecto.asunto);
      setCuerpo(porDefecto.cuerpo);
      toast.success("Volvió al texto original.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4 pt-1">
      <p className="text-xs text-muted-foreground">{DESCRIPCIONES[tipo].cuando}</p>

      <div className="space-y-1.5">
        <Label htmlFor={`asunto-${tipo}`}>Asunto</Label>
        <Input
          id={`asunto-${tipo}`}
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`cuerpo-${tipo}`}>Texto</Label>
        <Textarea
          id={`cuerpo-${tipo}`}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          className="min-h-40"
        />
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs text-muted-foreground">Puedes usar:</span>
          {ETIQUETAS.map((etiqueta) => (
            <button
              key={etiqueta}
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(etiqueta);
                toast.success(`${etiqueta} copiado`);
              }}
              className="cursor-pointer rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-accent"
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Escribe como en un correo normal: un renglón en blanco separa
          párrafos. No hace falta HTML.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Así le llega</Label>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Asunto: </span>
            <span className="font-medium text-foreground">{vista.asunto}</span>
          </div>
          <div
            className="space-y-2 px-3 py-3 text-sm break-words text-foreground [&_a]:text-primary [&_a]:underline"
            // El HTML lo arma `componerCorreo`, que escapa todo lo que viene de
            // un campo de texto. Lo único sin escapar es el bloque de Klaze,
            // que está aquí arriba en este mismo archivo.
            dangerouslySetInnerHTML={{ __html: vista.html }}
          />
        </div>
        {tipo !== "baja" && (
          <p className="text-xs text-muted-foreground">
            La parte de abajo —
            {tipo === "bienvenida" ? "los datos para entrar" : "el enlace"}— la
            añade Klaze y no se puede quitar. Si se pudiera, un descuido dejaría
            a tus alumnos con un correo sin forma de entrar.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void guardar()} disabled={ocupado || !sucio}>
          <Save /> Guardar
        </Button>
        {guardada && (
          <Button variant="outline" onClick={() => void restaurar()} disabled={ocupado}>
            <RotateCcw /> Volver al original
          </Button>
        )}
      </div>
    </div>
  );
}

export function CorreosDeLaAcademia({
  comunidadId,
  academia,
  slug,
}: {
  comunidadId: string;
  academia: string;
  slug: string;
}) {
  const { guardadas, cargando, guardar, restaurar } = usePlantillas(comunidadId);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" /> Correos a tus alumnos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Los tres correos que Klaze manda en tu nombre. Si no tocas ninguno,
          salen con un texto por defecto que ya nombra a {academia}.
        </p>
      </CardHeader>
      <CardContent>
        {cargando ? (
          <div className="space-y-2">
            {TIPOS.map((t) => (
              <Skeleton key={t} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {TIPOS.map((tipo) => (
              <AccordionItem key={tipo} value={tipo}>
                <AccordionTrigger className="cursor-pointer">
                  <span className="flex items-center gap-2">
                    {DESCRIPCIONES[tipo].titulo}
                    {guardadas[tipo] && (
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        Personalizado
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <EditorPlantilla
                    // Sin `key`, cambiar de plantilla dejaría el texto de la
                    // anterior en los campos: el estado vive dentro.
                    key={`${tipo}-${guardadas[tipo]?.cuerpo ?? "defecto"}`}
                    tipo={tipo}
                    academia={academia}
                    slug={slug}
                    guardada={guardadas[tipo]}
                    onGuardar={guardar}
                    onRestaurar={restaurar}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
