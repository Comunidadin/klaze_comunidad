"use client";

import { Fragment } from "react";
import { VimeoPlayer } from "@/components/course/vimeo-player";
import { esEmbedDeFuera } from "@/lib/embed";
import { cn } from "@/lib/utils";
import type { BloqueClase } from "@/lib/types";

/* -------------------------------------------------------------------------
   Texto: se pinta desde el DOCUMENTO, nunca desde html.

   La alternativa habitual —guardar html y volcarlo con
   `dangerouslySetInnerHTML`— pone a un creador a un `<script>` de distancia
   del navegador de todos sus alumnos, con la sesión abierta. Aquí no existe
   esa puerta: lo que no esté en este archivo, no se pinta.
   ------------------------------------------------------------------------- */

interface Marca {
  type: string;
  attrs?: { href?: string };
}

interface Nodo {
  type: string;
  text?: string;
  marks?: Marca[];
  content?: Nodo[];
  attrs?: Record<string, unknown>;
}

/** Aplica negrita, cursiva, código y enlaces a un trozo de texto. */
function conMarcas(texto: string, marcas: Marca[] | undefined, clave: string) {
  if (!marcas?.length) return <Fragment key={clave}>{texto}</Fragment>;

  return marcas.reduce<React.ReactNode>((hijo, marca) => {
    switch (marca.type) {
      case "bold":
        return <strong>{hijo}</strong>;
      case "italic":
        return <em>{hijo}</em>;
      case "code":
        return (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{hijo}</code>
        );
      case "link": {
        const href = marca.attrs?.href ?? "";
        // Solo http(s): un `javascript:` en un enlace ejecuta código al pulsar.
        if (!/^https?:\/\//i.test(href)) return hijo;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {hijo}
          </a>
        );
      }
      default:
        return hijo;
    }
  }, <Fragment key={clave}>{texto}</Fragment>);
}

function nodos(lista: Nodo[] | undefined, prefijo: string): React.ReactNode {
  return (lista ?? []).map((n, i) => <Nodo key={`${prefijo}-${i}`} nodo={n} clave={`${prefijo}-${i}`} />);
}

function Nodo({ nodo, clave }: { nodo: Nodo; clave: string }) {
  switch (nodo.type) {
    case "text":
      return <>{conMarcas(nodo.text ?? "", nodo.marks, clave)}</>;
    case "paragraph":
      return <p className="text-pretty">{nodos(nodo.content, clave)}</p>;
    case "heading": {
      const nivel = Number(nodo.attrs?.level ?? 2);
      const clases = "font-display font-bold text-foreground";
      if (nivel <= 2) return <h2 className={cn(clases, "mt-6 text-xl")}>{nodos(nodo.content, clave)}</h2>;
      return <h3 className={cn(clases, "mt-5 text-lg")}>{nodos(nodo.content, clave)}</h3>;
    }
    case "bulletList":
      return <ul className="list-disc space-y-1 pl-5">{nodos(nodo.content, clave)}</ul>;
    case "orderedList":
      return <ol className="list-decimal space-y-1 pl-5">{nodos(nodo.content, clave)}</ol>;
    case "listItem":
      return <li>{nodos(nodo.content, clave)}</li>;
    case "blockquote":
      return (
        <blockquote className="border-l-2 border-border pl-4 text-muted-foreground italic">
          {nodos(nodo.content, clave)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
          <code>{nodos(nodo.content, clave)}</code>
        </pre>
      );
    case "hardBreak":
      return <br />;
    case "horizontalRule":
      return <hr className="border-border" />;
    case "doc":
      return <>{nodos(nodo.content, clave)}</>;
    default:
      // Un nodo que no conocemos no se pinta. Es deliberado: la lista de
      // arriba ES la política de seguridad, y lo que no está, no entra.
      return null;
  }
}

export function TextoDeClase({ doc }: { doc: unknown }) {
  if (!doc || typeof doc !== "object") return null;
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90 sm:text-base">
      <Nodo nodo={doc as Nodo} clave="d" />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * Un embed. Solo la dirección, siempre en un marco aislado.
 *
 * Aunque el creador pegue el código de inserción completo, al guardar se
 * extrae únicamente el `src` (ver `urlDeEmbed`). Lo que llega aquí es una URL,
 * y el `sandbox` impide que lo de dentro toque la página que lo contiene.
 */
export function EmbedDeClase({ url, alto }: { url: string; alto?: number }) {
  if (!/^https?:\/\//i.test(url)) return null;
  // Se comprueba también al pintar, y no solo al guardar: los bloques guardados
  // antes de que `urlDeEmbed` rechazara nuestro propio dominio siguen en la
  // base, y una regla que solo se aplica al escribir no alcanza a lo que ya
  // está escrito.
  if (!esEmbedDeFuera(url)) return null;

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <iframe
        src={url}
        height={alto ?? 480}
        className="w-full"
        loading="lazy"
        // Lo mínimo para que un formulario o un calendario funcionen.
        //
        // `allow-same-origin` está, y hay que leerlo con cuidado: significa que
        // lo de dentro corre en SU propio origen, no en el nuestro. Para una
        // página de Calendly o de Google Forms eso es lo normal y no le da
        // acceso a nada de aquí — sin ese permiso ni siquiera podrían usar sus
        // cookies y la mitad dejaría de cargar.
        //
        // Lo que sí sería un problema es enmarcar una dirección NUESTRA: ahí
        // «su origen» y «el nuestro» serían el mismo, y junto con
        // `allow-scripts` el aislamiento del marco desaparecería. Por eso la
        // línea de arriba, y por eso `urlDeEmbed` las rechaza al guardar.
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-presentation"
        referrerPolicy="no-referrer"
        title="Contenido insertado"
      />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * Una imagen de referencia, con su pie opcional.
 *
 * `<img>` y no `next/image`: el optimizador exige declarar de antemano los
 * dominios permitidos, y aquí la URL la pega el creador — cualquier dominio,
 * decidido después de compilar. Es la misma razón por la que `CoursePortada`
 * lo hace así.
 *
 * `referrerPolicy="no-referrer"` para no ir contándole a cada servidor de
 * imágenes qué academia y qué clase la está mirando.
 */
function ImagenDeClase({ url, pie }: { url: string; pie?: string }) {
  if (!url.trim()) return null;

  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL arbitraria pegada por el creador, ver docstring */}
      <img
        src={url}
        alt={pie?.trim() || ""}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="w-full rounded-xl ring-1 ring-foreground/10"
      />
      {pie?.trim() && (
        <figcaption className="text-center text-xs text-muted-foreground">
          {pie}
        </figcaption>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------------- */

/** Las piezas de una clase, en orden. */
export function BloquesDeClase({
  bloques,
  className,
}: {
  bloques: BloqueClase[];
  className?: string;
}) {
  if (bloques.length === 0) return null;

  return (
    <div className={cn("space-y-6", className)}>
      {bloques.map((b) => {
        switch (b.tipo) {
          case "video":
            return b.vimeoId ? <VimeoPlayer key={b.id} vimeoId={b.vimeoId} title="" /> : null;
          case "texto":
            return <TextoDeClase key={b.id} doc={b.doc} />;
          case "embed":
            return <EmbedDeClase key={b.id} url={b.url} alto={b.alto} />;
          case "imagen":
            return <ImagenDeClase key={b.id} url={b.url} pie={b.pie} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
