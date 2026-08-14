import type { Metadata } from "next";
import LoginPage from "../page";
import { estiloDeAcademia } from "@/lib/color-academia";
import { iconoDeMarca, leerMarcaServidor } from "@/lib/marca-servidor";

/**
 * La misma pantalla de entrada, pero sabiendo de qué academia se trata.
 *
 * `/login` a secas no pertenece a nadie, así que sale con la marca de Klaze.
 * `/login/mentoria-v7` sale con el nombre, el logo y el vídeo de esa academia
 * — es el enlace que se le manda a un alumno. Desde el servidor se añaden la
 * pestaña (título y favicon de la academia) y el `<style>` con su paleta, para
 * que el botón de entrar ya nazca de su color; el resto de la marca (vídeo,
 * logo del panel) lo sigue trayendo `useMarcaAuth` en el cliente.
 *
 * El formulario es el mismo componente: quien entra por aquí y quien entra por
 * el genérico hacen exactamente lo mismo, y duplicarlo habría garantizado que
 * uno de los dos se quedara atrás.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ academia: string }>;
}): Promise<Metadata> {
  const { academia } = await params;
  const marca = await leerMarcaServidor(academia);
  if (!marca?.nombre) return {};
  const icono = iconoDeMarca(marca);
  return {
    title: `Entrar — ${marca.nombre}`,
    ...(icono ? { icons: { icon: icono } } : {}),
  };
}

export default async function LoginDeAcademiaPage({
  params,
}: {
  params: Promise<{ academia: string }>;
}) {
  const { academia } = await params;
  const marca = await leerMarcaServidor(academia);
  const css = marca?.colorAcento ? estiloDeAcademia(marca.colorAcento) : "";

  return (
    <>
      {css ? <style>{css}</style> : null}
      <LoginPage />
    </>
  );
}
