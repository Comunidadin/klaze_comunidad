import type { NextConfig } from "next";

/**
 * La CSP, en modo aviso.
 *
 * Va en `Content-Security-Policy-Report-Only` y no en la de verdad, y es una
 * decisión deliberada: una clase puede insertar un formulario de cualquier
 * servicio y mostrar imágenes de cualquier dominio, así que una CSP demasiado
 * estrecha rompe clases **en silencio** — el alumno ve un hueco en blanco y
 * nadie se entera hasta que se queja. En modo aviso, el navegador la comprueba
 * y la anota en su consola sin bloquear nada, que es lo que hace falta para
 * saber qué haría antes de dejarla mandar.
 *
 * `img-src` y `frame-src` abiertos porque ese es el producto: el creador pega
 * el enlace de su imagen y el código de su formulario, y los dominios de sus
 * herramientas no se pueden conocer al compilar.
 *
 * Lo que sí aprieta desde ya, porque son las que de verdad tapan algo:
 * `object-src 'none'` (nada de Flash ni de `<embed>` con contenido pegado),
 * `base-uri 'self'` (que un `<base>` inyectado no redirija todas las rutas
 * relativas a otro dominio) y `form-action 'self'` (que un formulario inyectado
 * no publique las credenciales de nadie fuera).
 *
 * `'unsafe-inline'` y `'unsafe-eval'` en `script-src` están porque Next los
 * necesita para hidratar. Quitarlos exige nonces por petición, que es trabajo
 * de verdad y no cabe aquí.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src https:",
  "media-src 'self' https: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Sin `images.remotePatterns` a propósito: ningún componente usa
  // `next/image`. Las portadas y los logos los sube cada creador desde
  // dominios que no podemos conocer de antemano, así que van en `<img>`
  // normales — con `next/image` habría que ir añadiendo el dominio de cada
  // cliente a mano, y hasta hacerlo sus imágenes fallarían con un 400.

  /**
   * Las cabeceras que faltaban por completo.
   *
   * Estas cuatro se pueden poner hoy sin romper nada, y una de ellas tapa algo
   * concreto: sin `frame-ancestors` / `X-Frame-Options`, el panel se puede
   * meter en un iframe ajeno con botones invisibles encima. Bastan un par de
   * clics de un dueño que cree estar en otra página para eliminar un módulo o
   * suspender a un alumno.
   *
   * `Permissions-Policy` apaga cámara, micrófono y geolocalización: nada de la
   * aplicación los usa, y un embed que los pida no debería poder ni preguntar.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: CSP },
          // Duplica `frame-ancestors` para los navegadores que aún no lo leen
          // de la CSP. Y aquí sí bloquea de verdad, porque no va en el
          // encabezado de solo aviso.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // HSTS: un año, subdominios incluidos. Cloudflare ya sirve todo por
          // https, así que esto no puede dejar a nadie fuera — lo que hace es
          // que el navegador no vuelva a intentar http ni la primera vez.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
