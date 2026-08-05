"use client";

import Link from "next/link";
import {
  BookOpen,
  KeyRound,
  Mail,
  MessagesSquare,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useAhora } from "@/lib/hooks/use-ahora";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useMembers } from "@/lib/hooks/use-members";
import { useCourses } from "@/lib/hooks/use-courses";
import { useFeed } from "@/lib/hooks/use-feed";
import { useInvitations } from "@/lib/hooks/use-invitations";
import { resumenCursosInvitacion } from "@/lib/invitation-summary";
import { formatFechaLarga } from "@/lib/format-fecha";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

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
    </div>
  );
}

/**
 * Dashboard de `/admin`: 4 métricas rápidas de la comunidad del creador +
 * las invitaciones más recientes + accesos directos a las secciones que más
 * se usan día a día (Accesos es la que abre el flujo estrella del producto).
 */
export default function AdminDashboardPage() {
  const hydrated = useHydrated();
  const ahora = useAhora();
  const community = useMyCommunity();

  const { miembros } = useMembers(community?.id ?? "");
  const { cursos } = useCourses(community?.id ?? "");
  const { posts } = useFeed(community?.id ?? "");
  const { invitaciones } = useInvitations(community?.id ?? "");

  if (!hydrated) {
    return <DashboardSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={Sparkles}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  const alumnosActivos = miembros.filter((m) => m.estado === "activo").length;
  const cursosPublicados = cursos.filter((c) => c.publicado).length;
  const postsEstaSemana = posts.filter(
    (p) => ahora - new Date(p.creadoEl).getTime() <= SIETE_DIAS_MS
  ).length;
  const invitacionesPendientes = invitaciones.filter((i) => i.estado === "pendiente").length;

  const ultimasInvitaciones = [...invitaciones]
    .sort((a, b) => new Date(b.creadaEl).getTime() - new Date(a.creadaEl).getTime())
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Hola, {community.nombre}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Así va tu comunidad hoy.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Alumnos activos" valor={alumnosActivos} icono={UserCheck} />
        <StatCard titulo="Cursos publicados" valor={cursosPublicados} icono={BookOpen} />
        <StatCard titulo="Posts esta semana" valor={postsEstaSemana} icono={MessagesSquare} />
        <StatCard
          titulo="Invitaciones pendientes"
          valor={invitacionesPendientes}
          icono={Mail}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos accesos otorgados</CardTitle>
          </CardHeader>
          <CardContent>
            {ultimasInvitaciones.length === 0 ? (
              <EmptyState
                icono={KeyRound}
                titulo="Aún no has invitado a nadie"
                descripcion="Da acceso a tus primeros alumnos por correo desde Accesos."
                accion={{ label: "Ir a Accesos", href: "/admin/accesos" }}
                className="border-none bg-transparent py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead>Cursos</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimasInvitaciones.map((inv) => (
                    <TableRow key={inv.token}>
                      <TableCell className="font-medium text-foreground">{inv.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {resumenCursosInvitacion(inv.cursoIds, cursos)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFechaLarga(inv.creadaEl)}
                      </TableCell>
                      <TableCell>
                        {inv.estado === "aceptada" ? (
                          <Badge className="bg-brand/15 text-brand">Aceptada</Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/accesos">
                <KeyRound /> Dar acceso a alumnos
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/cursos">
                <BookOpen /> Administrar cursos
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/comunidad">
                <MessagesSquare /> Ir a la comunidad
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
