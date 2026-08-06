"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Plan } from "@/lib/types";

export interface AltaAcademiaDialogProps {
  abierto: boolean;
  onCerrar: () => void;
  planes: Plan[];
  /** Se llama tras un alta correcta: la lista vive en el padre. */
  onCreada: () => void | Promise<void>;
}

/** `Mi Empresa` → `mi-empresa`. Sin acentos: el slug va en la URL. */
function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Alta de academia desde `/plataforma/comunidades`.
 *
 * Tiene dos caras: el formulario y, después, la contraseña temporal. La segunda
 * se enseña **una sola vez** —no se guarda en ningún sitio— así que el diálogo
 * no se cierra solo al terminar: quien da de alta tiene que verla y copiarla.
 */
export function AltaAcademiaDialog({
  abierto,
  onCerrar,
  planes,
  onCreada,
}: AltaAcademiaDialogProps) {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [planId, setPlanId] = useState(planes[0]?.id ?? "pro");
  const [enviando, setEnviando] = useState(false);
  // El resultado, no el formulario: se guarda aparte porque cambia la cara
  // entera del diálogo.
  const [credencial, setCredencial] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // El slug se deriva del nombre hasta que alguien lo toca a mano. Después ya
  // no: sobrescribir lo que acaban de escribir es de las cosas que más
  // molestan de un formulario.
  const slugEfectivo = slugTocado ? slug : aSlug(empresa);

  function limpiar() {
    setEmpresa("");
    setEmail("");
    setSlug("");
    setSlugTocado(false);
    setCredencial(null);
    setEnviando(false);
  }

  function cerrar() {
    onCerrar();
    limpiar();
  }

  async function enviar() {
    if (!empresa.trim() || !email.trim() || !slugEfectivo) {
      toast.error("Rellena el nombre, el correo y el identificador.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = crearClienteNavegador();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesión caducó. Vuelve a entrar.");

      const r = await fetch("/api/academias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          empresa: empresa.trim(),
          email: email.trim(),
          slug: slugEfectivo,
          planId,
        }),
      });

      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo crear la academia");

      await onCreada();

      if (cuerpo.yaExistia) {
        toast.info(
          `Ya existía una academia con el identificador "${slugEfectivo}". No se ha tocado nada.`
        );
        cerrar();
        return;
      }

      // Convertir a un alumno en creador le cambia dónde aterriza al entrar:
      // deja sus cursos y pasa a un panel de administración. Se avisa aparte
      // porque es un efecto que nadie pide y nadie espera.
      if (cuerpo.eraAlumno) {
        toast.warning(
          `Ojo: ${email.trim()} era alumno y ahora es creador. Al entrar irá a su panel, no a sus cursos.`,
          { duration: 10000 }
        );
      }

      if (cuerpo.passwordTemporal) {
        setCredencial({ email: email.trim(), password: cuerpo.passwordTemporal });
      } else {
        toast.success(
          `Academia creada. ${email.trim()} ya tenía cuenta: entra con su contraseña de siempre.`
        );
        cerrar();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la academia");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && cerrar()}>
      <DialogContent>
        {credencial ? (
          <>
            <DialogHeader>
              <DialogTitle>Academia creada</DialogTitle>
              <DialogDescription>
                Pásale estos datos al creador. La contraseña no se guarda en
                ningún sitio y no volverás a verla.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Correo:</span>{" "}
                {credencial.email}
              </p>
              <p className="font-mono">
                <span className="font-sans text-muted-foreground">Contraseña:</span>{" "}
                {credencial.password}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `Correo: ${credencial.email}\nContraseña: ${credencial.password}`
                  );
                  toast.success("Copiado.");
                }}
              >
                <Copy /> Copiar
              </Button>
              <Button onClick={cerrar}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Dar de alta una academia</DialogTitle>
              <DialogDescription>
                Se crea la cuenta del creador y su academia. Al terminar verás
                una contraseña temporal para pasarle.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="alta-empresa">Nombre de la academia</Label>
                <Input
                  id="alta-empresa"
                  value={empresa}
                  onChange={(ev) => setEmpresa(ev.target.value)}
                  placeholder="Mentoría Élite"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alta-email">Correo del creador</Label>
                <Input
                  id="alta-email"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="jefe@empresa.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alta-slug">Identificador en la URL</Label>
                <Input
                  id="alta-slug"
                  value={slugEfectivo}
                  onChange={(ev) => {
                    setSlugTocado(true);
                    setSlug(aSlug(ev.target.value));
                  }}
                  placeholder="mentoria-elite"
                />
                <p className="text-xs text-muted-foreground">
                  Sus alumnos entrarán por /c/{slugEfectivo || "…"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alta-plan">Plan</Label>
                <select
                  id="alta-plan"
                  value={planId}
                  onChange={(ev) => setPlanId(ev.target.value as Plan["id"])}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                >
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={cerrar}>
                Cancelar
              </Button>
              <Button onClick={() => void enviar()} disabled={enviando}>
                {enviando ? "Creando…" : "Crear academia"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
