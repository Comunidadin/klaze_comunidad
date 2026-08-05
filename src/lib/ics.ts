import type { CommunityEvent } from "@/lib/types";

/** `YYYYMMDDTHHMMSSZ` en UTC, como exige RFC 5545 para DTSTART/DTEND/DTSTAMP. */
function formatFechaICS(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Escapa `\`, `;`, `,` y saltos de línea en campos de texto (RFC 5545 §3.3.11). */
function escaparTextoICS(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Genera el contenido completo de un archivo .ics (un solo VEVENT) para un evento de comunidad. */
export function generarICS(evento: CommunityEvent): string {
  const inicio = new Date(evento.fechaInicio);
  const fin = new Date(inicio.getTime() + evento.duracionMin * 60_000);
  const ahora = new Date();

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Comunidad del Intercambio//Calendario de comunidad//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${evento.id}@intercambio.app`,
    `DTSTAMP:${formatFechaICS(ahora)}`,
    `DTSTART:${formatFechaICS(inicio)}`,
    `DTEND:${formatFechaICS(fin)}`,
    `SUMMARY:${escaparTextoICS(evento.titulo)}`,
    `DESCRIPTION:${escaparTextoICS(evento.descripcion)}`,
    `LOCATION:${escaparTextoICS(evento.urlSala)}`,
    `URL:${evento.urlSala}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // RFC 5545 exige terminadores de línea CRLF.
  return lineas.join("\r\n") + "\r\n";
}

function slugArchivo(titulo: string): string {
  return (
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "evento"
  );
}

/** Genera el .ics de un evento y dispara su descarga en el navegador (Blob + object URL). */
export function descargarICS(evento: CommunityEvent): void {
  const contenido = generarICS(evento);
  const blob = new Blob([contenido], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${slugArchivo(evento.titulo)}.ics`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
