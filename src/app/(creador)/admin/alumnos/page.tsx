"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Search, ShieldOff, UserCheck, Users } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useMembers, type MemberConEstado } from "@/lib/hooks/use-members";
import { useAppStore } from "@/lib/store";
import { formatFechaLarga } from "@/lib/format-fecha";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Enrollment } from "@/lib/types";

type FiltroEstado = "todos" | Enrollment["estado"];

interface PendienteCambio {
  miembro: MemberConEstado;
  nuevoEstado: "activo" | "suspendido";
}

const OPCIONES_ESTADO: { value: FiltroEstado; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "activo", label: "Activo" },
  { value: "invitado", label: "Invitado" },
  { value: "suspendido", label: "Suspendido" },
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function EstadoBadge({ estado }: { estado: Enrollment["estado"] }) {
  if (estado === "activo") {
    return <Badge className="border-transparent bg-brand/15 text-brand">Activo</Badge>;
  }
  if (estado === "suspendido") {
    return <Badge variant="destructive">Suspendido</Badge>;
  }
  return <Badge variant="secondary">Invitado</Badge>;
}

function AlumnosSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-44" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

/**
 * `/admin/alumnos`: directorio administrativo de la comunidad — buscador +
 * filtro por estado + acción de suspender/reactivar (`cambiarEstadoAlumno`).
 * El progreso promedio ya viene calculado por `useMembers` (no se recalcula
 * en el componente, ver docstring de ese hook).
 */
export default function AlumnosPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const { miembros } = useMembers(community?.id ?? "");
  const cambiarEstadoAlumno = useAppStore((s) => s.cambiarEstadoAlumno);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [pendiente, setPendiente] = useState<PendienteCambio | null>(null);

  // El diálogo de confirmación sigue montado ~100ms mientras se cierra
  // (animación de salida de Radix). En ese lapso `pendiente` ya es `null`
  // (lo limpia `confirmarCambio`), así que si el título/descripción leyeran
  // `pendiente` directamente, el ternario caería a la rama contraria y
  // parpadearía "¿Reactivar alumno? undefined recupera…" incluso al
  // suspender. `mostrado` retiene el último valor no nulo para que el
  // contenido no cambie durante el cierre — solo `open` se controla con
  // `pendiente`. Se actualiza durante el render (no en un efecto, para que
  // no haya ni un frame de desfase) siguiendo el patrón documentado de
  // React para "ajustar estado mientras se renderiza".
  const [mostrado, setMostrado] = useState<PendienteCambio | null>(null);
  if (pendiente && pendiente !== mostrado) {
    setMostrado(pendiente);
  }

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return miembros.filter((m) => {
      if (filtroEstado !== "todos" && m.estado !== filtroEstado) return false;
      if (!q) return true;
      return normalizar(m.nombre).includes(q) || normalizar(m.email).includes(q);
    });
  }, [miembros, busqueda, filtroEstado]);

  if (!hydrated) {
    return <AlumnosSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={Users}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  function confirmarCambio() {
    if (!pendiente || !community) return;
    cambiarEstadoAlumno(pendiente.miembro.id, community.id, pendiente.nuevoEstado);
    toast.success(
      pendiente.nuevoEstado === "suspendido"
        ? `Suspendiste a ${pendiente.miembro.nombre}.`
        : `Reactivaste a ${pendiente.miembro.nombre}.`
    );
    setPendiente(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Alumnos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {miembros.length} {miembros.length === 1 ? "persona" : "personas"} en {community.nombre}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              className="pl-8"
              aria-label="Buscar alumno"
            />
          </div>
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as FiltroEstado)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_ESTADO.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="Sin resultados"
          descripcion="Nadie coincide con esa búsqueda o filtro."
        />
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Ingresó</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((miembro) => (
                <TableRow key={miembro.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarImage src={miembro.avatarUrl} alt={miembro.nombre} />
                        <AvatarFallback>{miembro.nombre[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{miembro.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{miembro.email}</TableCell>
                  <TableCell>
                    <EstadoBadge estado={miembro.estado} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={miembro.progresoPromedio} className="h-1.5 w-20" />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {miembro.progresoPromedio}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFechaLarga(miembro.creadoEl)}
                  </TableCell>
                  <TableCell className="text-right">
                    {miembro.estado === "invitado" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Más acciones">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {miembro.estado === "activo" ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() =>
                                setPendiente({ miembro, nuevoEstado: "suspendido" })
                              }
                            >
                              <ShieldOff /> Suspender
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => setPendiente({ miembro, nuevoEstado: "activo" })}
                            >
                              <UserCheck /> Reactivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
              {mostrado?.nuevoEstado === "suspendido" ? "¿Suspender alumno?" : "¿Reactivar alumno?"}
            </DialogTitle>
            <DialogDescription>
              {mostrado?.nuevoEstado === "suspendido"
                ? `${mostrado?.miembro.nombre} perderá acceso a los cursos hasta que lo reactives.`
                : `${mostrado?.miembro.nombre} recupera el acceso a sus cursos de inmediato.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendiente(null)}>
              Cancelar
            </Button>
            <Button
              variant={mostrado?.nuevoEstado === "suspendido" ? "destructive" : "default"}
              onClick={confirmarCambio}
            >
              {mostrado?.nuevoEstado === "suspendido" ? "Sí, suspender" : "Sí, reactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
