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
 * `/plataforma/creadores`: directorio de todos los creadores de Klaze —
 * cada fila muestra sus comunidades como badges (una comunidad por creador
 * en el mock actual, pero el diseño soporta varias). Sin edición: es un
 * directorio de solo lectura, la única acción de negocio (suspender) vive
 * en `/plataforma/comunidades`.
 */
export default function PlataformaCreadoresPage() {
  const hydrated = useHydrated();
  const { creadores } = usePlatform();

  if (!hydrated) {
    return <CreadoresSkeleton />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Creadores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {creadores.length} {creadores.length === 1 ? "creador registrado" : "creadores registrados"}{" "}
          en Klaze.
        </p>
      </div>

      {creadores.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="Todavía no hay creadores"
          descripcion="En cuanto alguien registre su comunidad, va a aparecer aquí."
        />
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creador</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Comunidades</TableHead>
                <TableHead>Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creadores.map(({ usuario, comunidades }) => (
                <TableRow key={usuario.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarImage src={usuario.avatarUrl} alt={usuario.nombre} />
                        <AvatarFallback>{usuario.nombre[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{usuario.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{usuario.email}</TableCell>
                  <TableCell>
                    {comunidades.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin comunidad</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {comunidades.map((c) => (
                          <Badge key={c.id} variant="secondary">
                            {c.nombre}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFechaLarga(usuario.creadoEl)}
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
