"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, MailQuestion, Sparkles } from "lucide-react";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { useInvitation } from "@/lib/hooks/use-invitation";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoPlataforma } from "@/components/shared/logo";
import { MarcaAcademia } from "@/components/shared/marca-academia";

/** Frase que resume a qué da acceso la invitación. */
function copyInvitacion(
  nombreComunidad: string,
  todosLosCursos: boolean,
  cursos: string[]
): string {
  if (todosLosCursos) {
    return `Tienes acceso a todos los cursos de ${nombreComunidad}.`;
  }
  if (cursos.length === 0) {
    return `Tienes acceso a ${nombreComunidad}.`;
  }
  const titulos = cursos.map((c) => `«${c}»`).join(", ");
  return cursos.length === 1
    ? `Tienes acceso al curso ${titulos}, en ${nombreComunidad}.`
    : `Tienes acceso a los cursos ${titulos}, en ${nombreComunidad}.`;
}

function MensajeInvitacion({
  icono: Icono,
  titulo,
  descripcion,
}: {
  icono: typeof MailQuestion;
  titulo: string;
  descripcion: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="text-center"
    >
      <div className="mb-8 flex justify-center">
        <LogoPlataforma href="/login" orientacion="vertical" />
      </div>
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icono className="size-6" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
        {titulo}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{descripcion}</p>
      <Button asChild className="mt-6 w-full" size="lg">
        <Link href="/login">Ir a iniciar sesión</Link>
      </Button>
    </motion.div>
  );
}

function EsqueletoInvitacion() {
  return (
    <div>
      <Skeleton className="mx-auto mb-8 h-20 w-44" />
      <Skeleton className="size-14 rounded-2xl" />
      <Skeleton className="mt-4 h-7 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <div className="mt-7 space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

export interface InvitationScreenProps {
  token: string;
}

/**
 * Aterrizaje del enlace de invitación.
 *
 * Ya no pide nombre ni contraseña, y ese cambio es el corazón de la rebanada:
 * cuando alguien llega aquí desde el correo, **la cuenta ya existe y el acceso
 * ya está concedido**. El enlace creó la cuenta, el trigger convirtió la
 * invitación en inscripción, y `cargarArmazon` remató con
 * `aceptar_mis_invitaciones` por si el trigger no llegó a saltar.
 *
 * Así que esta pantalla solo confirma qué se ha recibido y abre la puerta.
 * Pedir aquí una contraseña sería pedir algo que ya no hace falta.
 */
export function InvitationScreen({ token }: InvitationScreenProps) {
  const hydrated = useHydrated();
  const { invitacion, cargando } = useInvitation(token);
  const { user } = useSession();
  const comunidadPropia = useMyCommunity();
  const armazon = useAppStore((s) => s.armazon);
  const router = useRouter();

  if (!hydrated || cargando) {
    return <EsqueletoInvitacion />;
  }

  // Token inexistente, ya aceptado o academia suspendida — sin distinguir
  // cuál, para no confirmar qué tokens existen.
  if (!invitacion) {
    // Si la persona ya tiene sesión, lo más probable es que su invitación se
    // aceptara sola al entrar: en vez de un callejón sin salida, se la lleva
    // a sus cursos.
    if (user && armazon?.comunidad) {
      return (
        <MensajeInvitacion
          icono={Sparkles}
          titulo="Ya tienes acceso"
          descripcion={`Esta invitación ya se usó. Entra a ${armazon.comunidad.nombre} desde tu cuenta.`}
        />
      );
    }
    return (
      <MensajeInvitacion
        icono={MailQuestion}
        titulo="Esta invitación no está disponible"
        descripcion="Puede haber caducado o haberse usado ya. Pide una nueva a quien te invitó."
      />
    );
  }

  const slug = armazon?.comunidad?.slug ?? comunidadPropia?.slug ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ "--community-accent": invitacion.comunidadColor } as React.CSSProperties}
    >
      <div className="mb-8 flex justify-center">
        <MarcaAcademia
          nombre={invitacion.comunidadNombre}
          logoUrl={invitacion.comunidadLogo}
          colorAcento={invitacion.comunidadColor}
          orientacion="vertical"
        />
      </div>

      <h1 className="mt-4 text-center font-display text-2xl font-bold tracking-tight text-foreground">
        Bienvenido a {invitacion.comunidadNombre}
      </h1>

      <p className="mt-1.5 text-center text-sm text-muted-foreground">
        {copyInvitacion(
          invitacion.comunidadNombre,
          invitacion.todosLosCursos,
          invitacion.cursos
        )}
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Invitación para {invitacion.email}
      </p>

      {user && slug ? (
        <Button
          className="mt-7 w-full"
          size="lg"
          onClick={() => router.replace(`/c/${slug}/cursos`)}
        >
          <LogIn className="size-4" aria-hidden />
          Entrar a la academia
        </Button>
      ) : (
        // Sin sesión: llegó aquí por el enlace copiado, no por el de acceso.
        // El de entrar está en el correo; desde el login puede pedir otro.
        <Button asChild className="mt-7 w-full" size="lg">
          <Link href="/login">Entrar con mi correo</Link>
        </Button>
      )}
    </motion.div>
  );
}
