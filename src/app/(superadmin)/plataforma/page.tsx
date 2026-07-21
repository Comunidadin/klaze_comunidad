"use client";

import { Building2, DollarSign, GraduationCap, Users } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { usePlatform } from "@/lib/hooks/use-platform";
import { formatUSD } from "@/lib/format-moneda";
import { formatFechaLarga } from "@/lib/format-fecha";
import { StatCard } from "@/components/admin/stat-card";
import { BarChart } from "@/components/admin/bar-chart";
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72 rounded-xl" />
      <Skeleton className="mt-6 h-64 rounded-xl" />
    </div>
  );
}

/**
 * `/plataforma`: dashboard del superadmin — 4 métricas globales de negocio
 * (comunidades activas, creadores, alumnos totales, MRR simulado),
 * crecimiento mensual mock y las comunidades más recientes. Toda la data
 * sale de `usePlatform` (única puerta — ver docstring del hook), nunca de
 * los mocks directamente.
 */
export default function PlataformaDashboardPage() {
  const hydrated = useHydrated();
  const { comunidades, metricas } = usePlatform();

  if (!hydrated) {
    return <DashboardSkeleton />;
  }

  const recientes = [...comunidades]
    .sort((a, b) => new Date(b.community.creadoEl).getTime() - new Date(a.community.creadoEl).getTime())
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Panel de plataforma
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cómo va Klaze en conjunto — comunidades, creadores e ingresos simulados.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          titulo="Comunidades activas"
          valor={metricas.comunidadesActivas}
          icono={Building2}
        />
        <StatCard titulo="Creadores" valor={metricas.creadores} icono={Users} />
        <StatCard
          titulo="Alumnos totales"
          valor={metricas.alumnosTotales}
          icono={GraduationCap}
        />
        <StatCard titulo="MRR simulado" valor={formatUSD(metricas.mrr)} icono={DollarSign} />
      </div>

      <BarChart
        data={metricas.crecimientoMensual}
        titulo="Crecimiento mensual"
        className="mt-6"
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Comunidades recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recientes.length === 0 ? (
            <EmptyState
              icono={Building2}
              titulo="Todavía no hay comunidades"
              descripcion="En cuanto un creador se registre, va a aparecer aquí."
              className="border-none bg-transparent py-10"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comunidad</TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Miembros</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recientes.map(({ community, dueno, plan, miembros }) => (
                  <TableRow key={community.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- logo mock (dicebear) sin dominio configurado en next/image */}
                        <img
                          src={community.logoUrl}
                          alt=""
                          className="size-7 shrink-0 rounded-md border border-border object-cover"
                        />
                        <span className="font-medium text-foreground">{community.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dueno.nombre}</TableCell>
                    <TableCell>
                      <PlanBadge plan={plan} />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {miembros}
                    </TableCell>
                    <TableCell>
                      <EstadoComunidadBadge estado={community.estado} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFechaLarga(community.creadoEl)}
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
