"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { useHydrated, useSession } from "@/lib/hooks/use-session";
import { useAppStore } from "@/lib/store";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarArmazon, type AcademiaMia } from "@/lib/supabase/consultas";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";

/**
 * «¿A cuál academia entras?» — la pantalla de quien pertenece a varias.
 *
 * Aparece tras el login cuando hay más de una y ninguna elegida en este
 * navegador (`homePorRol`), y siempre está disponible en `/academias`. Con
 * una sola academia redirige de vuelta: no hay nada que elegir.
 */
export default function AcademiasPage() {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();
  const armazon = useAppStore((s) => s.armazon);
  const fijarAcademiaActiva = useAppStore((s) => s.fijarAcademiaActiva);
  const establecerArmazon = useAppStore((s) => s.establecerArmazon);

  // Con una sola academia no hay nada que elegir: de vuelta a clase. En un
  // efecto y no en el render — navegar es un efecto.
  const unicaSlug =
    hydrated && user && armazon && armazon.misAcademias.length <= 1
      ? (armazon.misAcademias[0]?.slug ?? armazon.comunidad?.slug ?? "")
      : null;
  useEffect(() => {
    if (unicaSlug !== null) {
      router.replace(unicaSlug ? `/c/${unicaSlug}/cursos` : "/login");
    }
  }, [unicaSlug, router]);

  if (!hydrated || !user || !armazon || unicaSlug !== null) {
    return <FullScreenLoader />;
  }

  const academias = armazon.misAcademias;

  async function elegir(academia: AcademiaMia) {
    fijarAcademiaActiva(academia.id);
    establecerArmazon(await cargarArmazon(crearClienteNavegador(), academia.id));
    router.replace(`/c/${academia.slug}/cursos`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="text-center font-display text-2xl font-bold tracking-tight text-foreground">
          ¿A cuál academia entras?
        </h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Perteneces a {academias.length} academias. Puedes cambiar cuando
          quieras desde el menú de tu cuenta.
        </p>

        <ul className="mt-8 space-y-3">
          {academias.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => void elegir(a)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-shadow outline-none hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-foreground/10">
                  {a.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- logo del creador, dominio arbitrario */
                    <img src={a.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <GraduationCap className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-semibold text-foreground">
                    {a.nombre}
                  </span>
                  {a.estado === "suspendida" && (
                    <span className="text-xs text-muted-foreground">Suspendida</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
