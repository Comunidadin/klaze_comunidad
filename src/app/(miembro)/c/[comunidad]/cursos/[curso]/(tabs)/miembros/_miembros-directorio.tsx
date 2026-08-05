"use client";

import { useMemo, useState } from "react";
import { Search, Star, Users } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useMembers } from "@/lib/hooks/use-members";
import { MemberCard } from "@/components/community/member-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LevelBadge } from "@/components/shared/level-badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatFechaLarga } from "@/lib/format-fecha";
import type { User } from "@/lib/types";

export interface MiembrosDirectorioProps {
  comunidadSlug: string;
  cursoSlug: string;
}

/** Quita tildes para que "jose" encuentre "José" — mismo criterio que `slugify` en el store. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Directorio de miembros CON ACCESO A ESTE CURSO (Cambio 3): buscador por
 * nombre + grid de `MemberCard`. Click en una tarjeta abre un Dialog con el
 * perfil completo del miembro. `CursoTabsShell` ya garantiza que el curso
 * existe y que el usuario actual tiene acceso.
 */
export function MiembrosDirectorio({ comunidadSlug, cursoSlug }: MiembrosDirectorioProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");
  const curso = cursos.find((c) => c.slug === cursoSlug);
  const { miembros } = useMembers(resultado?.community.id ?? "", curso?.id ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<User | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return miembros;
    return miembros.filter((m) => normalizar(m.nombre).includes(q));
  }, [miembros, busqueda]);

  if (!resultado || !curso) return null;
  const { community } = resultado;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Miembros
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {miembros.length} {miembros.length === 1 ? "persona tiene" : "personas tienen"} acceso
            a {curso.titulo}.
          </p>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-8"
            aria-label="Buscar miembro por nombre"
          />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="Sin resultados"
          descripcion={`No encontramos a nadie llamado "${busqueda}" en este curso.`}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtrados.map((miembro) => (
            <MemberCard
              key={miembro.id}
              usuario={miembro}
              onClick={() => setSeleccionado(miembro)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!seleccionado} onOpenChange={(open) => !open && setSeleccionado(null)}>
        <DialogContent className="sm:max-w-md">
          {seleccionado && (
            <>
              <DialogHeader className="items-center text-center">
                <Avatar size="lg" className="mb-1">
                  <AvatarImage src={seleccionado.avatarUrl} alt={seleccionado.nombre} />
                  <AvatarFallback>{seleccionado.nombre[0]}</AvatarFallback>
                </Avatar>
                <DialogTitle className="text-base">{seleccionado.nombre}</DialogTitle>
                <DialogDescription className="text-pretty">
                  {seleccionado.bio || "Todavía no escribió una biografía."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <LevelBadge nivel={seleccionado.nivel} />
                  <span className="text-xs font-medium text-foreground">
                    {community.nombresNiveles[seleccionado.nivel - 1] ??
                      `Nivel ${seleccionado.nivel}`}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1">
                  <span className="inline-flex items-center gap-1 font-display text-lg font-bold tabular-nums text-foreground">
                    <Star className="size-4 text-brand" /> {seleccionado.puntos}
                  </span>
                  <span className="text-xs text-muted-foreground">puntos</span>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Miembro desde el {formatFechaLarga(seleccionado.creadoEl)}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
