import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "publico";

/**
 * Dónde va cada imagen. La **primera carpeta de la ruta es lo único** que dice
 * de quién es un archivo, así que estas dos formas no son cosmética: son lo que
 * comprueban las políticas de `storage.objects` (ver la migración
 * `politicas_de_almacenamiento`).
 */
export type DestinoImagen =
  | { tipo: "academia"; comunidadId: string; uso: "logo" | "portada" | "modulo" | "auth" }
  | { tipo: "avatar"; usuarioId: string };

function rutaDe(destino: DestinoImagen, extension: string): string {
  const nombre = `${crypto.randomUUID()}.${extension}`;
  return destino.tipo === "avatar"
    ? `avatares/${destino.usuarioId}/${nombre}`
    : `academias/${destino.comunidadId}/${destino.uso}/${nombre}`;
}

/**
 * Sube una imagen ya recortada y devuelve su URL pública.
 *
 * El recorte y la conversión a WebP ocurren antes, en el navegador (ver
 * `SubirImagen`): aquí llega un blob del tamaño final. Así nunca viaja un
 * archivo de 8 MB para acabar mostrándose a 300 píxeles.
 *
 * El bucket rechaza por su cuenta cualquier archivo de más de 5 MB o que no sea
 * imagen. Esa comprobación vive en el servidor, así que no depende de que el
 * navegador se porte bien.
 */
export async function subirImagen(
  supabase: SupabaseClient,
  destino: DestinoImagen,
  archivo: Blob,
  extension = "webp"
): Promise<string> {
  const ruta = rutaDe(destino, extension);

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type || "image/webp",
    // Sin `upsert`: cada imagen lleva un UUID nuevo, así que nunca hay colisión
    // y un fallo de nombre repetido sería una señal de que algo va mal.
    upsert: false,
  });

  if (error) {
    throw new Error(`No se pudo subir la imagen: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

/**
 * Borra una imagen anterior, si era nuestra.
 *
 * Es **mejor esfuerzo y nunca lanza**: se llama al reemplazar una imagen, y que
 * falle el borrado de la vieja no es razón para deshacer una subida que ya
 * salió bien. Peor sería lo contrario — enseñarle un error a alguien cuyo logo
 * nuevo ya está guardado.
 *
 * Ignora las URL externas: alguien pudo pegar una de Imgur antes de que esto
 * existiera, y no es nuestra para borrarla.
 */
export async function borrarImagen(
  supabase: SupabaseClient,
  url: string | undefined | null
): Promise<void> {
  if (!url) return;

  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i === -1) return;

  const ruta = decodeURIComponent(url.slice(i + marca.length));
  if (!ruta) return;

  await supabase.storage
    .from(BUCKET)
    .remove([ruta])
    .catch(() => {
      /* mejor esfuerzo: ver el docstring */
    });
}
