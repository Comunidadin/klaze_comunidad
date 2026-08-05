import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Configuración del adaptador de Cloudflare (OpenNext).
 *
 * Va sin `incrementalCache` a propósito: esta app no tiene ISR ni fetch
 * cacheado en servidor — todas las páginas son estáticas o se renderizan
 * por request, y el estado real vive en el `localStorage` del visitante
 * (ver `src/lib/store.ts`). Añadir el caché de R2 obligaría a crear un
 * bucket que nunca se escribiría.
 */
export default defineCloudflareConfig();
