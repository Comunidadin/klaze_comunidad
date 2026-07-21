"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { useKlazeStore } from "@/lib/store";
import { esEmailValido } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormCard } from "../_components/auth-form-card";

interface FormErrors {
  nombre?: string;
  email?: string;
  nombreComunidad?: string;
}

/**
 * Registro de creador: nombre + correo + nombre de comunidad ->
 * `registrarCreador` (crea User rol creador + Community en el store, ver
 * `src/lib/store.ts`). Igual que en login, el redirect a /admin lo hace el
 * layout de `(auth)` en cuanto detecta la sesión nueva.
 */
export default function RegistroPage() {
  const registrarCreador = useKlazeStore((s) => s.registrarCreador);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [nombreComunidad, setNombreComunidad] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [creando, setCreando] = useState(false);

  function validar(): boolean {
    const next: FormErrors = {};
    if (!nombre.trim()) next.nombre = "Cuéntanos cómo te llamas.";
    if (!email.trim()) next.email = "Tu correo es obligatorio.";
    else if (!esEmailValido(email)) next.email = "Ese correo no parece válido.";
    if (!nombreComunidad.trim()) next.nombreComunidad = "Dale un nombre a tu comunidad.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    setCreando(true);
    registrarCreador(nombre.trim(), email.trim(), nombreComunidad.trim());
  }

  return (
    <AuthFormCard
      titulo="Crea tu comunidad"
      subtitulo="Regístrate como creador y lanza tu academia en minutos."
      footer={
        <p className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Tu nombre</Label>
          <Input
            id="nombre"
            autoComplete="name"
            placeholder="Ej. Daniel Restrepo"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (errors.nombre) setErrors((prev) => ({ ...prev, nombre: undefined }));
            }}
            aria-invalid={!!errors.nombre}
          />
          {errors.nombre && <p className="text-xs text-destructive">{errors.nombre}</p>}
        </div>

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
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nombreComunidad">Nombre de tu comunidad</Label>
          <Input
            id="nombreComunidad"
            placeholder="Ej. Academia Klaze"
            value={nombreComunidad}
            onChange={(e) => {
              setNombreComunidad(e.target.value);
              if (errors.nombreComunidad)
                setErrors((prev) => ({ ...prev, nombreComunidad: undefined }));
            }}
            aria-invalid={!!errors.nombreComunidad}
          />
          {errors.nombreComunidad && (
            <p className="text-xs text-destructive">{errors.nombreComunidad}</p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={creando}>
          <Rocket />
          {creando ? "Creando tu comunidad…" : "Crear mi comunidad"}
        </Button>
      </form>
    </AuthFormCard>
  );
}
