"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Search, ShieldOff, UserCheck } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { usePlatform, type ComunidadPlataforma } from "@/lib/hooks/use-platform";
import { useKlazeStore } from "@/lib/store";
import { PlanBadge, EstadoComunidadBadge } from "@/components/admin/community-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PendienteCambio {
  comunidad: ComunidadPlataforma;
  nuevoEstado: "activa" | "suspendida";
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function ComunidadesSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="mb-4 h-9 w-72 rounded-lg" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

/**
 * `/plataforma/comunidades`: directorio de todas las comunidades de Klaze
 * — buscador + suspender/activar (`cambiarEstadoComunidad`, con Dialog de
 * confirmación). Suspender bloquea de inmediato `/c/[slug]/*` a sus
 * miembros (ver `MemberShell`); reactivar restaura el acceso al instante.
 */
export default function PlataformaComunidadesPage() {
  const hydrated = useHydrated();
  const { comunidades } = usePlatform();
  const cambiarEstadoComunidad = useKlazeStore((s) => s.cambiarEstadoComunidad);

  const [busqueda, setBusqueda] = useState("");
  const [pendiente, setPendiente] = useState<PendienteCambio | null>(null);
  // Ver docstring del mismo patrón en /admin/alumnos: retiene el último
  // valor no nulo mientras el Dialog anima su cierre.
  const [mostrado, setMostrado] = useState<PendienteCambio | null>(null);
  if (pendiente && pendiente !== mostrado) {
    setMostrado(pendiente);
  }

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return comunidades;
    return comunidades.filter(
      (c) =>
        normalizar(c.community.nombre).includes(q) || normalizar(c.dueno.nombre).includes(q)
    );
  }, [comunidades, busqueda]);

  if (!hydrated) {
    return <ComunidadesSkeleton />;
  }

  function confirmarCambio() {
    if (!pendiente) return;
    cambiarEstadoComunidad(pendiente.comunidad.community.id, pendiente.nuevoEstado);
    toast.success(
      pendiente.nuevoEstado === "suspendida"
        ? `Suspendiste ${pendiente.comunidad.community.nombre}.`
        : `Reactivaste ${pendiente.comunidad.community.nombre}.`
    );
    setPendiente(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Comunidades
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {comunidades.length} {comunidades.length === 1 ? "comunidad" : "comunidades"} en
            total.
          </p>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por comunidad o dueño…"
            className="pl-8"
            aria-label="Buscar comunidad"
          />
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icono={Building2}
          titulo="Sin resultados"
          descripcion="Ninguna comunidad coincide con esa búsqueda."
        />
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comunidad</TableHead>
                <TableHead>Dueño</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Miembros</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((c) => (
                <TableRow key={c.community.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- logo mock (dicebear) sin dominio configurado en next/image */}
                      <img
                        src={c.community.logoUrl}
                        alt=""
                        className="size-8 shrink-0 rounded-md border border-border object-cover"
                      />
                      <span className="font-medium text-foreground">{c.community.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.dueno.nombre}</TableCell>
                  <TableCell>
                    <PlanBadge plan={c.plan} />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {c.miembros}
                  </TableCell>
                  <TableCell>
                    <EstadoComunidadBadge estado={c.community.estado} />
                  </TableCell>
                  <TableCell className="text-right">
                    {c.community.estado === "activa" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendiente({ comunidad: c, nuevoEstado: "suspendida" })}
                      >
                        <ShieldOff className="size-3.5" /> Suspender
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendiente({ comunidad: c, nuevoEstado: "activa" })}
                      >
                        <UserCheck className="size-3.5" /> Activar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!pendiente} onOpenChange={(open) => !open && setPendiente(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mostrado?.nuevoEstado === "suspendida"
                ? "¿Suspender esta comunidad?"
                : "¿Activar esta comunidad?"}
            </DialogTitle>
            <DialogDescription>
              {mostrado?.nuevoEstado === "suspendida"
                ? `Los miembros de ${mostrado?.comunidad.community.nombre} verán una pantalla de suspensión y perderán acceso al área de miembros hasta que la reactives. El equipo de administración (${mostrado?.comunidad.dueno.nombre}) puede seguir usando su panel de creador.`
                : `${mostrado?.comunidad.community.nombre} recupera acceso normal de inmediato para todos sus miembros.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendiente(null)}>
              Cancelar
            </Button>
            <Button
              variant={mostrado?.nuevoEstado === "suspendida" ? "destructive" : "default"}
              onClick={confirmarCambio}
            >
              {mostrado?.nuevoEstado === "suspendida" ? "Sí, suspender" : "Sí, activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
