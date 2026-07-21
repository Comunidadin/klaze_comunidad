"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PenSquare } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { useKlazeStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PostComposerProps {
  comunidadId: string;
  /** `community.categorias` — nunca hardcodeadas, cada comunidad define las suyas. */
  categorias: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Composer del feed: una fila colapsada tipo "input falso" (avatar +
 * placeholder "¿Qué quieres compartir?") que al clickear abre un Dialog con
 * título, cuerpo y categoría. Controlado desde afuera (`open`/`onOpenChange`)
 * para que el estado vacío por categoría también pueda abrirlo con su CTA.
 */
export function PostComposer({ comunidadId, categorias, open, onOpenChange }: PostComposerProps) {
  const { user } = useSession();
  const crearPost = useKlazeStore((s) => s.crearPost);

  const categoriaDefault = categorias.includes("General") ? "General" : (categorias[0] ?? "");

  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [categoria, setCategoria] = useState(categoriaDefault);

  function resetear() {
    setTitulo("");
    setCuerpo("");
    setCategoria(categoriaDefault);
  }

  function handleOpenChange(siguienteAbierto: boolean) {
    onOpenChange(siguienteAbierto);
    if (!siguienteAbierto) resetear();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const tituloLimpio = titulo.trim();
    const cuerpoLimpio = cuerpo.trim();
    if (!tituloLimpio || !cuerpoLimpio) {
      toast.error("Escribe un título y un cuerpo antes de publicar.");
      return;
    }

    crearPost({
      comunidadId,
      autorId: user.id,
      categoria: categoria || categoriaDefault,
      titulo: tituloLimpio,
      cuerpo: cuerpoLimpio,
      fijado: false,
    });

    toast.success("Tu publicación ya está en el feed.");
    handleOpenChange(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar size="sm">
          <AvatarImage src={user?.avatarUrl} alt={user?.nombre ?? ""} />
          <AvatarFallback>{user?.nombre?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <span className="flex-1 text-sm text-muted-foreground">¿Qué quieres compartir?</span>
        <PenSquare className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Crear publicación</DialogTitle>
              <DialogDescription>
                Compártelo con el resto de la comunidad — aparece en el feed al instante.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="post-titulo">Título</Label>
                <Input
                  id="post-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Un título claro y directo"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="post-cuerpo">Cuerpo</Label>
                <Textarea
                  id="post-cuerpo"
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  rows={5}
                  placeholder="Cuéntanos con detalle…"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="post-categoria">Categoría</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger id="post-categoria" className="w-full">
                    <SelectValue placeholder="Elige una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button type="submit">Publicar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
