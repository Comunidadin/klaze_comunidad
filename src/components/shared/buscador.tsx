"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, MessagesSquare, Search, UserRound } from "lucide-react";
import { useBusqueda } from "@/lib/hooks/use-busqueda";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface BuscadorProps {
  comunidadId: string;
  comunidadSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * El buscador del área de alumno: clases, publicaciones y miembros de esta
 * academia, mientras se escribe. Lo abre la lupa del encabezado y ⌘K/Ctrl-K
 * (el atajo vive en `MemberShell`, que es quien está siempre montado).
 */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Fila({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
      >
        {children}
      </button>
    </li>
  );
}

export function Buscador({ comunidadId, comunidadSlug, open, onOpenChange }: BuscadorProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { clases, publicaciones, miembros, buscando } = useBusqueda(comunidadId, q);

  // Al cerrar se limpia el texto: es una búsqueda, no un borrador. Va en el
  // manejador y no en un efecto — regla del proyecto.
  function handleOpenChange(siguiente: boolean) {
    onOpenChange(siguiente);
    if (!siguiente) setQ("");
  }

  function ir(ruta: string) {
    handleOpenChange(false);
    router.push(ruta);
  }

  const hayAlgo = clases.length > 0 || publicaciones.length > 0 || miembros.length > 0;
  const busco = q.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-24 max-h-[70dvh] translate-y-0 overflow-y-auto p-4 sm:max-w-lg">
        <DialogTitle className="sr-only">Buscar en la academia</DialogTitle>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar clases, publicaciones, miembros…"
            className="pl-8"
            autoFocus
            aria-label="Buscar en la academia"
          />
        </div>

        {busco && (
          <div className="mt-3 space-y-4">
            {clases.length > 0 && (
              <Grupo titulo="Clases">
                {clases.map((c) => (
                  <Fila
                    key={c.id}
                    onClick={() =>
                      ir(`/c/${comunidadSlug}/cursos/${c.cursoSlug}/leccion/${c.id}`)
                    }
                  >
                    <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.cursoTitulo}
                    </span>
                  </Fila>
                ))}
              </Grupo>
            )}

            {publicaciones.length > 0 && (
              <Grupo titulo="Publicaciones">
                {publicaciones.map((p) => (
                  <Fila
                    key={p.id}
                    onClick={() =>
                      ir(
                        p.espacioSlug
                          ? `/c/${comunidadSlug}/comunidad/espacio/${p.espacioSlug}`
                          : `/c/${comunidadSlug}/comunidad`
                      )
                    }
                  >
                    <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{p.titulo}</span>
                  </Fila>
                ))}
              </Grupo>
            )}

            {miembros.length > 0 && (
              <Grupo titulo="Miembros">
                {miembros.map((m) => (
                  <Fila key={m.id} onClick={() => ir(`/c/${comunidadSlug}/miembros`)}>
                    <Avatar className="size-6">
                      <AvatarImage src={m.avatarUrl} alt="" />
                      <AvatarFallback className="text-[10px]">
                        {m.nombre[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">{m.nombre}</span>
                    <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                  </Fila>
                ))}
              </Grupo>
            )}

            {!hayAlgo && !buscando && (
              <p className="px-2 text-sm text-muted-foreground">
                Nada con «{q.trim()}» en esta academia.
              </p>
            )}
            {buscando && !hayAlgo && (
              <p className="px-2 text-sm text-muted-foreground">Buscando…</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
