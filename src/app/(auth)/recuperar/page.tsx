"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { esEmailValido } from "@/lib/validation";
import { AuthFormCard } from "../_components/auth-form-card";

/**
 * Recuperar contraseña: solo UI, sin lógica real. Pide el correo y, al
 * enviar, cambia a un estado de confirmación con link de vuelta a /login.
 */
export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const valor = email.trim();
    if (!valor) {
      setError("Ingresa tu correo para continuar.");
      return;
    }
    if (!esEmailValido(valor)) {
      setError("Ese correo no parece válido.");
      return;
    }
    setError(null);
    setEnviado(true);
  }

  const volverLink = (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      Volver a iniciar sesión
    </Link>
  );

  if (enviado) {
    return (
      <AuthFormCard
        titulo="Revisa tu correo"
        subtitulo="Sigue el enlace que te enviamos para continuar."
        footer={volverLink}
      >
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          📧 Te enviamos un enlace para restablecer tu contraseña a{" "}
          <span className="font-medium">{email.trim()}</span>. Si no lo ves
          en unos minutos, revisa spam.
        </div>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      titulo="¿Olvidaste tu contraseña?"
      subtitulo="Ingresa tu correo y te enviamos un enlace para restablecerla."
      footer={volverLink}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg">
          <Mail />
          Enviar enlace
        </Button>
      </form>
    </AuthFormCard>
  );
}
