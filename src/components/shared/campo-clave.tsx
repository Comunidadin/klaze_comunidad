"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CampoClaveProps {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Campo de contraseña con botón para verla.
 *
 * Escribir a ciegas una contraseña que te acaban de dictar por teléfono —o que
 * viene en un correo con guiones y números— es la forma más rápida de creer
 * que la clave no funciona cuando lo que falló fue el dedo. El ojo se usa una
 * vez, al empezar, y no se vuelve a tocar.
 *
 * `autoComplete` lo decide quien lo monta: `current-password` al entrar y
 * `new-password` al cambiarla, para que el gestor de contraseñas del navegador
 * ofrezca lo correcto en cada caso.
 */
export function CampoClave({
  id,
  value,
  onChange,
  autoComplete,
  required,
  placeholder,
  className,
}: CampoClaveProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // `tabIndex={-1}`: al tabular desde el campo se espera llegar al botón
        // de entrar, no a este.
        tabIndex={-1}
        aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"}
        title={visible ? "Ocultar contraseña" : "Ver contraseña"}
        className="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
