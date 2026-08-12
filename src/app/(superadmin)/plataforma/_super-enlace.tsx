"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Link2, RefreshCw, Trash2, Zap } from "lucide-react";
import { useCanalesPlataforma } from "@/lib/hooks/use-canales-venta";
import { TOPE_DIARIO } from "@/lib/limites";
import type { CanalVenta } from "@/lib/supabase/canales-venta";
import type { Plan } from "@/lib/types";
import {
  Direccion,
  Recepciones,
  useOrigen,
} from "@/components/admin/enlace-compra";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * El súper enlace: vender Klaze sin estar delante.
 *
 * Es el mismo mecanismo que cada creador usa con sus alumnos, un nivel más
 * arriba. Quien compra recibe su academia montada, su cuenta de creador y su
 * dirección de acceso — sin que nadie entre aquí a crearla.
 *
 * Un enlace por plan, que es la misma idea de siempre: **la URL es el
 * producto**. El formulario no manda qué plan compró; lo sabe la dirección a la
 * que escribe.
 */
function SuperEnlace({
  canal,
  planes,
  origen,
  onCambiarEstado,
  onRegenerar,
  onBorrar,
}: {
  canal: CanalVenta;
  planes: Plan[];
  origen: string;
  onCambiarEstado: (activo: boolean) => void;
  onRegenerar: () => void;
  onBorrar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const plan = planes.find((p) => p.id === canal.planId);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{canal.nombre}</p>
          <p className="text-xs text-muted-foreground">
            Da de alta una academia en el plan {plan?.nombre ?? canal.planId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {canal.activo ? "Activo" : "Apagado"}
          </span>
          <Switch checked={canal.activo} onCheckedChange={onCambiarEstado} />
        </div>
      </div>

      {canal.activo ? (
        <div className="mt-4 space-y-3">
          <Direccion
            titulo="Cuando alguien compra Klaze"
            descripcion="Crea su academia y le manda su acceso de creador."
            url={`${origen}/api/plataforma/${canal.token}`}
          />
          <Direccion
            titulo="Cuando deja de pagar"
            descripcion="Suspende su academia. No se borra nada, y al volver a pagar se reactiva."
            url={`${origen}/api/plataforma/${canal.token}/baja`}
          />
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Apagado: las dos direcciones responden como si no existieran.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setAbierto(!abierto)}>
          {abierto ? <ChevronDown /> : <ChevronRight />}
          Últimas altas
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerar}>
          <RefreshCw />
          Cambiar la dirección
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onBorrar}
        >
          <Trash2 />
          Eliminar
        </Button>
      </div>

      {abierto && (
        <div className="mt-3 border-t border-border pt-3">
          <Recepciones
            canalId={canal.id}
            vacio="Todavía no ha comprado nadie por este enlace. Cada intento aparecerá aquí, también los que fallen."
          />
        </div>
      )}
    </div>
  );
}

export function SuperEnlaces({ planes }: { planes: Plan[] }) {
  const { canales, cargando, crear, cambiarEstado, regenerar, borrar } =
    useCanalesPlataforma();
  const origen = useOrigen();

  const [nombre, setNombre] = useState("");
  const [planId, setPlanId] = useState("");
  const [creando, setCreando] = useState(false);

  const puedeCrear = nombre.trim().length > 0 && planId.length > 0;

  async function handleCrear() {
    if (!puedeCrear || creando) return;
    setCreando(true);
    try {
      await crear(nombre, planId);
      setNombre("");
      setPlanId("");
      toast.success("Enlace creado. Pégalo en tu página de ventas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el enlace");
    } finally {
      setCreando(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Vender Klaze</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Un enlace por plan. Cuando alguien te compra, tu formulario escribe a
          esa dirección y la academia se monta sola: cuenta de creador,
          comunidad y su dirección de acceso. Recibe todo por correo y puede
          empezar a subir clases sin que tú entres aquí.
        </p>

        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">
            Quien tenga este enlace puede crear academias.
          </strong>{" "}
          Es el más delicado de la plataforma: trátalo como una contraseña y
          pégalo solo en tu herramienta de ventas. Admite{" "}
          <strong className="text-foreground">
            {TOPE_DIARIO.plataforma} altas al día
          </strong>
          , para que un enlace filtrado no te llene la plataforma antes de que
          lo veas. Si crees que se ha escapado, usa «Regenerar»: el anterior
          deja de servir al instante y conservas el historial de este.
        </p>

        <Separator />

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre-super">Nombre del enlace</Label>
              <Input
                id="nombre-super"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Plan Pro — pago anual"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-super">Plan que da</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger id="plan-super">
                  <SelectValue placeholder="Elige un plan" />
                </SelectTrigger>
                <SelectContent>
                  {planes.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCrear} disabled={!puedeCrear || creando}>
            <Zap /> Crear enlace
          </Button>
        </div>

        <Separator />

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando enlaces…</p>
        ) : canales.length === 0 ? (
          <EmptyState
            icono={Link2}
            titulo="Todavía no vendes Klaze en automático"
            descripcion="Crea un enlace por plan y pégalo en tu página de ventas."
            className="border-none bg-transparent py-10"
          />
        ) : (
          <div className="space-y-3">
            {canales.map((canal) => (
              <SuperEnlace
                key={canal.id}
                canal={canal}
                planes={planes}
                origen={origen}
                onCambiarEstado={async (activo) => {
                  try {
                    await cambiarEstado(canal.id, activo);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "No se pudo cambiar");
                  }
                }}
                onRegenerar={async () => {
                  if (
                    !confirm(
                      "La dirección actual dejará de funcionar al instante. " +
                        "Tendrás que pegar la nueva en tu página de ventas. ¿Seguimos?"
                    )
                  ) {
                    return;
                  }
                  try {
                    await regenerar(canal.id);
                    toast.success("Dirección cambiada.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "No se pudo regenerar");
                  }
                }}
                onBorrar={async () => {
                  if (
                    !confirm(
                      `Se elimina "${canal.nombre}" y su historial. ` +
                        "Las academias creadas por él siguen igual. ¿Seguimos?"
                    )
                  ) {
                    return;
                  }
                  try {
                    await borrar(canal.id);
                    toast.success("Enlace eliminado");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
                  }
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
