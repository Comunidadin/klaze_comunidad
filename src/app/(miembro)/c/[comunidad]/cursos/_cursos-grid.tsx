"use client";

import { useMemo } from "react";
import Link from "next/link";
import { GraduationCap, Play } from "lucide-react";
import { useCommunity } from "@/lib/hooks/use-community";
import { useCourses, type CourseConAcceso } from "@/lib/hooks/use-courses";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseCard } from "@/components/course/course-card";
import { CoursePortada } from "@/components/course/course-portada";
import { leccionParaSeguir, moduloDeLeccion } from "@/components/course/course-utils";

/**
 * Referencia estable para el caso "sin progreso". Devolver `[]` dentro del
 * selector crearía un array nuevo en cada lectura y rompería el invariante de
 * `useSyncExternalStore` en React 19 (ver CLAUDE.md).
 */
const VACIO: string[] = [];

export interface CursosGridProps {
  comunidadSlug: string;
}

/**
 * Portada del área de miembros: **una fila horizontal por curso**, con las
 * portadas de sus módulos deslizándose dentro.
 *
 * Antes esta pantalla listaba lo mismo de tres formas seguidas —una franja de
 * atajos, un banner por curso bajo "Accede ahora" y otro bloque igual bajo
 * "Amplía tu acceso"—. Con dos cursos se toleraba; con diez era una página que
 * no terminaba. Ahora hay una sola forma, y los cursos sin acceso van en su
 * propia fila al final: enseñar lo que hay detrás vende, pero no debe competir
 * por atención con lo que se puede abrir ahora mismo.
 */
export function CursosGrid({ comunidadSlug }: CursosGridProps) {
  const resultado = useCommunity(comunidadSlug);
  const { cursos } = useCourses(resultado?.community.id ?? "");
  const progresoIds = useAppStore((s) => s.armazon?.progreso ?? VACIO);

  const completadasIds = useMemo(() => new Set(progresoIds), [progresoIds]);

  const { conAcceso, bloqueados } = useMemo(() => {
    const conAcceso: CourseConAcceso[] = [];
    const bloqueados: CourseConAcceso[] = [];
    for (const curso of cursos) {
      if (curso.acceso === "si") conAcceso.push(curso);
      else bloqueados.push(curso);
    }
    return { conAcceso, bloqueados };
  }, [cursos]);

  /**
   * Por dónde seguir: el primer curso con acceso que tenga algo empezado y sin
   * terminar. Si no hay ninguno empezado, el primero con acceso — el botón
   * pasa a decir "Empezar".
   */
  const continuar = useMemo(() => {
    const empezado = conAcceso.find((c) => c.progresoPct > 0 && c.progresoPct < 100);
    const curso = empezado ?? conAcceso[0];
    if (!curso) return null;

    const leccion = leccionParaSeguir(curso, completadasIds);
    if (!leccion) return null;

    return {
      curso,
      leccion,
      modulo: moduloDeLeccion(curso, leccion.id),
      empezado: curso.progresoPct > 0,
    };
  }, [conAcceso, completadasIds]);

  if (!resultado) return null;
  const { community } = resultado;

  if (cursos.length === 0) {
    return (
      <EmptyState
        icono={GraduationCap}
        titulo="Todavía no hay módulos"
        descripcion="Cuando el creador de esta academia publique un módulo, va a aparecer aquí."
      />
    );
  }

  function nombreNivel(curso: CourseConAcceso): string | undefined {
    if (curso.acceso !== "candado-nivel" || !curso.nivelRequerido) return undefined;
    return community.nombresNiveles[curso.nivelRequerido - 1];
  }

  return (
    <div className="space-y-10">
      {continuar && (
        <div className="relative overflow-hidden rounded-3xl bg-muted">
          <div className="relative aspect-[16/9] w-full sm:aspect-[3/1]">
            <CoursePortada
              portadaUrl={continuar.modulo?.portadaUrl ?? continuar.curso.portadaUrl ?? ""}
              titulo={continuar.curso.titulo}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <p className="text-xs font-medium tracking-wider text-white/70 uppercase">
              {continuar.empezado ? "Continúa donde lo dejaste" : "Empieza por aquí"}
            </p>
            <h1 className="mt-1 max-w-2xl text-balance font-display text-xl font-bold text-white sm:text-2xl">
              {continuar.leccion.titulo}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {continuar.curso.titulo}
              {continuar.modulo ? ` · ${continuar.modulo.titulo}` : ""}
            </p>
            <Button asChild size="lg" className="mt-4">
              <Link
                href={`/c/${comunidadSlug}/cursos/${continuar.curso.slug}/leccion/${continuar.leccion.id}`}
              >
                <Play /> {continuar.empezado ? "Continuar" : "Empezar"}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Cuadrícula, no filas que se deslizan: en una cuadrícula se ven diez
          módulos de golpe y en una fila caben cuatro. Con el catálogo que tiene
          esta academia, recorrerlo de lado era el cuello de botella. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {conAcceso.map((curso) => (
          <CourseCard key={curso.id} curso={curso} comunidadSlug={comunidadSlug} />
        ))}
      </div>

      {bloqueados.length > 0 && (
        <div className="space-y-5 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            Más de {community.nombre}, todavía fuera de tu acceso.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bloqueados.map((curso) => (
              <CourseCard
                key={curso.id}
                curso={curso}
                comunidadSlug={comunidadSlug}
                nombreNivelRequerido={nombreNivel(curso)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
