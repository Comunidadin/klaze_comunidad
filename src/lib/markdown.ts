/**
 * Markdown ligero para publicaciones y comentarios: un parser puro a un AST
 * de datos, sin dependencias y sin HTML por el camino.
 *
 * El subconjunto es deliberadamente corto — lo que un creador necesita para
 * unas normas o un anuncio: títulos (`##`/`###`), negrita, cursiva, listas
 * con `-` y enlaces `[texto](url)`. Nada de HTML crudo, tablas ni imágenes
 * por sintaxis. Quien pinta el AST construye elementos React a mano, así que
 * inyectar script es imposible por construcción, no por un sanitizador.
 *
 * Nunca lanza: la entrada es texto de usuarios y puede venir cortada por el
 * «Ver más» del feed a mitad de un `**`. Lo que no se entiende se pinta como
 * texto tal cual.
 */

export type Inline =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrita"; texto: string }
  | { tipo: "cursiva"; texto: string }
  | { tipo: "enlace"; texto: string; href: string };

export type Bloque =
  | { tipo: "titulo"; nivel: 2 | 3; inline: Inline[] }
  | { tipo: "lista"; items: Inline[][] }
  | { tipo: "parrafo"; lineas: Inline[][] };

/** Solo web: cualquier otro esquema (javascript:, data:…) queda como texto. */
function esHrefSegura(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Trocea una línea en texto, **negrita**, *cursiva* y [enlaces](url).
 *
 * Una sola pasada con una regex alternada: el primer patrón que casa gana, lo
 * anterior se acumula como texto. Sin anidación (negrita dentro de un enlace,
 * etc.) — este Markdown es para posts, no para documentación.
 */
export function parseInline(linea: string): Inline[] {
  const resultado: Inline[] = [];
  const patron = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(linea)) !== null) {
    if (m.index > cursor) {
      resultado.push({ tipo: "texto", texto: linea.slice(cursor, m.index) });
    }
    if (m[1] !== undefined) {
      resultado.push({ tipo: "negrita", texto: m[1] });
    } else if (m[2] !== undefined) {
      resultado.push({ tipo: "cursiva", texto: m[2] });
    } else if (esHrefSegura(m[4])) {
      resultado.push({ tipo: "enlace", texto: m[3], href: m[4] });
    } else {
      // Enlace con esquema raro: se enseña la sintaxis tal cual, sin link.
      resultado.push({ tipo: "texto", texto: m[0] });
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < linea.length) {
    resultado.push({ tipo: "texto", texto: linea.slice(cursor) });
  }
  return resultado;
}

export function parseMarkdown(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  // Un párrafo o una lista terminan en línea en blanco o al cambiar de tipo.
  let parrafo: Inline[][] = [];
  let lista: Inline[][] = [];

  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: "parrafo", lineas: parrafo });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista.length) bloques.push({ tipo: "lista", items: lista });
    lista = [];
  };

  for (const cruda of texto.split("\n")) {
    const linea = cruda.trimEnd();

    if (!linea.trim()) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }

    const titulo = linea.match(/^(#{1,3})\s+(.*)$/);
    if (titulo) {
      cerrarParrafo();
      cerrarLista();
      // `#` se aplana a `##`: dentro de un post no hay sitio para un h1.
      bloques.push({
        tipo: "titulo",
        nivel: titulo[1].length >= 3 ? 3 : 2,
        inline: parseInline(titulo[2]),
      });
      continue;
    }

    const item = linea.match(/^[-*]\s+(.*)$/);
    if (item) {
      cerrarParrafo();
      lista.push(parseInline(item[1]));
      continue;
    }

    cerrarLista();
    parrafo.push(parseInline(linea));
  }

  cerrarParrafo();
  cerrarLista();
  return bloques;
}
