"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Settings } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { slugDesde } from "@/lib/slug";
import { cargarArmazon } from "@/lib/supabase/consultas";
import { guardarComunidad } from "@/lib/supabase/perfil";
import { useAppStore } from "@/lib/store";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubirImagen } from "@/components/shared/subir-imagen";
import { Separator } from "@/components/ui/separator";
import { CorreosDeLaAcademia } from "./_correos";
import { paletaDeAcademia, type TonosTema } from "@/lib/color-academia";
import type { Community } from "@/lib/types";

function ConfiguracionSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-44" />
      <Skeleton className="h-96 max-w-2xl rounded-xl" />
    </div>
  );
}

// El primero es el cian de la marca (`--brand`): es el color por defecto de
// una comunidad nueva, ver `registrarComunidad` en `src/lib/store.ts`. El
// resto son alternativas para que cada creador diferencie la suya.
const COLORES_PRESET = [
  { nombre: "Cian", valor: "#06ABEB" },
  { nombre: "Índigo", valor: "#6366F1" },
  { nombre: "Violeta", valor: "#8B5CF6" },
  { nombre: "Rojo", valor: "#DC2626" },
  { nombre: "Naranja", valor: "#F97316" },
  { nombre: "Ámbar", valor: "#F59E0B" },
  { nombre: "Esmeralda", valor: "#10B981" },
  { nombre: "Verde", valor: "#16A34A" },
  { nombre: "Rosa", valor: "#EC4899" },
];

/** Logo de la comunidad en el formulario, con el mismo fallback (inicial + gradiente) que `CoursePortada`. */
function LogoPreview({ url, nombre }: { url: string; nombre: string }) {
  const [fallo, setFallo] = useState(false);
  const mostrarImagen = url.trim().length > 0 && !fallo;
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  if (mostrarImagen) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL arbitraria pegada por el creador, ver docstring de CoursePortada
      <img
        src={url}
        alt=""
        onError={() => setFallo(true)}
        className="size-12 shrink-0 rounded-xl border border-border object-cover"
        style={{ boxShadow: "0 0 0 2px var(--community-accent)" }}
      />
    );
  }

  return (
    <div
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60"
      style={{ boxShadow: "0 0 0 2px var(--community-accent)" }}
    >
      <span className="font-display text-lg font-bold text-primary-foreground">{inicial}</span>
    </div>
  );
}

/**
 * Preview en vivo del encabezado de comunidad, con `colorAcento` aplicado
 * como `--community-accent` — mismo mecanismo que `MemberShell` (T4), así
 * que lo que se ve acá es exactamente lo que ven los miembros al navegar.
 */
interface PreviewEncabezadoProps {
  nombre: string;
  logoUrl: string;
  colorAcento: string;
}

function PreviewEncabezado({ nombre, logoUrl, colorAcento }: PreviewEncabezadoProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-background"
      style={{ "--community-accent": colorAcento } as React.CSSProperties}
    >
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <LogoPreview url={logoUrl} nombre={nombre || "?"} />
        <span className="truncate font-display text-sm font-semibold text-foreground">
          {nombre || "Nombre de tu comunidad"}
        </span>
        <span
          className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: "var(--community-accent)" }}
        >
          Entrar a la sala
        </span>
      </div>
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Así se ve el encabezado y los acentos de color en el área de miembros.
      </p>
    </div>
  );
}

/**
 * Lo que de verdad verán los alumnos: la paleta DERIVADA, no el hex crudo.
 *
 * El color elegido no entra tal cual a los botones — `estiloDeAcademia`
 * conserva el tono e impone la luminosidad que garantiza que el texto se lea
 * (spec 2026-08-14). Este preview enseña esa paleta ya corregida, en las dos
 * caras, porque la corrección actúa distinto en cada tema: un amarillo se
 * oscurece bastante en claro y apenas cambia en oscuro, y el creador tiene
 * que verlo ANTES de guardar, no en el correo de un alumno.
 *
 * Los fondos y textos de las tarjetas van fijos en hex, no con tokens del
 * tema: cada tarjeta ES su tema, independiente de cómo tenga el panel quien
 * mira.
 */
function PreviewInterfaz({ colorAcento }: { colorAcento: string }) {
  const paleta = paletaDeAcademia(colorAcento);
  if (!paleta) return null;

  const cara = (tonos: TonosTema, tema: "claro" | "oscuro") => {
    const fondo = tema === "claro" ? "#fbfbfc" : "#16181c";
    const texto = tema === "claro" ? "#1c1e21" : "#f2f3f5";
    const textoBoton = tema === "claro" ? "#fcfcfc" : "#111827";
    return (
      <div
        className="flex-1 space-y-2 rounded-lg p-3 ring-1 ring-foreground/10"
        style={{ backgroundColor: fondo }}
      >
        <p className="text-xs" style={{ color: texto, opacity: 0.6 }}>
          {tema === "claro" ? "Tema claro" : "Tema oscuro"}
        </p>
        <span
          className="inline-block rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ backgroundColor: tonos.primary, color: textoBoton }}
        >
          Continuar
        </span>
        <p className="text-sm">
          <span style={{ color: tonos.primary }}>Un enlace</span>
          <span
            className="ml-3 border-b-2 pb-0.5"
            style={{ borderColor: tonos.primary, color: texto }}
          >
            Pestaña activa
          </span>
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {cara(paleta.claro, "claro")}
      {cara(paleta.oscuro, "oscuro")}
    </div>
  );
}

/**
 * `/admin/configuracion`: nombre, logo y color de acento de la academia.
 *
 * `guardarComunidad` escribe en `comunidades` y luego se recarga el armazón,
 * para que el cambio se vea en toda la app —incluido `MemberShell`, que lee
 * `colorAcento` como `--community-accent`— y no solo en esta pantalla. El
 * preview de aquí es local y en vivo, antes de guardar.
 */
export default function ConfiguracionPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();

  if (!hydrated) {
    return <ConfiguracionSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={Settings}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  return <ConfiguracionForm key={community.id} community={community} />;
}

function ConfiguracionForm({
  community,
}: {
  community: Community;
}) {
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);
  const [nombre, setNombre] = useState(community.nombre);
  const [slug, setSlug] = useState(community.slug);
  const [logoUrl, setLogoUrl] = useState(community.logoUrl);
  const [faviconUrl, setFaviconUrl] = useState(community.faviconUrl ?? "");
  const [colorAcento, setColorAcento] = useState(community.colorAcento);
  const [nombreIa, setNombreIa] = useState(community.nombreIa ?? "");
  const [avatarIa, setAvatarIa] = useState(community.avatarIa ?? "");
  const [videoAuth, setVideoAuth] = useState(community.marcaAuth?.videoUrl ?? "");
  const [posterAuth, setPosterAuth] = useState(community.marcaAuth?.posterUrl ?? "");

  async function handleGuardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.error("El nombre de la comunidad no puede estar vacío.");
      return;
    }
    const slugLimpio = slugDesde(slug);
    if (!slug.trim()) {
      toast.error("La dirección de la academia no puede estar vacía.");
      return;
    }

    try {
      const supabase = crearClienteNavegador();
      await guardarComunidad(supabase, community.id, {
        nombre: nombreLimpio,
        // Solo se manda si cambió: el trigger que lo congela compara con el
        // valor anterior, y reenviar el mismo no cuenta como cambio.
        ...(slugLimpio !== community.slug ? { slug: slugLimpio } : {}),
        logoUrl: logoUrl.trim(),
        faviconUrl: faviconUrl.trim(),
        colorAcento,
        nombreIa,
        avatarIa,
        marcaAuth: {
          videoUrl: videoAuth.trim() || undefined,
          posterUrl: posterAuth.trim() || undefined,
        },
      });
      // Recargar el armazón para que el nombre y el color nuevos se vean en
      // toda la app, no solo en esta pantalla.
      establecerArmazon(await cargarArmazon(supabase));
      toast.success("Configuración de la comunidad actualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Identidad de {community.nombre}: nombre, logo y color de acento.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Identidad de la comunidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="config-nombre">Nombre de la comunidad</Label>
            <Input
              id="config-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="config-slug">Dirección de tu academia</Label>
            <Input
              id="config-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Tus alumnos entran por{" "}
              <span className="font-mono text-foreground">
                /login/{slugDesde(slug) || "…"}
              </span>
              . Puedes cambiarla mientras no tengas alumnos; en cuanto entre el
              primero se queda fija, porque cambiarla rompería los enlaces que
              ya tengan guardados.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Logo</Label>
            <SubirImagen
              valor={logoUrl}
              onCambio={setLogoUrl}
              proporcion={1}
              anchoSalida={512}
              destino={{ tipo: "academia", comunidadId: community.id, uso: "logo" }}
              etiqueta="Subir el logo de la academia"
              ayuda="Cuadrado, 512 × 512. PNG con fondo transparente si puedes: se ve pequeño, así que un logo con texto fino no se leerá. Sin logo mostramos la inicial de tu academia."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Favicon</Label>
            <SubirImagen
              valor={faviconUrl}
              onCambio={setFaviconUrl}
              proporcion={1}
              anchoSalida={128}
              destino={{ tipo: "academia", comunidadId: community.id, uso: "favicon" }}
              etiqueta="Subir el favicon de la academia"
              ayuda="El icono de la pestaña del navegador. Se ve a 16 × 16, así que mejor un símbolo simple que un logo con texto. Si no subes ninguno, la pestaña usa tu logo."
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="config-ia">Nombre del asistente</Label>
            <Input
              id="config-ia"
              value={nombreIa}
              onChange={(e) => setNombreIa(e.target.value)}
              placeholder="Asistente"
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">
              Cómo se presenta la IA a tus alumnos en las clases donde la
              enciendas. Sin nombre propio se llama «Asistente».
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Cara del asistente</Label>
            <SubirImagen
              valor={avatarIa}
              onCambio={setAvatarIa}
              proporcion={1}
              anchoSalida={256}
              destino={{ tipo: "academia", comunidadId: community.id, uso: "logo" }}
              etiqueta="Subir la cara del asistente"
              ayuda="Cuadrada, 256 × 256. Se ve pequeña y en círculo, así que centra la cara. Sin foto se usa un icono."
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label>Portada de la pantalla de entrada</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lo que se ve a la izquierda cuando tus alumnos entran por{" "}
                <span className="font-mono">/login/{community.slug}</span>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="config-video">Vídeo (opcional)</Label>
              <Input
                id="config-video"
                value={videoAuth}
                onChange={(e) => setVideoAuth(e.target.value)}
                placeholder="https://…/portada.mp4"
              />
              <p className="text-xs text-muted-foreground">
                Enlace directo a un .mp4 o .webm. Se reproduce en bucle, sin
                sonido y sin controles, así que que sea corto y ligero.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Imagen de respaldo</Label>
              <SubirImagen
                valor={posterAuth}
                onCambio={setPosterAuth}
                proporcion={9 / 16}
                anchoSalida={1080}
                destino={{ tipo: "academia", comunidadId: community.id, uso: "auth" }}
                etiqueta="Subir la portada de la entrada"
                ayuda="Vertical 9:16, 1080 × 1920. Se ve mientras carga el vídeo, si falla, y a quien haya pedido menos animación. Sin ninguna de las dos, el degradado de tu color."
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2.5">
            <Label htmlFor="config-color">Color de acento</Label>
            <div className="flex items-center gap-3">
              <input
                id="config-color"
                type="color"
                value={colorAcento}
                onChange={(e) => setColorAcento(e.target.value)}
                className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                aria-label="Elegir color de acento personalizado"
              />
              <Input
                value={colorAcento}
                onChange={(e) => setColorAcento(e.target.value)}
                className="max-w-32 font-mono uppercase"
                aria-label="Código hexadecimal del color de acento"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORES_PRESET.map((preset) => (
                <button
                  key={preset.valor}
                  type="button"
                  onClick={() => setColorAcento(preset.valor)}
                  title={preset.nombre}
                  aria-label={`Usar acento ${preset.nombre}`}
                  className={`size-7 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110 ${
                    colorAcento.toLowerCase() === preset.valor.toLowerCase()
                      ? "ring-foreground"
                      : "ring-transparent"
                  }`}
                  style={{ backgroundColor: preset.valor }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preview en vivo</Label>
            <PreviewEncabezado nombre={nombre} logoUrl={logoUrl} colorAcento={colorAcento} />
            <PreviewInterfaz colorAcento={colorAcento} />
            <p className="text-xs text-muted-foreground">
              El tono es el tuyo; el brillo se ajusta solo para que el texto
              siempre se lea. El color exacto sale en tu logo y en la portada de
              tu entrada.
            </p>
          </div>

          <Button onClick={() => void handleGuardar()} size="lg">
            <Save /> Guardar cambios
          </Button>
        </CardContent>
      </Card>

      {/* Aparte de la tarjeta de identidad y con su propio guardado: cada
          plantilla se guarda sola, y meterlas en el mismo botón obligaría a
          escribir los tres correos antes de poder guardar el logo. */}
      <div className="mt-6">
        <CorreosDeLaAcademia
          comunidadId={community.id}
          academia={community.nombre}
          slug={community.slug}
        />
      </div>
    </div>
  );
}
