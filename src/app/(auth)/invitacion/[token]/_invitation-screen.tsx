"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, Loader2, MailQuestion, ShieldAlert, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useHydrated } from "@/lib/hooks/use-session";
import { useInvitation } from "@/lib/hooks/use-invitation";
import { useKlazeStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/shared/logo";
import type { Course } from "@/lib/types";

interface FormErrors {
  nombre?: string;
  password?: string;
}

/** Une nombres de curso al estilo "A, B y C". */
function listarEnEspanol(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function copyInvitacion(nombreComunidad: string, todosLosCursos: boolean, cursos: Course[]): string {
  if (todosLosCursos) {
    return `Fuiste invitado a toda la comunidad ${nombreComunidad}.`;
  }
  if (cursos.length === 0) {
    return `Fuiste invitado a la comunidad ${nombreComunidad}.`;
  }
  const titulos = listarEnEspanol(cursos.map((c) => c.titulo));
  return cursos.length === 1
    ? `Fuiste invitado al curso ${titulos}, en ${nombreComunidad}.`
    : `Fuiste invitado a los cursos ${titulos}, en ${nombreComunidad}.`;
}

/** Pantalla de mensaje simple (b/c) reutilizando el mismo look que el formulario. */
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
      <div className="mb-8 flex justify-center lg:hidden">
        <Logo href="/login" />
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
      <Skeleton className="mb-8 h-8 w-28 lg:hidden" />
      <Skeleton className="size-14 rounded-2xl" />
      <Skeleton className="mt-4 h-7 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <div className="mt-7 space-y-4">
        <Skeleton className="h-16 w-full" />
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
 * Última pantalla del grupo `(auth)`: la que "abre" un alumno invitado
 * desde su correo. Resuelve la invitación vía `useInvitation` y renderiza
 * uno de 3 estados — ver docstring de cada rama más abajo.
 */
export function InvitationScreen({ token }: InvitationScreenProps) {
  const hydrated = useHydrated();
  const resultado = useInvitation(token);
  const aceptarInvitacion = useKlazeStore((s) => s.aceptarInvitacion);
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [enviando, setEnviando] = useState(false);
  // Una vez aceptada con éxito dejamos de derivar la UI del store: así
  // evitamos que el flip a `estado: "aceptada"` (disparado por la propia
  // aceptación) haga parpadear la rama "esta invitación ya fue usada"
  // mientras el router todavía está navegando a /cursos.
  const [aceptada, setAceptada] = useState(false);

  // Mientras el store no hidrata desde localStorage, cualquier lectura de
  // `invitaciones`/`comunidadesCreadas` puede no reflejar todavía lo que
  // hay persistido (p. ej. una invitación ya aceptada en una sesión
  // anterior) — mostramos un esqueleto neutro hasta que hydrated.
  if (!hydrated) {
    return <EsqueletoInvitacion />;
  }

  if (aceptada) {
    return (
      <MensajeInvitacion
        icono={Sparkles}
        titulo="¡Listo!"
        descripcion="Te estamos llevando a tus cursos…"
      />
    );
  }

  if (!resultado) {
    return (
      <MensajeInvitacion
        icono={MailQuestion}
        titulo="Esta invitación no existe o expiró"
        descripcion="Revisa que copiaste bien el enlace, o pídele al creador de la comunidad que te envíe uno nuevo."
      />
    );
  }

  const { invitacion, comunidad, cursos, todosLosCursos } = resultado;

  if (invitacion.estado === "aceptada") {
    return (
      <MensajeInvitacion
        icono={ShieldAlert}
        titulo="Esta invitación ya fue usada"
        descripcion="Esta cuenta ya se creó. Inicia sesión con el correo con el que te invitaron."
      />
    );
  }

  function validar(): boolean {
    const next: FormErrors = {};
    if (!nombre.trim()) next.nombre = "Cuéntanos cómo te llamas.";
    if (password.length < 6) next.password = "Usa al menos 6 caracteres.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!validar()) return;

    setEnviando(true);
    const nuevoUsuario = aceptarInvitacion(token, nombre.trim());

    if (!nuevoUsuario) {
      // Carrera improbable (doble submit, o el token cambió de estado
      // entre el render y el click) — no hay nada que romper, solo
      // avisamos y dejamos que el propio hook re-derive el estado (c).
      toast.error("Esta invitación ya no está disponible.");
      setEnviando(false);
      return;
    }

    setAceptada(true);
    toast.success(`¡Bienvenido, ${nuevoUsuario.nombre}! Tu cuenta fue creada.`);
    router.replace(`/c/${comunidad.slug}/cursos`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ "--community-accent": comunidad.colorAcento } as React.CSSProperties}
    >
      <div className="mb-8 flex justify-center lg:hidden">
        <Logo href="/login" />
      </div>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo mock (dicebear) sin dominio configurado en next/image */}
        <img
          src={comunidad.logoUrl}
          alt=""
          className="size-12 shrink-0 rounded-2xl border border-border object-cover"
          style={{ boxShadow: "0 0 0 2px var(--community-accent)" }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {comunidad.nombre}
          </p>
        </div>
      </div>

      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
        Fuiste invitado
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {copyInvitacion(comunidad.nombre, todosLosCursos, cursos)} Crea tu cuenta para
        empezar.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre completo</Label>
          <Input
            id="nombre"
            autoComplete="name"
            placeholder="Ej. Valentina Ríos"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (errors.nombre) setErrors((prev) => ({ ...prev, nombre: undefined }));
            }}
            aria-invalid={!!errors.nombre}
            disabled={enviando}
          />
          {errors.nombre && <p className="text-xs text-destructive">{errors.nombre}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Crea una contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            aria-invalid={!!errors.password}
            disabled={enviando}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {enviando ? "Creando tu cuenta…" : "Aceptar invitación y entrar"}
        </Button>
      </form>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <KeyRound className="size-3.5" />
        Invitación para {invitacion.email}
      </p>
    </motion.div>
  );
}
