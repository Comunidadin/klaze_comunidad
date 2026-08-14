"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { useSession } from "@/lib/hooks/use-session";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * «Empieza aquí»: los tres primeros pasos de un alumno nuevo, marcados solos.
 *
 * Existe porque los primeros diez minutos deciden si alguien vuelve. Se
 * esconde cuando los tres pasos están hechos, cuando el alumno la descarta
 * (persistido por academia en este navegador) y siempre para el dueño.
 */
export function ChecklistBienvenida({
  comunidadId,
  comunidadSlug,
  ownerId,
}: {
  comunidadId: string;
  comunidadSlug: string;
  ownerId: string;
}) {
  const { user } = useSession();
  const oculto = useAppStore((s) => s.checklistOculto[comunidadId] ?? false);
  const ocultarChecklist = useAppStore((s) => s.ocultarChecklist);

  // ¿Ya publicó algo en esta academia? Un solo id basta; RLS limita a lo
  // visible y el filtro por autor lo acota a lo propio.
  const [haPublicado, setHaPublicado] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    void crearClienteNavegador()
      .from("publicaciones")
      .select("id")
      .eq("comunidad_id", comunidadId)
      .eq("autor_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (vivo) setHaPublicado((data ?? []).length > 0);
      });
    return () => {
      vivo = false;
    };
  }, [comunidadId, user]);

  if (!user || user.id === ownerId || oculto || haPublicado === null) return null;

  const pasos = [
    {
      hecho: Boolean(user.avatarUrl?.trim() || user.bio?.trim()),
      titulo: "Completa tu perfil",
      detalle: "Una foto o unas líneas sobre ti.",
      href: "/perfil",
    },
    {
      hecho: haPublicado,
      titulo: "Preséntate en la comunidad",
      detalle: "Tu primera publicación rompe el hielo.",
      href: `/c/${comunidadSlug}/comunidad`,
    },
    {
      // Los puntos ya son por academia: >0 significa una clase completada AQUÍ.
      hecho: user.puntos > 0,
      titulo: "Completa tu primera clase",
      detalle: "Márcala al terminarla y suma tus primeros puntos.",
      href: `/c/${comunidadSlug}/cursos`,
    },
  ];

  if (pasos.every((p) => p.hecho)) return null;

  return (
    <section className="relative rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-3 right-3 text-muted-foreground"
        onClick={() => ocultarChecklist(comunidadId)}
        aria-label="Descartar la lista de bienvenida"
      >
        <X className="size-4" />
      </Button>

      <h2 className="font-display text-base font-bold text-foreground">Empieza aquí</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Tres pasos y ya eres de la casa.
      </p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {pasos.map((paso) => (
          <li key={paso.titulo}>
            <Link
              href={paso.href}
              className={cn(
                "flex h-full items-start gap-2.5 rounded-xl border border-border p-3 transition-colors hover:bg-muted",
                paso.hecho && "opacity-60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  paso.hecho
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
              >
                {paso.hecho && <Check className="size-3.5" />}
              </span>
              <span>
                <span
                  className={cn(
                    "block text-sm font-medium text-foreground",
                    paso.hecho && "line-through"
                  )}
                >
                  {paso.titulo}
                </span>
                <span className="text-xs text-muted-foreground">{paso.detalle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
