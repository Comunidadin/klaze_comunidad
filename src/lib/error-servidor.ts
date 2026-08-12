/**
 * Lo que un fallo del servidor le cuenta a quien lo provocó.
 *
 * La respuesta corta: nada. El detalle se registra y sale un texto fijo.
 *
 * Devolver `e.message` es cómodo mientras desarrollas y una fuga cuando el
 * proyecto sale a internet: los errores de Postgres traen nombres de columna,
 * de restricción y de tabla, y los de Supabase traen la forma de la consulta.
 * Con eso se dibuja el esquema desde fuera sin acceso a nada.
 *
 * Dónde se nota más: los dos enlaces de venta. Ahí quien recibe la respuesta es
 * **cualquiera que haga el POST** —no hay sesión, solo el token—, así que el
 * error interno viajaba a un desconocido. Y el dueño no lo necesitaba: su
 * detalle sigue yendo a `recepciones_canal`, que es lo que lee en el panel
 * cuando quiere saber por qué alguien no entró.
 *
 * `console.error` y no un servicio de registro porque hoy no hay ninguno; en
 * Cloudflare esto acaba en `wrangler tail`. El día que haya uno, se cambia aquí
 * y no en cinco sitios.
 */
export function registrarFallo(donde: string, e: unknown): void {
  console.error(`[${donde}]`, e instanceof Error ? (e.stack ?? e.message) : e);
}

/**
 * Registra el fallo y devuelve el texto que sí puede salir por HTTP.
 *
 * Se escribe en una línea en el `catch` para que sea más corto hacerlo bien que
 * hacerlo mal — que es la única forma de que se siga haciendo bien.
 */
export function fallo(donde: string, e: unknown, publico: string): string {
  registrarFallo(donde, e);
  return publico;
}

/**
 * El detalle, para el registro de recepciones de un enlace de venta.
 *
 * Ese registro sí lleva el mensaje entero, y es correcto: lo lee el dueño del
 * canal en su panel, autenticado, y es justo lo que necesita para averiguar por
 * qué un comprador no entró. Lo que no puede es viajar en la respuesta HTTP.
 */
export function detalleParaRegistro(e: unknown): string {
  return e instanceof Error ? e.message : "Error desconocido";
}
