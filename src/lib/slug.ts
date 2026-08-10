import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El identificador de una academia, derivado de su nombre.
 *
 * Existe porque un webhook no puede preguntar. Cuando alguien compra Klaze
 * rellenando un formulario, lo único que hay es el nombre que escribió, y de
 * ahí tiene que salir la dirección donde vivirán todos sus alumnos.
 *
 * Lógica pura y en su propio archivo: así se prueba sin base de datos, que es
 * donde están los casos raros de verdad.
 */

const LARGO_MAXIMO = 40;

/**
 * `"Mentoría Pro 2026!"` → `"mentoria-pro-2026"`.
 *
 * Los acentos se quitan descomponiendo en `NFD` y borrando los diacríticos. Sin
 * eso, una academia llamada «Mentoría» acabaría en `/c/mentor%C3%ADa`: una
 * dirección que funciona pero que nadie puede dictar por teléfono.
 *
 * Si no queda nada —un nombre escrito solo con emojis, que pasa— devuelve
 * `"academia"`. Devolver cadena vacía crearía una comunidad con slug `''`, y
 * `/c/` no lleva a ninguna parte.
 */
export function slugDesde(texto: string): string {
  const limpio = texto
    .normalize("NFD")
    // El rango de los diacríticos combinantes, escrito con códigos y no con los
    // caracteres: son invisibles, y pegados en un archivo se pierden.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // La eñe no necesita tratamiento aparte: `NFD` la descompone en `n` más una
    // tilde combinante, y esa tilde cae en el rango de arriba. "Diseño" sale
    // "diseno" sin más.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LARGO_MAXIMO)
    // El recorte puede dejar un guion colgando al final.
    .replace(/-+$/, "");

  return limpio || "academia";
}

/**
 * El primer identificador libre a partir de una base: `base`, `base-2`, `base-3`…
 *
 * Dos academias con el mismo nombre no son raras —«Academia de Marketing» lo
 * escribiría cualquiera—, y `comunidades.slug` es único: sin esto, la segunda
 * compra fallaría con un error de la base y alguien se quedaría pagando sin
 * academia.
 */
export async function slugLibre(
  admin: SupabaseClient,
  base: string
): Promise<string> {
  const raiz = slugDesde(base);

  // El sufijo cuenta para el largo: `slice` antes de añadirlo dejaría slugs de
  // 42 caracteres.
  for (let intento = 1; intento < 100; intento++) {
    const sufijo = intento === 1 ? "" : `-${intento}`;
    const candidato = raiz.slice(0, LARGO_MAXIMO - sufijo.length) + sufijo;

    const { data } = await admin
      .from("comunidades")
      .select("id")
      .eq("slug", candidato)
      .maybeSingle();

    if (!data) return candidato;
  }

  // Cien homónimos es improbable, pero quedarse sin identificador no puede
  // significar quedarse sin academia.
  return `${raiz.slice(0, 20)}-${crypto.randomUUID().slice(0, 8)}`;
}
