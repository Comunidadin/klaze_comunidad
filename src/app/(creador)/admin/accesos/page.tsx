"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Mail, Send } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useInvitations } from "@/lib/hooks/use-invitations";
import { esEmailValido } from "@/lib/validation";
import { resumenCursosInvitacion } from "@/lib/invitation-summary";
import { formatFechaLarga } from "@/lib/format-fecha";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Divide por coma y/o salto de línea, recorta espacios y descarta vacíos. */
function tokenizarCorreos(texto: string): string[] {
  return texto
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

interface CorreosParseados {
  validos: string[]; // normalizados a minúscula, sin duplicados
  invalidos: string[]; // texto tal cual se escribió
}

/** Valida cada token, deduplica los válidos (case-insensitive) preservando el primer orden de aparición. */
function parseCorreos(texto: string): CorreosParseados {
  const validos: string[] = [];
  const invalidos: string[] = [];
  const vistos = new Set<string>();

  for (const token of tokenizarCorreos(texto)) {
    if (!esEmailValido(token)) {
      invalidos.push(token);
      continue;
    }
    const normalizado = token.toLowerCase();
    if (vistos.has(normalizado)) continue;
    vistos.add(normalizado);
    validos.push(normalizado);
  }

  return { validos, invalidos };
}

function CopiarLinkButton({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const url = `${window.location.origin}/invitacion/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error("No pudimos copiar el link. Cópialo manualmente.");
    }
  }

  return (
    <Tooltip open={copiado || undefined}>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={copiar}>
          {copiado ? <Check /> : <Copy />}
          Copiar link
        </Button>
      </TooltipTrigger>
      <TooltipContent>¡Copiado!</TooltipContent>
    </Tooltip>
  );
}

function AccesosSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="mt-6 h-64 rounded-xl" />
    </div>
  );
}

/**
 * `/admin/accesos` — el flujo estrella del producto: pegar correos, elegir
 * a qué dan acceso y enviar invitaciones. Cada invitación queda como link
 * `/invitacion/{token}` (T6) que el creador copia y comparte manualmente
 * (no hay envío de correo real, es un MVP frontend-only).
 */
export default function AccesosPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const { cursos } = useCourses(community?.id ?? "");
  const { invitaciones, crear } = useInvitations(community?.id ?? "");

  const [correosTexto, setCorreosTexto] = useState("");
  const [cursoIdsSeleccionados, setCursoIdsSeleccionados] = useState<string[]>([]);
  const [todaLaComunidad, setTodaLaComunidad] = useState(false);

  const { validos, invalidos } = useMemo(() => parseCorreos(correosTexto), [correosTexto]);
  const haySeleccionDeCursos = todaLaComunidad || cursoIdsSeleccionados.length > 0;
  const puedeEnviar = validos.length > 0 && haySeleccionDeCursos;

  if (!hydrated) {
    return <AccesosSkeleton />;
  }

  if (!community) {
    return (
      <EmptyState
        icono={KeyRound}
        titulo="Todavía no tienes una comunidad"
        descripcion="No encontramos ninguna comunidad asociada a tu cuenta."
      />
    );
  }

  function toggleCurso(cursoId: string, marcado: boolean) {
    setTodaLaComunidad(false);
    setCursoIdsSeleccionados((prev) =>
      marcado ? [...prev, cursoId] : prev.filter((id) => id !== cursoId)
    );
  }

  function toggleTodaLaComunidad(marcado: boolean) {
    setTodaLaComunidad(marcado);
    if (marcado) setCursoIdsSeleccionados([]);
  }

  function handleEnviar() {
    if (!puedeEnviar) return;
    crear(validos, todaLaComunidad ? "todos" : cursoIdsSeleccionados);
    toast.success(`📧 ${validos.length} invitaciones enviadas`);
    setCorreosTexto("");
    setCursoIdsSeleccionados([]);
    setTodaLaComunidad(false);
  }

  const invitacionesOrdenadas = [...invitaciones].sort(
    (a, b) => new Date(b.creadaEl).getTime() - new Date(a.creadaEl).getTime()
  );

  return (
    <TooltipProvider>
      <div>
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Accesos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Da acceso a tus alumnos por correo — a un curso puntual o a toda la comunidad.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nueva invitación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="correos">Correos (uno por línea o separados por coma)</Label>
              <Textarea
                id="correos"
                value={correosTexto}
                onChange={(e) => setCorreosTexto(e.target.value)}
                placeholder={"ana@correo.com\nluis@correo.com, marta@correo.com"}
                className="min-h-28"
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {validos.length > 0 && (
                  <span className="text-muted-foreground">
                    {validos.length} {validos.length === 1 ? "correo válido" : "correos válidos"}
                  </span>
                )}
                {invalidos.length > 0 && (
                  <span className="text-destructive">
                    Inválidos: {invalidos.join(", ")}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2.5">
              <Label>¿A qué dan acceso?</Label>

              <label className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm has-aria-checked:border-primary/40 has-aria-checked:bg-primary/5">
                <Checkbox
                  checked={todaLaComunidad}
                  onCheckedChange={(v) => toggleTodaLaComunidad(v === true)}
                />
                <span className="font-medium text-foreground">Toda la comunidad</span>
                <span className="text-muted-foreground">— acceso a todos los cursos, presentes y futuros</span>
              </label>

              {cursos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía no publicas cursos individuales — por ahora solo puedes invitar a
                  &quot;Toda la comunidad&quot;.
                </p>
              ) : (
                <div
                  className={
                    "grid grid-cols-1 gap-2 sm:grid-cols-2" +
                    (todaLaComunidad ? " pointer-events-none opacity-50" : "")
                  }
                >
                  {cursos.map((curso) => (
                    <label
                      key={curso.id}
                      className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm has-aria-checked:border-primary/40 has-aria-checked:bg-primary/5"
                    >
                      <Checkbox
                        checked={cursoIdsSeleccionados.includes(curso.id)}
                        disabled={todaLaComunidad}
                        onCheckedChange={(v) => toggleCurso(curso.id, v === true)}
                      />
                      <span className="truncate text-foreground">{curso.titulo}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleEnviar} disabled={!puedeEnviar} size="lg">
              <Send /> Enviar invitaciones
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invitaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {invitacionesOrdenadas.length === 0 ? (
              <EmptyState
                icono={Mail}
                titulo="Aún no has enviado invitaciones"
                descripcion="Las invitaciones que envíes aparecerán aquí con su estado y link de acceso."
                className="border-none bg-transparent py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead>Cursos</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitacionesOrdenadas.map((inv) => (
                    <TableRow key={inv.token}>
                      <TableCell className="font-medium text-foreground">{inv.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {resumenCursosInvitacion(inv.cursoIds, cursos)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFechaLarga(inv.creadaEl)}
                      </TableCell>
                      <TableCell>
                        {inv.estado === "aceptada" ? (
                          <Badge className="border-transparent bg-accent/15 text-accent">
                            Aceptada
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.estado === "pendiente" && <CopiarLinkButton token={inv.token} />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
