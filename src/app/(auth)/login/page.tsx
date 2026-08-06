"use client";

import { useState, type FormEvent } from "react";
import { MailCheck, Send } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormCard } from "../_components/auth-form-card";

/**
 * Entrada por enlace de correo. No hay contraseña que recordar ni recuperar.
 *
 * Responde lo mismo exista o no la cuenta. Si dijera "ese correo no está
 * registrado", el formulario se convertiría en una herramienta para averiguar
 * quién tiene cuenta aquí — y con academias de empresas distintas conviviendo
 * en la misma base, eso es información de más.
 *
 * El redirect por rol no ocurre aquí: cuando la persona abre el enlace de su
 * correo aterriza en `/callback`, que decide a dónde llevarla.
 */
export default function LoginPage() {
  const { enviarEnlace } = useSession();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const r = await enviarEnlace(email.trim());
    setEnviando(false);
    if (r.ok) setEnviado(true);
    else setError("No pudimos enviar el enlace. Inténtalo de nuevo en un momento.");
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
      subtitulo="Te enviamos un enlace de acceso. Sin contraseñas."
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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={enviando} className="w-full">
          <Send className="size-4" aria-hidden />
          {enviando ? "Enviando..." : "Enviarme el enlace"}
        </Button>
      </form>
    </AuthFormCard>
  );
}
