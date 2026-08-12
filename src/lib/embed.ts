/**
 * De lo que el creador pega, a una dirección que se puede insertar.
 *
 * Acepta las dos formas en que la gente copia un embed —el código `<iframe>`
 * entero o solo el enlace— porque obligar a extraer el `src` a mano es pedirle
 * a alguien que no programa que edite HTML.
 *
 * Lo que NUNCA hace es conservar el código pegado. De un `<iframe>` se saca la
 * dirección y se tira el resto: un bloque copiado de cualquier sitio puede
 * traer un `<script>` detrás, y ese script correría en el navegador de los
 * alumnos con su sesión abierta. Un creador con la cuenta robada podría
 * robarles a todos.
 */

/** Servicios cuyo enlace normal NO se puede insertar tal cual. */
const CONVERSIONES: { patron: RegExp; a: (m: RegExpMatchArray) => string }[] = [
  // YouTube: watch?v= y youtu.be no funcionan dentro de un marco.
  {
    patron: /^https?:\/\/(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([\w-]+)/i,
    a: (m) => `https://www.youtube.com/embed/${m[1]}`,
  },
  { patron: /^https?:\/\/youtu\.be\/([\w-]+)/i, a: (m) => `https://www.youtube.com/embed/${m[1]}` },
  // Google Forms: el enlace para compartir termina en /viewform.
  {
    patron: /^(https?:\/\/docs\.google\.com\/forms\/[^\s"']*\/viewform)/i,
    a: (m) => `${m[1]}?embedded=true`,
  },
  // Loom: /share/ no se inserta, /embed/ sí.
  {
    patron: /^https?:\/\/(?:www\.)?loom\.com\/share\/([\w-]+)/i,
    a: (m) => `https://www.loom.com/embed/${m[1]}`,
  },
];

/**
 * Devuelve la dirección lista para insertar, o `null` si lo pegado no sirve.
 *
 * `null` es una respuesta útil: la pantalla lo usa para decir "esto no parece
 * un embed" en vez de guardar algo que luego aparece en blanco.
 */
/**
 * `true` si la dirección apunta a la propia Klaze.
 *
 * El marco de un embed lleva `allow-scripts` y `allow-same-origin`, que juntos
 * son inofensivos mientras lo de dentro sea de OTRO dominio: entonces corre en
 * su origen y no puede tocar la página que lo contiene. Con una dirección
 * nuestra deja de serlo — un documento del mismo origen con esos dos permisos
 * puede alcanzar la página de fuera, y el aislamiento del marco desaparece.
 *
 * Insertar una página de Klaze dentro de una clase no sirve para nada legítimo,
 * así que se rechaza y no se pierde ningún caso de uso.
 *
 * En el servidor no hay `window` y devuelve `false`: aquí eso es correcto,
 * porque quien decide es el editor, que corre en el navegador y sí lo sabe.
 */
function esNuestroOrigen(url: URL): boolean {
  if (typeof window === "undefined") return false;
  return url.host === window.location.host;
}

export function urlDeEmbed(pegado: string): string | null {
  const texto = pegado.trim();
  if (!texto) return null;

  // ¿Es código de inserción? Se saca el src y se descarta todo lo demás.
  const src = texto.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  const candidato = src ? src[1] : texto;

  // Solo http(s). `javascript:` y `data:` ejecutan código al cargarse.
  if (!/^https?:\/\//i.test(candidato)) return null;

  let url: URL;
  try {
    url = new URL(candidato);
  } catch {
    return null;
  }

  if (esNuestroOrigen(url)) return null;

  for (const { patron, a } of CONVERSIONES) {
    const m = url.href.match(patron);
    if (m) return a(m);
  }

  return url.href;
}

/** La versión pública de la comprobación, para quien pinta el marco. */
export function esEmbedDeFuera(href: string): boolean {
  try {
    return !esNuestroOrigen(new URL(href));
  } catch {
    return false;
  }
}

/**
 * Por qué eso concreto no sirve, cuando se puede decir algo mejor que «no vale».
 *
 * Existe por un error que ya se cometió aquí: el fragmento que Typeform da por
 * defecto es un `<div data-tf-live="01J…">` más un `<script>`, y se dio por
 * hecho que ese identificador serviría como `form.typeform.com/to/{id}`. No
 * sirve — Typeform responde con una redirección a su propia web marcada como
 * `typeform-incorrectURL`, así que la clase acababa mostrando el anuncio de
 * Typeform en vez del formulario. Y encima en silencio, que es lo peor: quien
 * lo pegó veía «Contenido insertado» y se iba tranquilo.
 *
 * Ese identificador solo lo sabe resolver el script de Typeform, y aquí no se
 * ejecuta ningún script de fuera. La dirección buena existe, pero está en otro
 * sitio de Typeform —la pestaña de compartir— y lo único honesto es decir
 * dónde.
 */
export function pistaDeEmbed(pegado: string): string | null {
  if (typeof window !== "undefined" && pegado.includes(window.location.host)) {
    return (
      "Esa dirección es de la propia Klaze, y una clase no se puede insertar " +
      "dentro de otra: el marco dejaría de estar aislado. Si querías enlazar a " +
      "otra clase, pega el enlace en un bloque de texto."
    );
  }

  if (/data-tf-(?:live|widget|popup|sidetab|popover)/i.test(pegado)) {
    return (
      "Ese código de Typeform lleva un identificador que solo entiende su " +
      "propio script. En Typeform, abre tu formulario → Share (Compartir) y " +
      "copia el enlace de ahí: es un form.typeform.com/to/ con un código corto."
    );
  }

  if (/<script/i.test(pegado)) {
    return (
      "Eso es un script, y Klaze no ejecuta scripts de fuera: correrían en el " +
      "navegador de tus alumnos con su sesión abierta. Busca en ese servicio " +
      "la opción de compartir por enlace, o el código <iframe>."
    );
  }

  return null;
}

/** Alto por defecto según el servicio: un calendario y un vídeo no piden lo mismo. */
export function altoSugerido(url: string): number {
  if (/youtube\.com|vimeo\.com|loom\.com/i.test(url)) return 420;
  if (/calendly\.com/i.test(url)) return 700;
  if (/docs\.google\.com\/forms|typeform\.com/i.test(url)) return 640;
  if (/discord\.com/i.test(url)) return 500;
  return 480;
}
