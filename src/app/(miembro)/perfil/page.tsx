"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, LogOut, Save } from "lucide-react";
import { useSession } from "@/lib/hooks/use-session";
import { useGamification } from "@/lib/hooks/use-gamification";
import { resolverComunidad, useAppStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { homePorRol } from "@/lib/routes";
import { NIVEL_MAXIMO, puntosParaNivel } from "@/lib/levels";
import { Logo } from "@/components/shared/logo";
import { LevelBadge } from "@/components/shared/level-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/lib/types";

/**
 * `/perfil` vive fuera del segmento `[comunidad]`, así que no recibe
 * `MemberShell` (ese layout necesita el slug de comunidad de la ruta, que
 * aquí no existe). En su lugar arma su propio header minimal: wordmark +
 * botón "Volver" a la comunidad principal del usuario.
 */
export default function PerfilPage() {
  const { user } = useSession();

  // El layout de (miembro) ya garantiza sesión activa antes de montar
  // cualquier ruta hija (ver src/app/(miembro)/layout.tsx), así que en
  // steady-state `user` siempre existe aquí. Este guard solo cubre el
  // frame inicial antes de esa redirección.
  if (!user) return null;

  // `key={user.id}` fuerza un remount completo si el usuario activo cambia,
  // para que el formulario re-inicialice su estado local con los datos del
  // nuevo user en vez de arrastrar lo que se estaba escribiendo para el
  // anterior.
  return <PerfilContenido key={user.id} user={user} />;
}

function PerfilContenido({ user }: { user: User }) {
  const router = useRouter();
  const { logout } = useSession();
  const actualizarPerfil = useAppStore((s) => s.actualizarPerfil);
  const comunidadesCreadas = useAppStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useAppStore((s) => s.comunidadOverrides);

  // Un usuario puede pertenecer a varias comunidades (`comunidadIds`). Para
  // decidir de qué comunidad tomar los nombres de nivel usamos la primera
  // (`comunidadIds[0]`) como su "comunidad principal" — misma intención que
  // `homePorRol` en src/lib/routes.ts (llevar al usuario a "su" comunidad
  // por defecto), pero con un algoritmo distinto: `homePorRol` recorre la
  // lista de comunidades y toma la primera que el usuario tenga en
  // `comunidadIds`, mientras que aquí tomamos directamente `comunidadIds[0]`.
  // Se resuelve vía `resolverComunidad` para que un nombre de nivel editado
  // desde /admin/comunidad se refleje acá sin un parche local.
  const todasLasComunidades = [...mockCommunities, ...comunidadesCreadas];
  const comunidadBase =
    todasLasComunidades.find((c) => c.id === user.comunidadIds[0]) ?? todasLasComunidades[0];
  const comunidadPrincipal = comunidadBase
    ? resolverComunidad(comunidadBase, comunidadOverrides)
    : undefined;

  const { miNivel, puntosParaSiguiente } = useGamification(comunidadPrincipal?.id ?? "");

  const [nombre, setNombre] = useState(user.nombre);
  const [bio, setBio] = useState(user.bio);

  function handleGuardar(e: FormEvent) {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.error("El nombre no puede estar vacío.");
      return;
    }
    actualizarPerfil(nombreLimpio, bio.trim());
    toast.success("Tu perfil se actualizó correctamente.");
  }

  async function handleLogout() {
    // `logout` ahora es asíncrono: cierra la sesión en Supabase antes de
    // navegar. Sin el await, el redirect puede adelantarse y dejar la cookie
    // viva un instante, con lo que el guard del layout te devuelve dentro.
    await logout();
    router.replace("/login");
  }

  const esNivelMaximo = miNivel >= NIVEL_MAXIMO;
  const nombreNivelActual = comunidadPrincipal?.nombresNiveles[miNivel - 1] ?? `Nivel ${miNivel}`;
  const nombreNivelSiguiente = comunidadPrincipal?.nombresNiveles[miNivel] ?? null;

  const inicioNivel = puntosParaNivel(miNivel);
  const finNivel = esNivelMaximo ? inicioNivel : puntosParaNivel(miNivel + 1);
  const progresoPct = esNivelMaximo
    ? 100
    : Math.min(
        100,
        Math.max(0, Math.round(((user.puntos - inicioNivel) / (finNivel - inicioNivel)) * 100))
      );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Logo size="sm" />
          <Button variant="ghost" size="sm" onClick={() => router.push(homePorRol(user))}>
            <ArrowLeft /> Volver
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Mi perfil
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Así te ven los demás miembros de tus comunidades.
          </p>
        </div>

        {/* Identidad */}
        <div className="flex items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <Avatar size="lg">
            <AvatarImage src={user.avatarUrl} alt={user.nombre} />
            <AvatarFallback>{user.nombre[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-foreground">
              {user.nombre}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Tarjeta de nivel */}
        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-center gap-4">
            <LevelBadge nivel={miNivel} size="lg" />
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-foreground">
                {nombreNivelActual}
              </p>
              <p className="text-xs text-muted-foreground">
                {user.puntos} {user.puntos === 1 ? "punto acumulado" : "puntos acumulados"}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Progress value={progresoPct} />
            <p className="text-xs text-pretty text-muted-foreground">
              {esNivelMaximo ? (
                <>
                  Llegaste al nivel máximo de la comunidad — sos{" "}
                  <span className="font-medium text-foreground">{nombreNivelActual}</span>. ¡Gracias
                  por ser parte desde siempre!
                </>
              ) : (
                <>
                  Te faltan{" "}
                  <span className="font-medium text-foreground">
                    {puntosParaSiguiente} {puntosParaSiguiente === 1 ? "punto" : "puntos"}
                  </span>{" "}
                  para llegar a {nombreNivelSiguiente ?? `nivel ${miNivel + 1}`}.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Editar nombre y bio */}
        <form
          onSubmit={handleGuardar}
          className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Biografía</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Contale a la comunidad quién sos…"
            />
          </div>
          <Button type="submit">
            <Save /> Guardar cambios
          </Button>
        </form>

        {/* Preferencias */}
        <div className="flex items-center justify-between rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <div>
            <p className="text-sm font-medium text-foreground">Apariencia</p>
            <p className="text-xs text-muted-foreground">Cambia entre modo claro y modo oscuro.</p>
          </div>
          <ThemeToggle />
        </div>

        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          <LogOut /> Cerrar sesión
        </Button>
      </main>
    </div>
  );
}
