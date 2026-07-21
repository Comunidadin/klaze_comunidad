"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Sparkles } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { usePlatform } from "@/lib/hooks/use-platform";
import { useKlazeStore } from "@/lib/store";
import { formatUSD } from "@/lib/format-moneda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/types";

function PlanesSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

interface CamposPlan {
  precioMes: string;
  comunidades: string;
  alumnos: string;
  cursos: string;
}

function camposDe(plan: Plan): CamposPlan {
  return {
    precioMes: String(plan.precioMes),
    comunidades: String(plan.limites.comunidades),
    alumnos: String(plan.limites.alumnos),
    cursos: String(plan.limites.cursos),
  };
}

/**
 * `>= 0` y no-NaN para el precio (un plan podría en teoría ser gratis);
 * `>= 1` y no-NaN para cada límite (un plan que permita 0 comunidades/
 * alumnos/cursos no tiene sentido de negocio). Devuelve el número parseado
 * o `null` si no pasa la validación — el llamador decide el mensaje.
 */
function numeroValido(valor: string, minimo: 0 | 1): number | null {
  if (valor.trim() === "") return null;
  const n = Number(valor);
  if (Number.isNaN(n) || n < minimo) return null;
  return Math.round(n);
}

function PlanCard({ plan }: { plan: Plan }) {
  const guardarPlan = useKlazeStore((s) => s.guardarPlan);
  const [campos, setCampos] = useState<CamposPlan>(camposDe(plan));

  function actualizar<K extends keyof CamposPlan>(campo: K, valor: string) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
  }

  function guardar() {
    const precioMes = numeroValido(campos.precioMes, 0);
    const comunidades = numeroValido(campos.comunidades, 1);
    const alumnos = numeroValido(campos.alumnos, 1);
    const cursos = numeroValido(campos.cursos, 1);

    if (precioMes === null || comunidades === null || alumnos === null || cursos === null) {
      toast.error("Revisa los números: no pueden estar vacíos, ser negativos ni menores a 1 en los límites.");
      return;
    }

    const actualizado: Plan = {
      ...plan,
      precioMes,
      limites: { comunidades, alumnos, cursos },
    };
    guardarPlan(actualizado);
    setCampos(camposDe(actualizado));
    toast.success(`Plan ${plan.nombre} actualizado.`);
  }

  return (
    <Card className={cn(plan.destacado && "ring-2 ring-primary")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-display text-lg">{plan.nombre}</CardTitle>
          {plan.destacado && (
            <Badge className="border-transparent bg-primary/15 text-primary">
              <Sparkles className="size-3" /> Recomendado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor={`${plan.id}-precio`}>Precio / mes (USD)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`${plan.id}-precio`}
              type="number"
              min={0}
              className="pl-6"
              value={campos.precioMes}
              onChange={(e) => actualizar("precioMes", e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Hoy: {formatUSD(plan.precioMes)}</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Límites</p>
          <div className="space-y-1.5">
            <Label htmlFor={`${plan.id}-comunidades`}>Comunidades</Label>
            <Input
              id={`${plan.id}-comunidades`}
              type="number"
              min={1}
              value={campos.comunidades}
              onChange={(e) => actualizar("comunidades", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${plan.id}-alumnos`}>Alumnos</Label>
            <Input
              id={`${plan.id}-alumnos`}
              type="number"
              min={1}
              value={campos.alumnos}
              onChange={(e) => actualizar("alumnos", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${plan.id}-cursos`}>Cursos</Label>
            <Input
              id={`${plan.id}-cursos`}
              type="number"
              min={1}
              value={campos.cursos}
              onChange={(e) => actualizar("cursos", e.target.value)}
            />
          </div>
        </div>

        <Button onClick={guardar} className="w-full">
          <Save /> Guardar plan
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * `/plataforma/planes`: catálogo editable de los 3 planes de Klaze — precio
 * mensual y límites (comunidades/alumnos/cursos) por tarjeta, cada una con
 * su propio botón "Guardar" (`guardarPlan`, ver validación en
 * `numeroValido`). El nombre del plan es fijo a propósito: es la identidad
 * visual (`PlanBadge` en el resto de `/plataforma`), así que no se edita
 * desde acá.
 */
export default function PlataformaPlanesPage() {
  const hydrated = useHydrated();
  const { planes } = usePlatform();

  if (!hydrated) {
    return <PlanesSkeleton />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Planes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Precio y límites de cada plan — los cambios aplican a las comunidades que lo usen.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {planes.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}
