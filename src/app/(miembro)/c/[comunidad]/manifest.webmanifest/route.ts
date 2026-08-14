import { iconoDeMarca, leerMarcaServidor } from "@/lib/marca-servidor";

/**
 * El manifest PWA DE CADA ACADEMIA.
 *
 * «Añadir a pantalla de inicio» desde `/c/vivir-de-ia` instala una app que se
 * llama Vivir de IA, con su icono y su color — no una app "Klaze". El
 * `start_url` cae en sus módulos y `display: standalone` quita la barra del
 * navegador. Un manifest global no puede hacer esto: el nombre y el icono son
 * por academia, así que la ruta vive bajo su slug.
 *
 * Sin service worker a propósito: para instalarse y abrir a pantalla completa
 * no hace falta; offline es otra función.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ comunidad: string }> }
) {
  const { comunidad } = await params;
  const marca = await leerMarcaServidor(comunidad);
  if (!marca?.nombre) {
    return new Response("No encontrada", { status: 404 });
  }

  const icono = iconoDeMarca(marca);
  const acento = marca.colorAcento ?? "#0073B0";

  const manifest = {
    name: marca.nombre,
    short_name: marca.nombre.length > 12 ? marca.nombre.slice(0, 12) : marca.nombre,
    start_url: `/c/${comunidad}/cursos`,
    scope: `/c/${comunidad}/`,
    display: "standalone",
    background_color: "#16181c",
    theme_color: acento,
    icons: icono
      ? [
          // El mismo archivo declarado en los dos tamaños que Android pide:
          // no generamos variantes, el navegador lo escala.
          { src: icono, sizes: "192x192", type: "image/png" },
          { src: icono, sizes: "512x512", type: "image/png" },
        ]
      : [],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
