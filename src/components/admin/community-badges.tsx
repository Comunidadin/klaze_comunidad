import { Badge } from "@/components/ui/badge";
import type { Community, Plan } from "@/lib/types";

/**
 * Badge de plan reutilizado por las 3 páginas de `/plataforma` que muestran
 * el plan de una comunidad (dashboard, comunidades, creadores — indirecto).
 * El color se deriva de `plan.id` (identidad estable) y no de `plan.nombre`
 * ni `plan.destacado`: el nombre se puede re-etiquetar sin romper el color,
 * y el destacado del catálogo (`/plataforma/planes`) es una propiedad
 * distinta de "qué plan tiene esta comunidad".
 */
export function PlanBadge({ plan }: { plan: Plan }) {
  if (plan.id === "pro") {
    return <Badge className="border-transparent bg-primary/15 text-primary">{plan.nombre}</Badge>;
  }
  if (plan.id === "scale") {
    return <Badge className="border-transparent bg-brand/15 text-brand">{plan.nombre}</Badge>;
  }
  return <Badge variant="secondary">{plan.nombre}</Badge>;
}

/** Badge de estado de comunidad — reutilizado por dashboard y `/plataforma/comunidades`. */
export function EstadoComunidadBadge({ estado }: { estado: Community["estado"] }) {
  if (estado === "activa") {
    return <Badge className="border-transparent bg-brand/15 text-brand">Activa</Badge>;
  }
  return <Badge variant="destructive">Suspendida</Badge>;
}
