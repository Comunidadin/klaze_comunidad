"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Search, ShieldOff, UserCheck } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { usePlatform, type AcademiaPlataforma } from "@/lib/hooks/use-platform";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cambiarEstadoComunidad } from "@/lib/supabase/plataforma";
import { PlanBadge, EstadoComunidadBadge } from "@/components/admin/community-badges";
import { AltaAcademiaDialog } from "@/components/admin/alta-academia-dialog";
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
  academia: AcademiaPlataforma;
  nuevoEstado: "activa" | "suspendida";
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function AcademiasSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="mb-4 h-9 w-72 rounded-lg" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

/**
 * `/plataforma/comunidades`: directorio de todas las academias, con buscador,
 * alta y suspender/reactivar.
 *
 * Suspender revoca acceso **real** desde la rebanada 4: ni los alumnos ni el
 * propio creador entran mientras lo esté. Antes solo cambiaba una insignia, y
 * el texto de este diálogo lo prometía así — decía que el creador podía seguir
 * usando su panel. Ya no es cierto, y el aviso tiene que decir lo que pasa.
 */
export default function PlataformaAcademiasPage() {
  const hydrated = useHydrated();
  const { academias, planes, cargando, recargar } = usePlatform();

  const [busqueda, setBusqueda] = useState("");
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [pendiente, setPendiente] = useState<PendienteCambio | null>(null);
  // Ver docstring del mismo patrón en /admin/alumnos: retiene el último
  // valor no nulo mientras el Dialog anima su cierre.
  const [mostrado, setMostrado] = useState<PendienteCambio | null>(null);
  if (pendiente && pendiente !== mostrado) {
    setMostrado(pendiente);
  }

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return academias;
    return academias.filter(
      (a) =>
        normalizar(a.comunidad.nombre).includes(q) ||
        normalizar(a.dueno.nombre).includes(q) ||
        normalizar(a.dueno.email).includes(q)
    );
  }, [academias, busqueda]);

  if (!hydrated || cargando) {
    return <AcademiasSkeleton />;
  }

  async function confirmarCambio() {
    if (!pendiente) return;
    const { academia, nuevoEstado } = pendiente;
    try {
      await cambiarEstadoComunidad(
        crearClienteNavegador(),
        academia.comunidad.id,
        nuevoEstado
      );
      await recargar();
      toast.success(
        nuevoEstado === "suspendida"
          ? `${academia.comunidad.nombre} queda suspendida: ni su creador ni sus alumnos podrán entrar.`
          : `${academia.comunidad.nombre} vuelve a estar activa.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setPendiente(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Academias
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {academias.length} {academias.length === 1 ? "academia" : "academias"} en
            total.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por academia, dueño o correo…"
              className="pl-8"
              aria-label="Buscar academia"
            />
          </div>
          <Button onClick={() => setAltaAbierta(true)}>
            <Plus /> Dar de alta
          </Button>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icono={Building2}
          titulo={busqueda ? "Sin resultados" : "Todavía no hay academias"}
          descripcion={
            busqueda
              ? "Ninguna academia coincide con esa búsqueda."
              : "Da de alta la primera con el botón de arriba."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Academia</TableHead>
                <TableHead>Dueño</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Miembros</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((a) => (
                <TableRow key={a.comunidad.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {a.comunidad.nombre}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      /c/{a.comunidad.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground">{a.dueno.nombre}</span>
                    <span className="block text-xs text-muted-foreground">
                      {a.dueno.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PlanBadge plan={a.plan} />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {a.miembros}
                  </TableCell>
                  <TableCell>
                    <EstadoComunidadBadge estado={a.comunidad.estado} />
                  </TableCell>
                  <TableCell className="text-right">
                    {a.comunidad.estado === "activa" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPendiente({ academia: a, nuevoEstado: "suspendida" })
                        }
                      >
                        <ShieldOff className="size-3.5" /> Suspender
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPendiente({ academia: a, nuevoEstado: "activa" })
                        }
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
                ? "¿Suspender esta academia?"
                : "¿Activar esta academia?"}
            </DialogTitle>
            <DialogDescription>
              {mostrado?.nuevoEstado === "suspendida"
                ? `Se cierra el acceso a ${mostrado?.academia.comunidad.nombre} por completo: sus ${mostrado?.academia.miembros} miembros y también ${mostrado?.academia.dueno.nombre}, su creador, dejarán de entrar hasta que la reactives. Nada se borra, y tú puedes revertirlo cuando quieras.`
                : `${mostrado?.academia.comunidad.nombre} recupera el acceso de inmediato, para su creador y para todos sus miembros.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendiente(null)}>
              Cancelar
            </Button>
            <Button
              variant={mostrado?.nuevoEstado === "suspendida" ? "destructive" : "default"}
              onClick={() => void confirmarCambio()}
            >
              {mostrado?.nuevoEstado === "suspendida" ? "Sí, suspender" : "Sí, activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AltaAcademiaDialog
        abierto={altaAbierta}
        onCerrar={() => setAltaAbierta(false)}
        planes={planes}
        onCreada={recargar}
      />
    </div>
  );
}
