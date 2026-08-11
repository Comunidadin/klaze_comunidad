import { Code2, FileText, ImageIcon, Video } from "lucide-react";
import type { tipoDeClase } from "@/lib/types";

/**
 * El icono de una clase según su primera pieza.
 *
 * En su propio archivo porque lo usan el temario del alumno y el del editor, y
 * antes era un ternario copiado en los dos: `=== "video" ? Video : FileText`.
 * Con dos tipos colaba; al aparecer el tercero y el cuarto, una clase que
 * empieza por imagen salía con icono de documento en las dos pantallas — y
 * había que acordarse de arreglarlo dos veces.
 *
 * El `Record` sobre el tipo de retorno de `tipoDeClase` es lo que hace que
 * añadir una pieza nueva **no compile** hasta que se le dé icono.
 */
export const ICONO_CLASE: Record<
  ReturnType<typeof tipoDeClase>,
  typeof Video
> = {
  video: Video,
  texto: FileText,
  imagen: ImageIcon,
  embed: Code2,
};
