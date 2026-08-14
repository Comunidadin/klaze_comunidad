"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  MessagesSquare,
  Search,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useBusqueda } from "@/lib/hooks/use-busqueda";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface BuscadorProps {
  comunidadId: string;
  comunidadSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Los mismos destinos de la barra superior, para que la paleta vacía ya sirva. */
const ATAJOS = [
  { label: "Módulos", segmento: "/cursos", Icono: BookOpen },
  { label: "Comunidad", segmento: "/comunidad", Icono: MessagesSquare },
  { label: "Calendario", segmento: "/calendario", Icono: Calendar },
  { label: "Miembros", segmento: "/miembros", Icono: Users },
  { label: "Ranking", segmento: "/ranking", Icono: Trophy },
] as const;

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function Fila({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
      >
        {children}
      </button>
    </li>
  );
}

/**
 * La paleta de búsqueda del área de alumno (lupa del encabezado, ⌘K/Ctrl-K).
 *
 * Sin escribir enseña los atajos de navegación — una paleta vacía parecía
 * rota. El input va integrado en la cabecera, sin borde propio: el marco es
 * el propio diálogo.
 */
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
      <DialogContent
        showCloseButton={false}
        className="top-24 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Buscar en la academia</DialogTitle>

        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar clases, publicaciones, miembros…"
            className="h-14 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
            aria-label="Buscar en la academia"
          />
          <kbd className="shrink-0 rounded-md border border-border px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {!busco && (
            <Grupo titulo="Ir a">
              {ATAJOS.map(({ label, segmento, Icono }) => (
                <Fila key={segmento} onClick={() => ir(`/c/${comunidadSlug}${segmento}`)}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icono className="size-4 text-muted-foreground" />
                  </span>
                  {label}
                </Fila>
              ))}
            </Grupo>
          )}

          {busco && (
            <div className="space-y-1">
              {clases.length > 0 && (
                <Grupo titulo="Clases">
                  {clases.map((c) => (
                    <Fila
                      key={c.id}
                      onClick={() =>
                        ir(`/c/${comunidadSlug}/cursos/${c.cursoSlug}/leccion/${c.id}`)
                      }
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <BookOpen className="size-4 text-muted-foreground" />
                      </span>
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
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <MessagesSquare className="size-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{p.titulo}</span>
                    </Fila>
                  ))}
                </Grupo>
              )}

              {miembros.length > 0 && (
                <Grupo titulo="Miembros">
                  {miembros.map((m) => (
                    <Fila key={m.id} onClick={() => ir(`/c/${comunidadSlug}/miembros`)}>
                      <Avatar className="size-8">
                        <AvatarImage src={m.avatarUrl} alt="" />
                        <AvatarFallback className="text-xs">{m.nombre[0]}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">{m.nombre}</span>
                      <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                    </Fila>
                  ))}
                </Grupo>
              )}

              {!hayAlgo && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {buscando ? "Buscando…" : `Nada con «${q.trim()}» en esta academia.`}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
