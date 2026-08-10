"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { useCanalesVenta } from "@/lib/hooks/use-canales-venta";
import type { CanalVenta } from "@/lib/supabase/canales-venta";
import { Direccion, Recepciones, useOrigen } from "@/components/admin/enlace-compra";
import { resumenCursosInvitacion } from "@/lib/invitation-summary";
import type { Course } from "@/lib/types";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

/**
 * Enlaces de compra: las direcciones a las que escribe el formulario de venta
 * para que el alumno entre solo.
 *
 * Un enlace es una oferta. Los módulos que incluye los guarda el enlace, así
 * que el formulario no tiene que mandar ningún identificador de producto —
 * **la dirección a la que escribe ya lo sabe**. Es lo único que toda
 * herramienta sabe hacer, y por eso funciona con cualquiera.
 */

function Enlace({
  canal,
  cursos,
  origen,
  onCambiarEstado,
  onRegenerar,
  onBorrar,
}: {
  canal: CanalVenta;
  cursos: Course[];
  origen: string;
  onCambiarEstado: (activo: boolean) => void;
  onRegenerar: () => void;
  onBorrar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{canal.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {resumenCursosInvitacion(canal.cursoIds, cursos)}
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
            titulo="Cuando alguien compra"
            descripcion="Pega esta dirección en tu formulario o automatización."
            url={`${origen}/api/compras/${canal.token}`}
          />
          <Direccion
            titulo="Cuando hay reembolso o baja"
            descripcion="Suspende el acceso de ese correo, sin borrar su progreso."
            url={`${origen}/api/compras/${canal.token}/baja`}
          />
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Apagado: las dos direcciones responden como si no existieran. Nadie
          entra por aquí hasta que lo vuelvas a encender.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setAbierto(!abierto)}>
          {abierto ? <ChevronDown /> : <ChevronRight />}
          Últimos envíos
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
            vacio="Todavía no ha llegado nada a este enlace. Cuando tu formulario escriba aquí, cada envío aparecerá en esta lista — también los que fallen."
          />
        </div>
      )}
    </div>
  );
}

export function VentasAutomaticas({
  comunidadId,
  cursos,
}: {
  comunidadId: string;
  cursos: Course[];
}) {
  const { canales, cargando, crear, cambiarEstado, regenerar, borrar } =
    useCanalesVenta(comunidadId);

  const [nombre, setNombre] = useState("");
  const [cursoIds, setCursoIds] = useState<string[]>([]);
  const [todaLaComunidad, setTodaLaComunidad] = useState(false);
  const [creando, setCreando] = useState(false);

  const origen = useOrigen();

  const puedeCrear =
    nombre.trim().length > 0 && (todaLaComunidad || cursoIds.length > 0);

  async function handleCrear() {
    if (!puedeCrear || creando) return;
    setCreando(true);
    try {
      await crear(nombre, todaLaComunidad ? "todos" : cursoIds);
      setNombre("");
      setCursoIds([]);
      setTodaLaComunidad(false);
      toast.success("Enlace creado. Cópialo y pégalo en tu formulario.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el enlace");
    } finally {
      setCreando(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Ventas automáticas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Un enlace por oferta. Cuando alguien compra, tu formulario escribe a
          esa dirección y Klaze le crea la cuenta y le manda su acceso — sin que
          tengas que entrar aquí. Los módulos que incluye los decide el enlace,
          así que tu formulario no tiene que mandar nada más que el correo.
        </p>

        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">
            Quien tenga el enlace puede dar acceso.
          </strong>{" "}
          Trátalo como una contraseña: pégalo solo en tu herramienta de ventas.
          Si crees que se ha filtrado, usa &quot;Cambiar la dirección&quot; — la
          anterior deja de funcionar al instante.
        </p>

        <Separator />

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-enlace">Nombre del enlace</Label>
            <Input
              id="nombre-enlace"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Mentoría V7.0 — pago único"
            />
            <p className="text-xs text-muted-foreground">
              Solo lo ves tú. Sirve para saber cuál es cuál cuando tengas varios.
            </p>
          </div>

          <div className="space-y-2.5">
            <Label>¿A qué da acceso?</Label>

            <label className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm has-aria-checked:border-primary/40 has-aria-checked:bg-primary/5">
              <Checkbox
                checked={todaLaComunidad}
                onCheckedChange={(v) => {
                  setTodaLaComunidad(v === true);
                  if (v === true) setCursoIds([]);
                }}
              />
              <span className="font-medium text-foreground">Toda la comunidad</span>
              <span className="text-muted-foreground">
                — todos los módulos, presentes y futuros
              </span>
            </label>

            {cursos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavía no tienes módulos individuales — por ahora solo puedes
                crear un enlace a &quot;Toda la comunidad&quot;.
              </p>
            ) : (
              <div
                className={
                  "grid grid-cols-1 gap-2 sm:grid-cols-2" +
                  (todaLaComunidad ? " pointer-events-none opacity-50" : "")
                }
              >
                {cursos.map((curso) => (
                  <label
                    key={curso.id}
                    className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm has-aria-checked:border-primary/40 has-aria-checked:bg-primary/5"
                  >
                    <Checkbox
                      checked={cursoIds.includes(curso.id)}
                      disabled={todaLaComunidad}
                      onCheckedChange={(v) =>
                        setCursoIds((prev) =>
                          v === true
                            ? [...prev, curso.id]
                            : prev.filter((id) => id !== curso.id)
                        )
                      }
                    />
                    <span className="truncate text-foreground">{curso.titulo}</span>
                  </label>
                ))}
              </div>
            )}
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
            titulo="Todavía no tienes enlaces de compra"
            descripcion="Crea uno arriba y pégalo en tu formulario de ventas."
            className="border-none bg-transparent py-10"
          />
        ) : (
          <div className="space-y-3">
            {canales.map((canal) => (
              <Enlace
                key={canal.id}
                canal={canal}
                cursos={cursos}
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
                        "Tendrás que pegar la nueva en tu formulario. ¿Seguimos?"
                    )
                  ) {
                    return;
                  }
                  try {
                    await regenerar(canal.id);
                    toast.success("Dirección cambiada. Pega la nueva en tu formulario.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "No se pudo regenerar");
                  }
                }}
                onBorrar={async () => {
                  if (
                    !confirm(
                      `Se elimina "${canal.nombre}" y su historial de envíos. ` +
                        "Quien ya entró conserva su acceso. ¿Seguimos?"
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
