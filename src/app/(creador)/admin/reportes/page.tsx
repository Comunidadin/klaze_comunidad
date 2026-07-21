"use client";

import {
  BarChart3,
  CalendarClock,
  MessagesSquare,
  PlayCircle,
  Trophy,
  UserCheck,
} from "lucide-react";
import { enrollmentCubreCurso, resolverEstadoEnrollment, useKlazeStore } from "@/lib/store";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { useHydrated } from "@/lib/hooks/use-session";
import { useAhora } from "@/lib/hooks/use-ahora";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useMembers, progresoPromedioDe } from "@/lib/hooks/use-members";
import { useGamification } from "@/lib/hooks/use-gamification";
import { useAdminCourses, type CourseConAdmin } from "@/lib/hooks/use-admin-courses";
import { useFeed } from "@/lib/hooks/use-feed";
import { useEvents } from "@/lib/hooks/use-events";
import { StatCard } from "@/components/admin/stat-card";
import { BarChart, type BarChartDatum } from "@/components/admin/bar-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Enrollment, LessonProgress } from "@/lib/types";

function ReportesSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-32" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Semanas ISO (lunes a domingo) para "Lecciones completadas por semana"
// ---------------------------------------------------------------------------

const FORMATO_DIA_MES = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/** "12 jul" — sin punto de abreviatura, mismo estilo que el resto de la UI. */
function etiquetaSemana(fecha: Date): string {
  return FORMATO_DIA_MES.format(fecha).replace(".", "");
}

/** Lunes 00:00 (hora local) de la semana que contiene `fecha`. */
function inicioDeSemana(fecha: Date): Date {
  const dia = fecha.getDay(); // 0 domingo .. 6 sábado
  const diff = fecha.getDate() - dia + (dia === 0 ? -6 : 1);
  const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), diff);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

/** Los N lunes más recientes (incluida la semana en curso), en orden cronológico ascendente. */
function ultimasNSemanas(n: number): Date[] {
  const actual = inicioDeSemana(new Date());
  return Array.from({ length: n }, (_, i) => new Date(actual.getTime() - (n - 1 - i) * SEMANA_MS));
}

function leccionesPorSemana(
  progreso: LessonProgress[],
  leccionIdsComunidad: Set<string>
): BarChartDatum[] {
  const semanas = ultimasNSemanas(8);
  const conteos = semanas.map(() => 0);

  for (const p of progreso) {
    if (!leccionIdsComunidad.has(p.leccionId)) continue;
    const inicio = inicioDeSemana(new Date(p.completadaEl)).getTime();
    const indice = semanas.findIndex((s) => s.getTime() === inicio);
    if (indice !== -1) conteos[indice]++;
  }

  return semanas.map((s, i) => ({ etiqueta: etiquetaSemana(s), valor: conteos[i] }));
}

// ---------------------------------------------------------------------------
// % de avance promedio por curso publicado
// ---------------------------------------------------------------------------

function avancePorCurso(
  curso: CourseConAdmin,
  comunidadId: string,
  enrollmentsExtra: Enrollment[],
  estadoOverrides: Record<string, Enrollment["estado"]>,
  progreso: LessonProgress[]
): number {
  const enrollments = [...mockEnrollments, ...enrollmentsExtra].filter(
    (e) =>
      e.comunidadId === comunidadId &&
      resolverEstadoEnrollment(e, estadoOverrides) === "activo" &&
      enrollmentCubreCurso(e, curso.id)
  );
  if (enrollments.length === 0) return 0;

  const promedios = enrollments.map((e) =>
    progresoPromedioDe(e.cursoIds, [curso], e.userId, progreso)
  );
  return Math.round(promedios.reduce((a, b) => a + b, 0) / promedios.length);
}

// ---------------------------------------------------------------------------
// Top 5 lecciones más vistas — mock determinístico
// ---------------------------------------------------------------------------

/** Hash simple y estable (sin `Math.random`) para derivar un número 0-999 de un string. */
function hashDeterministico(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h % 1000;
}

interface LeccionConVistas {
  id: string;
  titulo: string;
  cursoTitulo: string;
  vistas: number;
}

/**
 * "Vistas" es una métrica que el MVP no rastrea de verdad (no hay
 * analítica de reproducciones, solo finalizaciones vía `progreso`). Para que
 * el reporte tenga una tabla interesante desde una sesión recién sembrada,
 * cada lección recibe una base determinística (hash de su `id` + su índice
 * de aparición, nunca `Math.random`, así el orden es estable entre renders)
 * más 4× sus finalizaciones reales — quien de verdad terminó más veces una
 * lección en esta sesión sube en el ranking, pero nunca queda en cero.
 */
function topLeccionesVistas(cursosPublicados: CourseConAdmin[], progreso: LessonProgress[]): LeccionConVistas[] {
  let indice = 0;
  const lecciones: LeccionConVistas[] = cursosPublicados.flatMap((curso) =>
    curso.modulos.flatMap((modulo) =>
      modulo.lecciones.map((leccion) => {
        const vistasReales = progreso.filter((p) => p.leccionId === leccion.id).length;
        const base = 8 + ((hashDeterministico(leccion.id) + indice * 7) % 53);
        indice++;
        return {
          id: leccion.id,
          titulo: leccion.titulo,
          cursoTitulo: curso.titulo,
          vistas: base + vistasReales * 4,
        };
      })
    )
  );

  return lecciones.sort((a, b) => b.vistas - a.vistas).slice(0, 5);
}

// ---------------------------------------------------------------------------

function RankBadge({ posicion }: { posicion: number }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
        posicion === 1
          ? "bg-accent text-accent-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {posicion}
    </span>
  );
}

/**
 * `/admin/reportes`: métricas de actividad de la comunidad — 4 tarjetas
 * resumen, dos `BarChart` (lecciones completadas por semana, % de avance por
 * curso) y dos rankings top-5 (alumnos más activos, lecciones más vistas).
 * Todo se deriva del store real (`progreso`, `enrollmentsExtra`, etc.) salvo
 * "vistas" de lecciones, que es mock determinístico (ver `topLeccionesVistas`).
 */
export default function ReportesPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const ahora = useAhora();

  const { miembros } = useMembers(community?.id ?? "");
  const { rankingPorPeriodo } = useGamification(community?.id ?? "");
  const { cursos } = useAdminCourses(community?.id ?? "");
  const { posts } = useFeed(community?.id ?? "");
  const { eventos } = useEvents(community?.id ?? "");
  const progreso = useKlazeStore((s) => s.progreso);
  const enrollmentsExtra = useKlazeStore((s) => s.enrollmentsExtra);
  const estadoOverrides = useKlazeStore((s) => s.estadoOverrides);

  if (!hydrated) {
    return <ReportesSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={BarChart3}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  const cursosPublicados = cursos.filter((c) => c.publicado);
  const leccionIdsComunidad = new Set(
    cursos.flatMap((c) => c.modulos.flatMap((m) => m.lecciones.map((l) => l.id)))
  );

  const alumnosActivos = miembros.filter((m) => m.estado === "activo").length;
  const promedioAvance =
    miembros.length === 0
      ? 0
      : Math.round(miembros.reduce((acc, m) => acc + m.progresoPromedio, 0) / miembros.length);
  const eventosProximos = eventos.filter(
    (e) => new Date(e.fechaInicio).getTime() + e.duracionMin * 60_000 >= ahora
  ).length;

  const dataSemanas = leccionesPorSemana(progreso, leccionIdsComunidad);
  const dataAvancePorCurso: BarChartDatum[] = cursosPublicados.map((curso) => ({
    etiqueta: curso.titulo,
    valor: avancePorCurso(curso, community.id, enrollmentsExtra, estadoOverrides, progreso),
  }));
  const topAlumnos = rankingPorPeriodo.total.slice(0, 5);
  const topLecciones = topLeccionesVistas(cursosPublicados, progreso);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Reportes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cómo le está yendo a {community.nombre} — actividad, avance y participación.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Alumnos activos" valor={alumnosActivos} icono={UserCheck} />
        <StatCard titulo="Avance promedio" valor={`${promedioAvance}%`} icono={BarChart3} />
        <StatCard titulo="Publicaciones totales" valor={posts.length} icono={MessagesSquare} />
        <StatCard titulo="Eventos próximos" valor={eventosProximos} icono={CalendarClock} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChart data={dataSemanas} titulo="Lecciones completadas por semana" />

        {dataAvancePorCurso.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>% de avance por curso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Publica al menos un curso para ver aquí el avance promedio de tus alumnos.
              </p>
            </CardContent>
          </Card>
        ) : (
          <BarChart data={dataAvancePorCurso} titulo="% de avance por curso" sufijo="%" />
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 alumnos más activos</CardTitle>
          </CardHeader>
          <CardContent>
            {topAlumnos.length === 0 || topAlumnos.every((e) => e.puntos === 0) ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay puntos que mostrar — aparecen en cuanto los miembros reciben likes.
              </p>
            ) : (
              <ul className="space-y-1">
                {topAlumnos.map((entrada) => (
                  <li
                    key={entrada.user.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2 py-2",
                      entrada.posicion === 1 && "bg-accent/10 ring-1 ring-accent/30"
                    )}
                  >
                    <RankBadge posicion={entrada.posicion} />
                    <Avatar size="sm">
                      <AvatarImage src={entrada.user.avatarUrl} alt={entrada.user.nombre} />
                      <AvatarFallback>{entrada.user.nombre[0]}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {entrada.user.nombre}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {entrada.puntos} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 lecciones más vistas</CardTitle>
          </CardHeader>
          <CardContent>
            {topLecciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Publica al menos un curso con lecciones para ver este ranking.
              </p>
            ) : (
              <ul className="space-y-1">
                {topLecciones.map((leccion, i) => (
                  <li
                    key={leccion.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2 py-2",
                      i === 0 && "bg-accent/10 ring-1 ring-accent/30"
                    )}
                  >
                    <RankBadge posicion={i + 1} />
                    <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {leccion.titulo}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{leccion.cursoTitulo}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {leccion.vistas}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!topAlumnos.some((e) => e.puntos > 0) && dataSemanas.every((d) => d.valor === 0) && (
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Trophy className="size-3.5 shrink-0" />
          Estos reportes se llenan con la actividad real de tu comunidad — likes, finalizaciones
          de lecciones y publicaciones.
        </div>
      )}
    </div>
  );
}
