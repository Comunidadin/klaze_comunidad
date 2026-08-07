"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, LogOut, Save, KeyRound } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { actualizarPerfil } from "@/lib/supabase/perfil";
import { useSession } from "@/lib/hooks/use-session";
import { useGamification } from "@/lib/hooks/use-gamification";
import { useAppStore } from "@/lib/store";
import { homePorRol } from "@/lib/routes";
import { NIVEL_MAXIMO, puntosParaNivel } from "@/lib/levels";
import { MarcaAcademia } from "@/components/shared/marca-academia";
import { LogoPlataforma } from "@/components/shared/logo";
import { SubirImagen } from "@/components/shared/subir-imagen";
import { CampoClave } from "@/components/shared/campo-clave";
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
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const armazon = useAppStore((s) => s.armazon);

  // Un usuario puede pertenecer a varias comunidades (`comunidadIds`). Para
  // decidir de qué comunidad tomar los nombres de nivel usamos la primera
  // (`comunidadIds[0]`) como su "comunidad principal" — misma intención que
  // `homePorRol` en src/lib/routes.ts (llevar al usuario a "su" comunidad
  // por defecto), pero con un algoritmo distinto: `homePorRol` recorre la
  // Sale del armazón: RLS ya entrega solo la comunidad a la que perteneces,
  // así que no hay nada que buscar ni que resolver.
  const comunidadPrincipal = armazon?.comunidad ?? undefined;

  const { miNivel, puntosParaSiguiente } = useGamification(comunidadPrincipal?.id ?? "");

  const [nombre, setNombre] = useState(user.nombre);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [claveNueva, setClaveNueva] = useState("");
  const [claveRepetida, setClaveRepetida] = useState("");
  const [cambiandoClave, setCambiandoClave] = useState(false);

  async function cambiarClave(e: FormEvent) {
    e.preventDefault();

    if (claveNueva.length < 8) {
      toast.error("La contraseña necesita al menos 8 caracteres.");
      return;
    }
    if (claveNueva !== claveRepetida) {
      toast.error("Las dos contraseñas no coinciden.");
      return;
    }

    setCambiandoClave(true);
    const { error } = await crearClienteNavegador().auth.updateUser({
      password: claveNueva,
    });
    setCambiandoClave(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setClaveNueva("");
    setClaveRepetida("");
    toast.success("Contraseña cambiada. La próxima vez entra con la nueva.");
  }

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.error("El nombre no puede estar vacío.");
      return;
    }
    try {
      const supabase = crearClienteNavegador();
      await actualizarPerfil(supabase, {
        nombre: nombreLimpio,
        bio: bio.trim(),
        avatarUrl,
      });
      // Recargar el armazón para que el nombre y la foto nuevos se vean en
      // todas partes: el menú, sus publicaciones y su ficha de alumno.
      establecerArmazon(await cargarArmazon(supabase));
      toast.success("Tu perfil se actualizó correctamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el perfil");
    }
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
          {comunidadPrincipal ? (
            <MarcaAcademia
              nombre={comunidadPrincipal.nombre}
              logoUrl={comunidadPrincipal.logoUrl}
              colorAcento={comunidadPrincipal.colorAcento}
              size="sm"
            />
          ) : (
            // Un superadmin sin academia propia mira su perfil desde la
            // plataforma: ahí la marca correcta es la de Klaze.
            <LogoPlataforma size="sm" />
          )}
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
            <AvatarImage src={avatarUrl} alt={user.nombre} />
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
            <Label>Foto de perfil</Label>
            <SubirImagen
              valor={avatarUrl}
              onCambio={setAvatarUrl}
              proporcion={1}
              anchoSalida={512}
              destino={{ tipo: "avatar", usuarioId: user.id }}
              etiqueta="Subir tu foto de perfil"
              ayuda="Cuadrada, 512 × 512. Se recorta en círculo, así que centra la cara."
            />
            <p className="text-xs text-muted-foreground">
              Se guarda al pulsar «Guardar cambios».
            </p>
          </div>

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

        {/* Contraseña — formulario aparte a propósito: si compartiera botón con
            el nombre y la bio, guardar un cambio de bio pediría la contraseña. */}
        <form
          onSubmit={cambiarClave}
          className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Contraseña</p>
            <p className="text-xs text-muted-foreground">
              Si entraste con una temporal, este es el sitio para cambiarla.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clave-nueva">Contraseña nueva</Label>
            <CampoClave
              id="clave-nueva"
              value={claveNueva}
              onChange={setClaveNueva}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clave-repetida">Repítela</Label>
            <CampoClave
              id="clave-repetida"
              value={claveRepetida}
              onChange={setClaveRepetida}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={cambiandoClave || !claveNueva}>
            <KeyRound /> {cambiandoClave ? "Cambiando…" : "Cambiar contraseña"}
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
