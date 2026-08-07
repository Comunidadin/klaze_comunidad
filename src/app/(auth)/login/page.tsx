"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, MailCheck, Send } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoClave } from "@/components/shared/campo-clave";
import { AuthFormCard } from "../_components/auth-form-card";

type Modo = "enlace" | "clave";

/**
 * Traduce el fallo a algo accionable, sin contar de más.
 *
 * "Correo sin confirmar" SÍ se dice: significa que esa persona nunca abrió su
 * invitación, y saberlo es la diferencia entre reenviársela y perder una tarde
 * buscando un fallo que no existe. El resto queda ambiguo a propósito, para no
 * convertir el formulario en un detector de qué correos tienen cuenta.
 */
function mensajeDeError(bruto?: string): string {
  const texto = (bruto ?? "").toLowerCase();

  if (texto.includes("not confirmed")) {
    return "Esta cuenta todavía no ha abierto su invitación, así que aún no puede entrar con contraseña. Usa el enlace de acceso que recibiste por correo.";
  }
  if (texto.includes("rate limit") || texto.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un momento y vuelve a probar.";
  }
  return "No pudimos entrar. Revisa el correo y la contraseña.";
}

/**
 * Dos vías de entrada, y cada una para quien la necesita.
 *
 * **Enlace por correo** es la vía de los alumnos: no se les pone contraseña al
 * invitarlos, así que no tienen ninguna que recordar ni perder.
 *
 * **Contraseña** es la vía de quien administra. El enlace depende de tener un
 * emisor de correo configurado y un dominio verificado; sin eso, el dueño se
 * quedaría fuera de su propia academia.
 *
 * En ambos casos la respuesta es la misma exista o no la cuenta. Si dijera
 * "ese correo no está registrado", el formulario serviría para averiguar quién
 * tiene cuenta aquí — y en esta base conviven academias de empresas distintas.
 */
export default function LoginPage() {
  const { enviarEnlace, entrarConClave } = useSession();
  const router = useRouter();

  const [modo, setModo] = useState<Modo>("clave");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pide el enlace para poner una contraseña nueva.
   *
   * Dice lo mismo exista o no la cuenta: si respondiera "ese correo no está
   * registrado", cualquiera podría averiguar quién tiene cuenta preguntando
   * uno a uno.
   */
  async function recuperar() {
    const correo = email.trim();
    if (!correo) {
      toast.error("Escribe tu correo arriba y vuelve a pulsar.");
      return;
    }

    await fetch("/api/recuperar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo }),
    }).catch(() => {});

    toast.success(
      `Si ${correo} tiene cuenta, le llega un correo para elegir contraseña nueva.`
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    if (modo === "enlace") {
      const r = await enviarEnlace(email.trim());
      setEnviando(false);
      if (r.ok) setEnviado(true);
      else setError("No pudimos enviar el enlace. Revisa que el correo esté configurado.");
      return;
    }

    const r = await entrarConClave(email.trim(), clave);
    setEnviando(false);
    if (r.ok) {
      // El layout de (auth) redirige por rol en cuanto hay sesión; esto solo
      // adelanta la navegación para que no se vea un parpadeo del formulario.
      router.replace("/callback");
      return;
    }

    setError(mensajeDeError(r.error));
  }

  if (enviado) {
    return (
      <AuthFormCard
        titulo="Revisa tu correo"
        subtitulo={`Si ${email} tiene cuenta, le hemos enviado un enlace para entrar.`}
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center text-sm text-muted-foreground">
          <MailCheck className="size-10 text-primary" aria-hidden />
          <p>El enlace caduca en una hora. Puedes cerrar esta pestaña.</p>
        </div>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      titulo="Entra a tu academia"
      subtitulo={
        modo === "clave"
          ? "Con tu correo y contraseña."
          : "Te enviamos un enlace de acceso. Sin contraseñas."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {modo === "clave" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="clave">Contraseña</Label>
              <button
                type="button"
                onClick={() => void recuperar()}
                className="cursor-pointer text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <CampoClave
              id="clave"
              value={clave}
              onChange={setClave}
              autoComplete="current-password"
              required
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={enviando} className="w-full">
          {modo === "clave" ? (
            <KeyRound className="size-4" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          {enviando ? "Entrando..." : modo === "clave" ? "Entrar" : "Enviarme el enlace"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setModo(modo === "clave" ? "enlace" : "clave");
            setError(null);
          }}
          className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {modo === "clave"
            ? "Prefiero recibir un enlace por correo"
            : "Prefiero entrar con contraseña"}
        </button>
      </form>
    </AuthFormCard>
  );
}
