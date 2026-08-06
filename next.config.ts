import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin `images.remotePatterns` a propósito: ningún componente usa
  // `next/image`. Las portadas y los logos los sube cada creador desde
  // dominios que no podemos conocer de antemano, así que van en `<img>`
  // normales — con `next/image` habría que ir añadiendo el dominio de cada
  // cliente a mano, y hasta hacerlo sus imágenes fallarían con un 400.
};

export default nextConfig;
