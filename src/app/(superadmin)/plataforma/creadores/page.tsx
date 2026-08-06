"use client";

import { Users } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { usePlatform } from "@/lib/hooks/use-platform";
import { formatFechaLarga } from "@/lib/format-fecha";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CreadoresSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

/**
 * `/plataforma/creadores`: directorio de todos los creadores — cada fila
 * muestra sus academias como badges (una por creador hoy, pero el diseño
 * soporta varias). Sin edición: es un directorio de solo lectura, y las dos
 * acciones de negocio —dar de alta y suspender— viven en `/plataforma/comunidades`.
 */
export default function PlataformaCreadoresPage() {
  const hydrated = useHydrated();
  const { creadores, cargando } = usePlatform();

  if (!hydrated || cargando) {
    return <CreadoresSkeleton />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Creadores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {creadores.length}{" "}
          {creadores.length === 1 ? "creador registrado" : "creadores registrados"}.
        </p>
      </div>

      {creadores.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="Todavía no hay creadores"
          descripcion="Aparecerán aquí en cuanto des de alta la primera academia."
        />
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creador</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Academias</TableHead>
                <TableHead>Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creadores.map((creador) => (
                <TableRow key={creador.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarImage src={creador.avatarUrl} alt={creador.nombre} />
                        <AvatarFallback>{creador.nombre[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">
                        {creador.nombre}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {creador.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {creador.academias.map((a) => (
                        <Badge key={a.id} variant="secondary">
                          {a.nombre}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFechaLarga(creador.creadoEl)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
