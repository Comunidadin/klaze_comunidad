import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Configuración del adaptador de Cloudflare (OpenNext).
 *
 * Va sin `incrementalCache` a propósito: esta app no tiene ISR ni fetch
 * cacheado en servidor. Todas las páginas se renderizan por request y los
 * datos salen de Postgres con la sesión de quien mira, así que no hay nada
 * compartido que cachear: el caché de R2 obligaría a crear un bucket que
 * nunca se escribiría.
 */
export default defineCloudflareConfig();
