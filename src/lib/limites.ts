import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Topes de uso para lo que gasta dinero o manda correo.
 *
 * El contador vive en Postgres (`consumir_limite`), no aquí: en el Worker no
 * hay memoria que sobreviva entre peticiones, y aunque la hubiera, Cloudflare
 * levanta instancias en varios sitios a la vez. Un contador por instancia
 * multiplicaría el tope por el número de instancias sin que nadie se enterara.
 *
 * **Recibe el cliente admin.** `consumir_limite` no se puede llamar desde el
 * navegador —está revocada— porque quien pudiera llamarla gastaría el tope de
 * otro con solo saber su correo.
 */

/**
 * Los números, todos juntos y a la vista.
 *
 * Están elegidos para que una persona real nunca los toque. Quien de verdad
 * olvida su contraseña lo intenta dos o tres veces, no cinco; una academia que
 * da de alta a 50 alumnos en un día está teniendo un buen día, no un problema.
 * Si alguno empieza a saltar de verdad, es información de negocio antes que de
 * seguridad.
 */
export const TOPES = {
  /** Correos de recuperación por dirección y día. */
  recuperarEmail: 5,
  /** Correos de recuperación por IP y día — el freno al bucle. */
  recuperarIp: 20,
  /** Invitaciones que una academia manda al día. */
  invitaciones: 50,
} as const;

/**
 * Cuántas recepciones admite un enlace de venta al día, según lo que reparta.
 *
 * Vive aquí y no en `compras.ts` —donde estaría más a mano— porque el panel
 * del súper enlace lo enseña, y ese componente corre en el navegador:
 * importarlo desde `compras.ts` arrastraría al bundle la lectura de variables
 * de servidor. Un número que se enseña tiene que poder viajar.
 *
 * Los dos salen de la misma pregunta —"¿cuánto daño hace un día malo antes de
 * que alguien lo vea?"— y dan respuestas muy distintas:
 *
 * - `academia`: 200. Un lanzamiento de verdad mete cientos de alumnos en unas
 *   horas, y cortar una venta legítima es peor que colar a alguien de más.
 * - `plataforma`: 5. Cada recepción aquí **crea una academia entera** con su
 *   cuenta de creador. 200 al día no era un tope, era un techo de sala: quien
 *   se hiciera con esa URL podía fabricar 200 inquilinos antes de que te
 *   dieras cuenta. Vendiendo Klaze a mano, cinco altas en un día ya es un día
 *   excepcional; el día que sean pocas, se sube este número y ya está.
 */
export const TOPE_DIARIO: Record<"academia" | "plataforma", number> = {
  academia: 200,
  plataforma: 5,
};

export type Ambito =
  | "recuperar_email"
  | "recuperar_ip"
  | "invitaciones"
  /** Un enlace de venta, con su tope en `TOPE_DIARIO` según el tipo. */
  | "canal";

/**
 * Consume un uso. `true` si estaba permitido, `false` si se pasó del tope.
 *
 * **Ante un fallo devuelve `true`, es decir, deja pasar.** Es la decisión
 * incómoda de este archivo y va explicada: si la base no contesta, la
 * alternativa es que nadie pueda recuperar su contraseña ni invitar a nadie.
 * Un tope caído durante un incidente de base de datos es un problema; una
 * plataforma entera bloqueada por el mismo incidente es otro más grande.
 */
export async function consumir(
  admin: SupabaseClient,
  ambito: Ambito,
  clave: string,
  tope: number
): Promise<boolean> {
  const { data, error } = await admin.rpc("consumir_limite", {
    p_ambito: ambito,
    p_clave: clave,
    p_tope: tope,
  });

  if (error) {
    console.error(`No se pudo consumir el tope ${ambito}:`, error.message);
    return true;
  }

  return data !== false;
}

/**
 * De quién viene la petición, para contar por origen.
 *
 * `cf-connecting-ip` primero porque en Cloudflare es la única que el visitante
 * no puede falsificar: la pone el borde, pisando lo que trajera. `x-forwarded-for`
 * va detrás y **solo su primer tramo**, que es lo más cercano al cliente real.
 *
 * Sin ninguna de las dos devuelve `"desconocida"`, que agrupa a todos esos bajo
 * un mismo cubo. Es lo correcto: si no se puede distinguir de dónde viene, lo
 * prudente es tratarlo como si viniera todo del mismo sitio.
 */
export function ipDe(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }

  return "desconocida";
}
