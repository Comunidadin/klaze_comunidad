// Service worker mínimo: existe para que el navegador considere la app
// instalable y dispare `beforeinstallprompt`. SIN manejador de `fetch` a
// propósito — no intercepta ni cachea nada, así que no puede servir contenido
// viejo ni romper un despliegue. Offline es otra función.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
