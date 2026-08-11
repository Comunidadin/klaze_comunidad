import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarCorreo } from "@/lib/correo";
import { componerCorreo, leerPlantilla } from "@/lib/plantillas";

/**
 * Avisar a alguien de que su acceso quedó pausado.
 *
 * Hasta ahora no se avisaba: al alumno le desaparecía el contenido y tenía que
 * adivinar si se había roto la plataforma, si le habían echado o si era un
 * fallo suyo. El correo no le devuelve el acceso, pero le dice a quién
 * preguntar.
 *
 * Vive aparte de la suspensión misma, y a propósito: **suspender no puede
 * depender de que el correo salga**. `cambiarEstadoAlumno` y el `/baja` del
 * enlace de compra hacen su escritura primero; esto va después y no lanza.
 *
 * Está en su propio archivo —y no dentro de `plantillas.ts`— porque
 * `enviarCorreo` arrastra las variables del servidor, y `plantillas.ts` lo
 * importa también el editor del panel, que corre en el navegador.
 */
export async function avisarBaja(
  admin: SupabaseClient,
  o: {
    comunidadId: string;
    comunidadNombre: string;
    email: string;
    nombre?: string;
  }
): Promise<{ enviado: boolean; error?: string }> {
  const plantilla = await leerPlantilla(admin, o.comunidadId, "baja");

  // Sin bloque de Klaze detrás: aquí no hay credenciales ni enlace que dar. Lo
  // único que se puede decir es lo que el dueño quiera decir.
  const { asunto, html } = componerCorreo(plantilla, {
    academia: o.comunidadNombre,
    correo: o.email,
    nombre: o.nombre,
  });

  return enviarCorreo({ para: o.email, asunto, html });
}
