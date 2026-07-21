"use client";

import { aplicarPerfilOverride, resolverComunidad, resolverPlan, useKlazeStore } from "@/lib/store";
import { mockCommunities } from "@/lib/mocks/communities";
import { mockEnrollments } from "@/lib/mocks/enrollments";
import { mockPlans } from "@/lib/mocks/plans";
import { mockUsers } from "@/lib/mocks/users";
import type { BarChartDatum } from "@/components/admin/bar-chart";
import type { Community, Plan, User } from "@/lib/types";

export interface ComunidadPlataforma {
  community: Community;
  dueno: User;
  plan: Plan;
  /** Filas de enrollment (cualquier estado) de esta comunidad — mismo criterio que `useMembers`. */
  miembros: number;
}

export interface CreadorPlataforma {
  usuario: User;
  comunidades: Community[];
}

export interface PlatformMetricas {
  comunidadesActivas: number;
  creadores: number;
  alumnosTotales: number;
  /** Suma de `plan.precioMes` de cada comunidad con `estado === "activa"`. */
  mrr: number;
  crecimientoMensual: BarChartDatum[];
}

export interface UsePlatformResult {
  comunidades: ComunidadPlataforma[];
  creadores: CreadorPlataforma[];
  planes: Plan[];
  metricas: PlatformMetricas;
}

const FORMATO_MES = new Intl.DateTimeFormat("es-ES", { month: "short" });

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Mock determinístico de "comunidades activas" para los últimos 6 meses
 * (incluido el mes en curso). Regla: cada mes recibe una fracción lineal
 * creciente del total de comunidades activas DE HOY — mes actual = 100%
 * del total real, hace 5 meses = 1/6 — así el gráfico siempre aterriza en
 * el mismo número que la `StatCard` "Comunidades activas" y no depende de
 * `Math.random` ni de una fecha de alta por comunidad que el mock no tiene.
 * No es una serie histórica real, es una tendencia de "hacia dónde llegamos".
 */
function crecimientoMensualMock(comunidadesActivas: number): BarChartDatum[] {
  const ahora = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const offsetMeses = 5 - i; // 5 = hace 5 meses ... 0 = mes actual
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - offsetMeses, 1);
    const fraccion = (i + 1) / 6;
    return {
      etiqueta: capitalizar(FORMATO_MES.format(fecha).replace(".", "")),
      valor: Math.round(comunidadesActivas * fraccion),
    };
  });
}

/**
 * Puerta única de datos del panel `/plataforma` (T15): resuelve comunidades
 * (con dueño, plan y nº de miembros), creadores (con sus comunidades) y
 * planes, todos con los overrides del store aplicados, para que ninguna
 * página de `/plataforma/*` importe `mockCommunities`/`mockUsers`/`mockPlans`
 * directamente — mismo principio que `useMembers`/`useUsuarios` en el resto
 * de la app.
 */
export function usePlatform(): UsePlatformResult {
  const usuariosCreados = useKlazeStore((s) => s.usuariosCreados);
  const comunidadesCreadas = useKlazeStore((s) => s.comunidadesCreadas);
  const comunidadOverrides = useKlazeStore((s) => s.comunidadOverrides);
  const perfilOverrides = useKlazeStore((s) => s.perfilOverrides);
  const planOverrides = useKlazeStore((s) => s.planOverrides);
  const enrollmentsExtra = useKlazeStore((s) => s.enrollmentsExtra);

  const todosLosUsuarios = [...mockUsers, ...usuariosCreados].map((u) =>
    aplicarPerfilOverride(u, perfilOverrides)
  );
  const todasLasComunidadesBase = [...mockCommunities, ...comunidadesCreadas];
  const todasLasComunidades = todasLasComunidadesBase.map((c) =>
    resolverComunidad(c, comunidadOverrides)
  );
  const planes = mockPlans.map((p) => resolverPlan(p, planOverrides));
  const todosLosEnrollments = [...mockEnrollments, ...enrollmentsExtra];

  const usuarioDesconocido: User = {
    id: "u-desconocido",
    email: "",
    nombre: "Usuario eliminado",
    avatarUrl: "https://i.pravatar.cc/150?u=u-desconocido",
    bio: "",
    rol: "alumno",
    comunidadIds: [],
    puntos: 0,
    nivel: 1,
    creadoEl: todasLasComunidades[0]?.creadoEl ?? new Date().toISOString(),
  };

  const comunidades: ComunidadPlataforma[] = todasLasComunidades.map((community) => {
    const dueno =
      todosLosUsuarios.find((u) => u.id === community.ownerId) ?? usuarioDesconocido;
    const plan = planes.find((p) => p.id === community.plan) ?? planes[0];
    const miembros = todosLosEnrollments.filter(
      (e) => e.comunidadId === community.id
    ).length;
    return { community, dueno, plan, miembros };
  });

  const creadores: CreadorPlataforma[] = todosLosUsuarios
    .filter((u) => u.rol === "creador")
    .map((usuario) => ({
      usuario,
      comunidades: todasLasComunidades.filter((c) => c.ownerId === usuario.id),
    }));

  const comunidadesActivas = todasLasComunidades.filter((c) => c.estado === "activa").length;
  const mrr = comunidades
    .filter((c) => c.community.estado === "activa")
    .reduce((acc, c) => acc + c.plan.precioMes, 0);
  const alumnosTotales = todosLosUsuarios.filter((u) => u.rol === "alumno").length;

  const metricas: PlatformMetricas = {
    comunidadesActivas,
    creadores: creadores.length,
    alumnosTotales,
    mrr,
    crecimientoMensual: crecimientoMensualMock(comunidadesActivas),
  };

  return { comunidades, creadores, planes, metricas };
}
