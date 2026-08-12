"use client";

import { useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { ImageUp, Link2, Trash2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  subirImagen,
  borrarImagen,
  type DestinoImagen,
} from "@/lib/supabase/almacenamiento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** `true` si la URL no salió de nuestro almacén: alguien la pegó a mano. */
function esEnlaceExterno(url: string | undefined): boolean {
  return Boolean(url) && !url!.includes("/storage/v1/object/public/publico/");
}

/**
 * Lo que el bucket acepta. Se comprueba aquí para dar un error legible —la
 * comprobación de verdad la hace el bucket, que no depende de que el navegador
 * se porte bien.
 *
 * **Sin SVG, y a propósito.** Un SVG no es una imagen: es un documento XML que
 * puede llevar `<script>` dentro, y el bucket `publico` lo serviría con su tipo
 * real. No robaría la sesión de nadie —vive en el dominio de Supabase, otro
 * origen—, pero sí permitiría alojar una página que ejecuta código en un
 * dominio que los alumnos reconocen como del sitio.
 *
 * No se pierde nada: aquí se recorta y se convierte a WebP antes de subir, así
 * que ningún camino real subía un SVG.
 */
const TIPOS = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export interface SubirImagenProps {
  /** URL actual, si ya hay una. Puede ser externa (pegada a mano). */
  valor?: string;
  onCambio: (url: string) => void;
  /** Proporción del recorte: 1 cuadrado, 2/3 vertical, 16/9, 3/1… */
  proporcion: number;
  destino: DestinoImagen;
  /** Ancho final en píxeles. El alto sale de `proporcion`. */
  anchoSalida: number;
  etiqueta: string;
  /** Qué subir, en cristiano: "512 × 512, PNG con fondo transparente". */
  ayuda?: string;
  className?: string;
}

/** Carga la imagen elegida para poder dibujarla en un canvas. */
function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.addEventListener("load", () => resolver(img));
    img.addEventListener("error", () => rechazar(new Error("No se pudo leer la imagen")));
    img.src = url;
  });
}

/**
 * Recorta en un `canvas` y devuelve WebP.
 *
 * El tamaño de salida es fijo, no el del recorte: si alguien sube una foto de
 * 6000 píxeles de ancho para un logo que se ve a 32, no tiene sentido guardar
 * los 6000. WebP suele pesar la mitad que el JPEG equivalente.
 */
async function recortar(
  origen: string,
  area: Area,
  anchoSalida: number,
  proporcion: number
): Promise<Blob> {
  const img = await cargarImagen(origen);
  const canvas = document.createElement("canvas");
  canvas.width = anchoSalida;
  canvas.height = Math.round(anchoSalida / proporcion);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite recortar imágenes aquí");

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolver, rechazar) => {
    canvas.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo generar la imagen"))),
      "image/webp",
      0.9
    );
  });
}

/**
 * Elegir archivo → encuadrar → subir. Devuelve la URL pública por `onCambio`.
 *
 * Sustituye a las casillas que pedían pegar un `https://`. Aquel diseño venía
 * de cuando las imágenes salían de Unsplash: a un creador que quiere vender
 * cursos no se le puede pedir que primero encuentre dónde alojar su logo.
 *
 * El recorte va aquí y no en el servidor porque el navegador ya tiene la
 * imagen: subir 8 MB para devolver 300 KB sería pagar dos veces por lo mismo.
 */
export function SubirImagen({
  valor,
  onCambio,
  proporcion,
  destino,
  anchoSalida,
  etiqueta,
  ayuda,
  className,
}: SubirImagenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [origen, setOrigen] = useState<string | null>(null);
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  // Pegar un enlace sigue siendo válido: mucha gente ya aloja sus imágenes en
  // su propia web y obligarla a resubirlas sería quitarle algo que funcionaba.
  // Va plegado porque es el camino menos común —pero abierto de entrada si el
  // valor actual ES un enlace externo, o quedaría escondido detrás de un botón
  // y parecería que se ha perdido.
  const [enlaceAbierto, setEnlaceAbierto] = useState(() => esEnlaceExterno(valor));

  function elegir(archivo: File | undefined) {
    if (!archivo) return;

    if (!TIPOS.includes(archivo.type)) {
      toast.error("Tiene que ser una imagen PNG, JPG, WEBP o SVG.");
      return;
    }
    if (archivo.size > MAX_BYTES) {
      const mb = (archivo.size / 1024 / 1024).toFixed(1);
      toast.error(`La imagen pesa ${mb} MB y el máximo son 5 MB.`);
      return;
    }

    setPosicion({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setOrigen(URL.createObjectURL(archivo));
  }

  function cerrar() {
    // `createObjectURL` reserva memoria hasta que se revoca: sin esto, cada
    // imagen que alguien abre y descarta se queda dentro de la pestaña.
    if (origen) URL.revokeObjectURL(origen);
    setOrigen(null);
    setSubiendo(false);
  }

  async function confirmar() {
    if (!origen || !area) return;

    setSubiendo(true);
    try {
      const blob = await recortar(origen, area, anchoSalida, proporcion);
      const url = await subirImagen(crearClienteNavegador(), destino, blob);

      // Primero la nueva, después borrar la vieja: si se hiciera al revés y
      // fallara la subida, se habría perdido la única imagen que había.
      const anterior = valor;
      onCambio(url);
      setEnlaceAbierto(false);
      cerrar();
      void borrarImagen(crearClienteNavegador(), anterior);

      toast.success("Imagen actualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen");
      setSubiendo(false);
    }
  }

  return (
    <div className={cn("relative space-y-2", className)}>
      <div className="flex items-center gap-3">
        <div
          className="relative shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10"
          style={{ width: 72, height: Math.round(72 / proporcion) }}
        >
          {valor ? (
            /* eslint-disable-next-line @next/next/no-img-element -- imagen del creador, dominio arbitrario */
            <img src={valor} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageUp className="size-5" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <ImageUp /> {valor ? "Cambiar" : "Subir imagen"}
          </Button>
          {valor && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const anterior = valor;
                onCambio("");
                void borrarImagen(crearClienteNavegador(), anterior);
              }}
            >
              <Trash2 /> Quitar
            </Button>
          )}
        </div>

        {/* Oculto a la vista pero PRESENTE en el layout: con `display:none`,
            `.click()` no dispara de forma fiable dentro de una ventana modal,
            que es justo donde vive el formulario de curso nuevo. */}
        <input
          ref={inputRef}
          type="file"
          accept={TIPOS.join(",")}
          className="absolute size-px overflow-hidden opacity-0"
          tabIndex={-1}
          aria-label={etiqueta}
          onChange={(e) => {
            elegir(e.target.files?.[0]);
            // Se limpia para que elegir el MISMO archivo otra vez vuelva a
            // disparar el evento; si no, cancelar y reintentar no hace nada.
            e.target.value = "";
          }}
        />
      </div>

      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}

      {enlaceAbierto ? (
        <div className="space-y-1.5">
          <Input
            value={valor ?? ""}
            onChange={(e) => onCambio(e.target.value.trim())}
            placeholder="https://tu-web.com/imagen.jpg"
            aria-label={`${etiqueta}: pegar un enlace`}
            className="h-8 text-xs"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Enlace directo al archivo (.jpg o .png). Los de Drive y Dropbox no
            sirven. No pasa por el encuadre: se recorta centrado.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEnlaceAbierto(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="size-3.5" /> O pegar un enlace
        </button>
      )}

      {origen && (
        /* El encuadre se abre AQUÍ, no en una ventana. La versión anterior era
           un `Dialog`, y el formulario de curso nuevo ya es uno: dos modales
           anidados se pelean por el foco y el de dentro quedaba muerto. Abrir
           en el sitio funciona igual dentro de una ventana que fuera. */
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Encuadra la imagen</p>
            <p className="text-xs text-muted-foreground">
              Arrastra para mover y usa la barra para acercar. Lo que quede
              dentro del recuadro es lo que se verá.
            </p>
          </div>

          <div className="relative h-64 w-full overflow-hidden rounded-lg bg-black">
            <Cropper
              image={origen}
              crop={posicion}
              zoom={zoom}
              aspect={proporcion}
              onCropChange={setPosicion}
              onZoomChange={setZoom}
              onCropComplete={(_, pixeles) => setArea(pixeles)}
            />
          </div>

          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.05}
            onValueChange={([v]) => setZoom(v)}
            aria-label="Acercar"
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cerrar} disabled={subiendo}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmar()}
              disabled={subiendo || !area}
            >
              {subiendo ? "Subiendo…" : "Usar esta imagen"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
