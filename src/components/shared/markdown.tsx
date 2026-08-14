import { parseMarkdown, type Inline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * Pinta el Markdown ligero de una publicación o comentario.
 *
 * Construye los elementos React a mano desde el AST de `parseMarkdown` —
 * nunca `dangerouslySetInnerHTML`, así que el texto de un alumno no puede
 * inyectar nada por muy hostil que venga.
 */
function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((n, i) => {
        switch (n.tipo) {
          case "negrita":
            return <strong key={i}>{n.texto}</strong>;
          case "cursiva":
            return <em key={i}>{n.texto}</em>;
          case "enlace":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                {n.texto}
              </a>
            );
          default:
            return <span key={i}>{n.texto}</span>;
        }
      })}
    </>
  );
}

export function Markdown({ texto, className }: { texto: string; className?: string }) {
  const bloques = parseMarkdown(texto);

  return (
    <div className={cn("space-y-2", className)}>
      {bloques.map((b, i) => {
        if (b.tipo === "titulo") {
          return b.nivel === 2 ? (
            <p key={i} className="pt-1 text-base font-semibold text-foreground">
              <Inlines inlines={b.inline} />
            </p>
          ) : (
            <p key={i} className="pt-0.5 text-sm font-semibold text-foreground">
              <Inlines inlines={b.inline} />
            </p>
          );
        }
        if (b.tipo === "lista") {
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inlines inlines={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {b.lineas.map((linea, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inlines inlines={linea} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
