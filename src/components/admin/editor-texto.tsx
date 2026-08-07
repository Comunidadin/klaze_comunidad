"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditorTextoProps {
  doc: unknown;
  onCambio: (doc: unknown) => void;
  className?: string;
}

/**
 * Editor de texto con barra: negrita, cursiva, títulos, listas, cita y enlace.
 *
 * Devuelve el **documento**, no html. Es la decisión de seguridad de esta
 * pantalla: lo que se guarda es una estructura de datos que el visor pinta
 * nodo a nodo, así que nada de lo que se escriba —ni de lo que se pegue— puede
 * acabar ejecutándose en el navegador de un alumno.
 */
export function EditorTexto({ doc, onCambio, className }: EditorTextoProps) {
  const editor = useEditor({
    // Sin esto Next avisa de discrepancia entre servidor y navegador: el
    // editor solo existe en el cliente.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        // El visor descarta cualquier enlace que no sea http(s), pero
        // conviene no guardarlos siquiera.
        protocols: ["http", "https"],
      }),
    ],
    content: (doc as object) ?? { type: "doc", content: [] },
    onUpdate: ({ editor }) => onCambio(editor.getJSON()),
    editorProps: {
      attributes: {
        class:
          "min-h-32 max-w-none px-3 py-2 text-sm leading-relaxed outline-none [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-display [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-primary [&_a]:underline [&_p]:my-1.5",
      },
    },
  });

  if (!editor) return null;

  function ponerEnlace() {
    const previo = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Dirección del enlace", previo ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      window.alert("El enlace tiene que empezar por http:// o https://");
      return;
    }
    editor!.chain().focus().setLink({ href: url.trim() }).run();
  }

  const botones = [
    { icono: Bold, etiqueta: "Negrita", activo: "bold", accion: () => editor.chain().focus().toggleBold().run() },
    { icono: Italic, etiqueta: "Cursiva", activo: "italic", accion: () => editor.chain().focus().toggleItalic().run() },
    { icono: Heading2, etiqueta: "Título", activo: "heading", accion: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icono: Heading3, etiqueta: "Subtítulo", activo: "heading", accion: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { icono: List, etiqueta: "Lista", activo: "bulletList", accion: () => editor.chain().focus().toggleBulletList().run() },
    { icono: ListOrdered, etiqueta: "Lista numerada", activo: "orderedList", accion: () => editor.chain().focus().toggleOrderedList().run() },
    { icono: Quote, etiqueta: "Cita", activo: "blockquote", accion: () => editor.chain().focus().toggleBlockquote().run() },
    { icono: Code, etiqueta: "Código", activo: "code", accion: () => editor.chain().focus().toggleCode().run() },
  ] as const;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-input bg-background", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1">
        {botones.map(({ icono: Icono, etiqueta, activo, accion }) => (
          <button
            key={etiqueta}
            type="button"
            onClick={accion}
            aria-label={etiqueta}
            title={etiqueta}
            aria-pressed={editor.isActive(activo)}
            className={cn(
              "cursor-pointer rounded p-1.5 transition-colors",
              editor.isActive(activo)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icono className="size-3.5" />
          </button>
        ))}

        <button
          type="button"
          onClick={ponerEnlace}
          aria-label="Enlace"
          title="Enlace"
          aria-pressed={editor.isActive("link")}
          className={cn(
            "cursor-pointer rounded p-1.5 transition-colors",
            editor.isActive("link")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Link2 className="size-3.5" />
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
