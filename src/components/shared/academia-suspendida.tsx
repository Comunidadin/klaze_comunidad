"use client";

import { useRouter } from "next/navigation";
import { Lock, LogOut } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { MarcaAcademia } from "@/components/shared/marca-academia";
import { Button } from "@/components/ui/button";

export interface AcademiaSuspendidaProps {
  nombre: string;
  logoUrl?: string;
  colorAcento?: string;
  /**
   * El creador y el alumno necesitan saber cosas distintas: uno tiene que
   * hablar con quien administra la plataforma, el otro con su creador.
   */
  quien: "creador" | "miembro";
}

/**
 * Lo que ve alguien cuya academia está suspendida.
 *
 * Existe porque la alternativa era peor. Desde que suspender revoca acceso
 * real, las políticas dejan la app sin cursos, sin feed y sin miembros: quien
 * entra se encuentra una aplicación vacía y rota, sin ninguna explicación.
 * Suspender debe cerrar la puerta, no romperla.
 *
 * Lo usan los dos lados —`MemberShell` y el layout de `(creador)`— porque los
 * dos pierden el acceso. Antes solo lo perdía el miembro, y el aviso de aquel
 * entonces prometía que el creador podía seguir trabajando; separar las dos
 * pantallas habría dejado ese texto envejeciendo por su cuenta.
 *
 * El botón de salir no es decorativo: sin él, quien entra con la academia
 * suspendida se queda en una pantalla sin ninguna salida.
 */
export function AcademiaSuspendida({
  nombre,
  logoUrl,
  colorAcento,
  quien,
}: AcademiaSuspendidaProps) {
  const { logout } = useSession();
  const router = useRouter();

  async function handleLogout() {
    // `logout` es asíncrono: cierra la sesión en Supabase. Sin el await, el
    // redirect puede adelantarse y dejar la cookie viva un instante.
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <MarcaAcademia
        nombre={nombre}
        logoUrl={logoUrl}
        colorAcento={colorAcento}
        orientacion="vertical"
      />
      <div className="mt-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Lock className="size-7" />
      </div>
      <h1 className="max-w-sm font-display text-2xl font-bold tracking-tight text-foreground">
        {nombre} está suspendida
      </h1>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        {quien === "creador"
          ? "El acceso está pausado. Escribe a quien administra la plataforma para reactivarla: nada se ha borrado, y tus módulos y tus alumnos siguen donde estaban."
          : "El acceso está pausado temporalmente. Escribe a quien te dio acceso; tu progreso y tus puntos siguen intactos."}
      </p>
      <Button variant="outline" onClick={() => void handleLogout()} className="mt-2">
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
