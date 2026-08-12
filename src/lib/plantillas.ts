import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Los correos que salen a los alumnos, redactados por el dueño de su academia.
 *
 * Tres decisiones que explican casi todo lo de abajo:
 *
 * 1. **El cuerpo es texto plano, no HTML.** Se escribe en un `<textarea>` y se
 *    escapa entero antes de armar el correo. Aceptar HTML significaría que un
 *    `<div>` sin cerrar rompe el correo de todos sus compradores — y el dueño
 *    no se enteraría, porque el suyo de prueba llega bien.
 *
 * 2. **El bloque de acceso no se edita.** Las credenciales, el enlace y el
 *    aviso de caducidad los añade Klaze detrás del cuerpo. Si fueran editables,
 *    quien borrara sin querer la línea de la contraseña dejaría a cada
 *    comprador con una bienvenida sin forma de entrar.
 *
 * 3. **Sin condicionales ni bucles.** Solo sustitución de etiquetas. Un
 *    lenguaje de plantillas dentro de un `<textarea>` es una fuente de fallos
 *    que solo se ven en el correo de un cliente, cuando ya salió.
 */

export type TipoPlantilla = "bienvenida" | "recuperacion" | "baja";

export interface Plantilla {
  asunto: string;
  cuerpo: string;
}

export interface DatosPlantilla {
  academia: string;
  correo: string;
  /** Puede venir vacío: a un alumno invitado solo por correo no se le sabe. */
  nombre?: string;
}

export const TIPOS: TipoPlantilla[] = ["bienvenida", "recuperacion", "baja"];

/**
 * Las etiquetas que se pueden escribir en el asunto y en el cuerpo.
 *
 * `{{enlace}}` NO está, y es a propósito: el enlace vive en el bloque de acceso
 * que añade Klaze. Si se pudiera escribir suelto en el cuerpo habría que
 * decidir si sale como texto o como botón, y un enlace pegado como texto plano
 * dentro de un correo HTML es exactamente lo que los clientes de correo
 * rompen.
 */
export const ETIQUETAS = ["{{academia}}", "{{nombre}}", "{{correo}}"] as const;

export const PLANTILLAS_POR_DEFECTO: Record<TipoPlantilla, Plantilla> = {
  bienvenida: {
    asunto: "Tu acceso a {{academia}}",
    cuerpo:
      "Hola {{nombre}}:\n\n" +
      "Ya tienes acceso a {{academia}}. Abajo están tus datos para entrar.\n\n" +
      "Nos vemos dentro.",
  },
  recuperacion: {
    asunto: "Recupera tu acceso a {{academia}}",
    cuerpo:
      "Hola:\n\n" +
      "Pediste una contraseña nueva para entrar en {{academia}}. " +
      "Elígela desde el enlace de abajo.\n\n" +
      "Si no has sido tú, ignora este correo: tu contraseña actual sigue funcionando.",
  },
  baja: {
    asunto: "Tu acceso a {{academia}} está pausado",
    cuerpo:
      "Hola {{nombre}}:\n\n" +
      "Tu acceso a {{academia}} está pausado por ahora. No se ha borrado nada: " +
      "tus clases y tu progreso siguen donde estaban, y vuelven en cuanto se reactive.\n\n" +
      "Si crees que es un error, responde a este correo.",
  },
};

/** Qué es cada correo y cuándo sale, para el editor del panel. */
export const DESCRIPCIONES: Record<TipoPlantilla, { titulo: string; cuando: string }> = {
  bienvenida: {
    titulo: "Bienvenida",
    cuando:
      "Sale en cuanto alguien recibe acceso: lo invites tú desde Accesos o lo compre por un enlace de venta.",
  },
  recuperacion: {
    titulo: "Recuperar contraseña",
    cuando:
      "Sale cuando un alumno pulsa «¿Olvidaste tu contraseña?» en la pantalla de entrada de tu academia.",
  },
  baja: {
    titulo: "Acceso pausado",
    cuando:
      "Sale cuando suspendes a un alumno, o cuando llega una baja por el enlace de venta.",
  },
};

/**
 * Escapa lo que va a acabar dentro de HTML.
 *
 * Hace falta en los dos lados. El cuerpo, porque es texto plano y un `<` suelto
 * se comería el resto del párrafo. Y los valores, porque `{{nombre}}` viene del
 * formulario de otra aplicación: quien se registre como `<script>…` no puede
 * acabar ejecutando nada en el buzón de nadie.
 *
 * Se exporta para los correos que todavía se arman a mano con plantillas de
 * texto —los de `/api/plataforma`, que no pasan por `componerCorreo`— y no
 * pueden quedarse fuera de esta regla solo por escribirse en otro archivo.
 */
export function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sustituye las etiquetas de `texto` por sus valores.
 *
 * `escapa` va aparte porque el asunto de un correo NO es HTML: escaparlo
 * dejaría un `&amp;` a la vista en la bandeja de entrada.
 */
export function render(
  texto: string,
  datos: DatosPlantilla,
  escapa: boolean
): string {
  // Sin nombre, la parte de delante del correo. Una plantilla que empieza por
  // "Hola {{nombre}}:" no puede quedarse en "Hola :" — y el dueño no lo vería
  // nunca, porque él sí tiene nombre.
  const nombre = datos.nombre?.trim() || datos.correo.split("@")[0] || "hola";

  const valores: Record<string, string> = {
    "{{academia}}": datos.academia,
    "{{nombre}}": nombre,
    "{{correo}}": datos.correo,
  };

  const base = escapa ? escapar(texto) : texto;

  return Object.entries(valores).reduce(
    (acc, [etiqueta, valor]) =>
      acc.split(etiqueta).join(escapa ? escapar(valor) : valor),
    base
  );
}

/** Texto plano → párrafos. Los saltos sueltos se respetan como `<br>`. */
function aParrafos(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.split("\n").join("<br>")}</p>`)
    .join("\n");
}

/**
 * El correo listo para `enviarCorreo`: asunto y HTML.
 *
 * `bloque` es HTML de confianza, armado por Klaze (las credenciales, el botón
 * de recuperación). Va detrás del cuerpo, y no pasa por el escapador porque no
 * lo escribió nadie desde un navegador.
 */
export function componerCorreo(
  plantilla: Plantilla,
  datos: DatosPlantilla,
  bloque = ""
): { asunto: string; html: string } {
  return {
    asunto: render(plantilla.asunto, datos, false),
    html: aParrafos(render(plantilla.cuerpo, datos, true)) + bloque,
  };
}

const GRIS = 'style="color:#666;font-size:13px"';

/**
 * El bloque de acceso que Klaze añade al final de la bienvenida.
 *
 * No es editable, y esa es su razón de ser: lleva las credenciales. Si el dueño
 * pudiera borrarlo sin querer, cada comprador recibiría una bienvenida cordial
 * y ninguna forma de entrar.
 *
 * Se exporta para que el editor pueda **enseñarlo** debajo del cuadro de texto:
 * quien redacta tiene que ver qué se añade solo, o escribirá otra vez la
 * contraseña por su cuenta.
 */
export function bloqueAcceso(o: {
  loginUrl: string;
  correo: string;
  /** `null` si esa persona ya tenía cuenta: no se le cambia la contraseña. */
  password: string | null;
}): string {
  // La URL se escapa aunque la arme Klaze, y no es paranoia de manual: lleva
  // dentro el identificador de la academia, que hasta hoy se podía guardar con
  // cualquier carácter haciendo un `PATCH` directo a Supabase. Con unas
  // comillas ahí, el dueño inyectaba HTML en el bloque que este correo presenta
  // como el de confianza.
  //
  // La base ya no lo permite (`comunidades_slug_formato`), y aun así se escapa:
  // lo que entra en un atributo se escapa, sin averiguar cada vez de dónde
  // venía. Averiguarlo es justo lo que se hace mal el día que cambia el origen.
  const url = escapar(o.loginUrl);
  const entrar = `<p>Entra en <a href="${url}">${url}</a></p>`;

  if (!o.password) {
    return (
      entrar +
      `\n<p ${GRIS}>Ya tenías cuenta, así que usa tu contraseña de siempre. ` +
      `Si no la recuerdas, pulsa «¿Olvidaste tu contraseña?» en esa misma pantalla.</p>`
    );
  }

  return (
    entrar +
    `\n<p>Correo: <strong>${escapar(o.correo)}</strong><br>` +
    `Contraseña: <strong style="font-family:monospace">${escapar(o.password)}</strong></p>` +
    `\n<p ${GRIS}>Puedes cambiarla cuando quieras desde tu perfil.</p>`
  );
}

/** El botón de «elegir contraseña nueva», con su aviso de caducidad. */
export function bloqueRecuperacion(enlace: string): string {
  return (
    `<p><a href="${escapar(enlace)}">Elegir contraseña nueva</a></p>` +
    `\n<p ${GRIS}>El enlace caduca en una hora.</p>`
  );
}

/**
 * La plantilla de esa academia, o la de por defecto.
 *
 * Se le pasa el cliente **admin**: quien llama a esto es un Route Handler que
 * ya decidió que hay que mandar el correo, y RLS no tiene nada que aportar.
 *
 * Nunca lanza. Un fallo leyendo la plantilla no puede impedir que salga el
 * correo de acceso de alguien que ya pagó: se cae a la de por defecto.
 */
export async function leerPlantilla(
  admin: SupabaseClient,
  comunidadId: string,
  tipo: TipoPlantilla
): Promise<Plantilla> {
  const porDefecto = PLANTILLAS_POR_DEFECTO[tipo];

  try {
    const { data } = await admin
      .from("plantillas_correo")
      .select("asunto, cuerpo")
      .eq("comunidad_id", comunidadId)
      .eq("tipo", tipo)
      .maybeSingle();

    if (!data) return porDefecto;

    // Campo vacío = el de por defecto. Guardar un asunto en blanco manda un
    // correo sin asunto, que muchos filtros tratan como correo basura.
    return {
      asunto: data.asunto?.trim() || porDefecto.asunto,
      cuerpo: data.cuerpo?.trim() || porDefecto.cuerpo,
    };
  } catch {
    return porDefecto;
  }
}
