"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormCard } from "../_components/auth-form-card";

const CUENTAS_DEMO = [
  { email: "alumno@klaze.app", etiqueta: "Alumno" },
  { email: "creador@klaze.app", etiqueta: "Creador" },
  { email: "admin@klaze.app", etiqueta: "Super-admin" },
];

/**
 * Login: correo + cualquier contraseña. `login()` solo valida que el
 * correo exista entre mockUsers/usuariosCreados (T3). El redirect por rol
 * no ocurre aquí: en cuanto `login()` deja sesión activa, el layout de
 * `(auth)` detecta el cambio y navega vía `homePorRol`, así que esta
 * pantalla solo se preocupa de mostrar el error o el estado de carga.
 */
export default function LoginPage() {
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEntrando(true);
    const ok = login(email);
    if (!ok) {
      setError("No encontramos una cuenta con ese correo.");
      setEntrando(false);
    }
  }

  return (
    <AuthFormCard
      titulo="Bienvenido de nuevo"
      subtitulo="Inicia sesión para entrar a tu comunidad."
      footer={
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Cuentas demo (cualquier contraseña):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CUENTAS_DEMO.map((cuenta) => (
                <button
                  key={cuenta.email}
                  type="button"
                  onClick={() => {
                    setEmail(cuenta.email);
                    setError(null);
                  }}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <span className="font-medium">{cuenta.etiqueta}</span>
                  <span className="text-muted-foreground"> · {cuenta.email}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            ¿Eres creador y aún no tienes cuenta?{" "}
            <Link href="/registro" className="font-medium text-primary hover:underline">
              Crea tu comunidad
            </Link>
          </p>
        </div>
      }
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
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              href="/recuperar"
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={entrando}>
          <LogIn />
          {entrando ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
    </AuthFormCard>
  );
}
