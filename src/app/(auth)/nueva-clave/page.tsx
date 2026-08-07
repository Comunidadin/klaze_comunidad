"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { AuthFormCard } from "../_components/auth-form-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CampoClave } from "@/components/shared/campo-clave";

/**
 * Donde aterriza el enlace de "¿olvidaste tu contraseña?".
 *
 * El enlace de recuperación deja una sesión abierta al llegar, así que aquí ya
 * se sabe quién es: solo hay que pedirle la contraseña nueva. Si alguien entra
 * a esta dirección sin venir del correo, no hay sesión y se le dice.
 */
export default function NuevaClavePage() {
  const router = useRouter();
  const [listo, setListo] = useState<boolean | null>(null);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // `async` con `.then` y nunca `setState` síncrono dentro del efecto: es el
    // patrón del proyecto (ver CLAUDE.md).
    let vivo = true;
    void crearClienteNavegador()
      .auth.getUser()
      .then(({ data }) => {
        if (vivo) setListo(Boolean(data.user));
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();

    if (clave.length < 8) {
      toast.error("La contraseña necesita al menos 8 caracteres.");
      return;
    }
    if (clave !== repetida) {
      toast.error("Las dos contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    const { error } = await crearClienteNavegador().auth.updateUser({ password: clave });
    setEnviando(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Contraseña cambiada. Ya puedes entrar con ella.");
    router.replace("/login");
  }

  if (listo === null) {
    return (
      <AuthFormCard titulo="Un momento…" descripcion="Comprobando tu enlace.">
        <span />
      </AuthFormCard>
    );
  }

  if (!listo) {
    return (
      <AuthFormCard
        titulo="Este enlace ya no vale"
        descripcion="Puede haber caducado, o haberse usado ya."
      >
        <Button asChild className="w-full">
          <Link href="/login">Pedir uno nuevo</Link>
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      titulo="Elige tu contraseña"
      descripcion="Con esta entrarás a partir de ahora."
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="clave-nueva">Contraseña nueva</Label>
          <CampoClave
            id="clave-nueva"
            value={clave}
            onChange={setClave}
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="clave-repetida">Repítela</Label>
          <CampoClave
            id="clave-repetida"
            value={repetida}
            onChange={setRepetida}
            autoComplete="new-password"
            required
          />
        </div>

        <Button type="submit" disabled={enviando} className="w-full">
          <KeyRound className="size-4" aria-hidden />
          {enviando ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </AuthFormCard>
  );
}
