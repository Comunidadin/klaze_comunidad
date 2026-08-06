"use client";

import { Building2, GraduationCap, Users } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { usePlatform } from "@/lib/hooks/use-platform";
import { formatFechaLarga } from "@/lib/format-fecha";
import { StatCard } from "@/components/admin/stat-card";
import { PlanBadge, EstadoComunidadBadge } from "@/components/admin/community-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DashboardSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-xl" />
    </div>
  );
}

/**
 * `/plataforma`: panel del superadmin — tres cuentas reales y las academias
 * más recientes. Toda la data sale de `usePlatform` (única puerta, ver el
 * docstring del hook).
 *
 * Tenía además un MRR y un gráfico de crecimiento, los dos inventados. Se
 * quitaron al pasar el panel a datos reales: nadie cobra todavía, y un número
 * falso en un panel de control acaba creyéndose.
 */
export default function PlataformaDashboardPage() {
  const hydrated = useHydrated();
  const { academias, metricas, cargando } = usePlatform();

  if (!hydrated || cargando) {
    return <DashboardSkeleton />;
  }

  const recientes = [...academias]
    .sort(
      (a, b) =>
        new Date(b.comunidad.creadoEl).getTime() -
        new Date(a.comunidad.creadoEl).getTime()
    )
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Panel de plataforma
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cómo va Klaze en conjunto — academias, creadores y alumnos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          titulo="Academias activas"
          valor={metricas.academiasActivas}
          icono={Building2}
        />
        <StatCard titulo="Creadores" valor={metricas.creadores} icono={Users} />
        <StatCard
          titulo="Alumnos"
          valor={metricas.alumnos}
          icono={GraduationCap}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Academias recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recientes.length === 0 ? (
            <EmptyState
              icono={Building2}
              titulo="Todavía no hay academias"
              descripcion="Da de alta la primera desde Academias."
              className="border-none bg-transparent py-10"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Academia</TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Miembros</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recientes.map(({ comunidad, dueno, plan, miembros }) => (
                  <TableRow key={comunidad.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {comunidad.nombre}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dueno.nombre}
                    </TableCell>
                    <TableCell>
                      <PlanBadge plan={plan} />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {miembros}
                    </TableCell>
                    <TableCell>
                      <EstadoComunidadBadge estado={comunidad.estado} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFechaLarga(comunidad.creadoEl)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
