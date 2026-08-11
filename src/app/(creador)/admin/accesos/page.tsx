"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Mail, Send } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-session";
import { useMyCommunity } from "@/lib/hooks/use-my-community";
import { useCourses } from "@/lib/hooks/use-courses";
import { useInvitations } from "@/lib/hooks/use-invitations";
import { pedirEnlaceInvitacion } from "@/lib/invitaciones-api";
import { esEmailValido } from "@/lib/validation";
import { resumenCursosInvitacion } from "@/lib/invitation-summary";
import { formatFechaLarga } from "@/lib/format-fecha";
import { VentasAutomaticas } from "./_ventas-automaticas";
import { SelectorModulos } from "@/components/admin/selector-modulos";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

/**
 * Valida cada token y deduplica tanto los válidos como los inválidos
 * (case-insensitive), preservando el primer orden de aparición en ambos
 * casos — así pegar el mismo correo mal escrito varias veces no lo repite
 * en el aviso rojo.
 */
function parseCorreos(texto: string): CorreosParseados {
  const validos: string[] = [];
  const invalidos: string[] = [];
  const vistos = new Set<string>();
  const invalidosVistos = new Set<string>();

  for (const token of tokenizarCorreos(texto)) {
    if (!esEmailValido(token)) {
      const normalizadoInvalido = token.toLowerCase();
      if (invalidosVistos.has(normalizadoInvalido)) continue;
      invalidosVistos.add(normalizadoInvalido);
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

/**
 * Copia el enlace de ACCESO, no la dirección de la pantalla de invitación.
 *
 * La diferencia importa: `/invitacion/{token}` muestra el ofrecimiento pero no
 * deja entrar a nadie. El enlace de acceso sí crea la sesión, y lo genera el
 * servidor porque hace falta la clave secreta.
 *
 * Pedirlo NO manda correo: quien copia un enlace para mandarlo por su cuenta
 * no espera que además salga un correo.
 */
function CopiarLinkButton({
  comunidadId,
  email,
  token,
}: {
  comunidadId: string;
  email: string;
  token: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  async function copiar() {
    if (pidiendo) return;
    setPidiendo(true);
    try {
      const { enlace } = await pedirEnlaceInvitacion(comunidadId, email, token, true);
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos preparar el enlace."
      );
    } finally {
      setPidiendo(false);
    }
  }

  return (
    <Tooltip open={copiado || undefined}>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={copiar} disabled={pidiendo}>
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
 * `/admin/accesos` — el flujo estrella del producto: pegar correos, elegir a
 * qué dan acceso y enviar invitaciones.
 *
 * El correo sale de verdad, por Resend, con un enlace que crea la cuenta del
 * alumno y le concede los cursos de una sola vez. El botón de copiar existe
 * para la misma invitación por otra vía: los correos se pierden, se marcan
 * como spam y se borran sin querer, y un alumno bloqueado por eso no puede
 * esperar al siguiente intento.
 */
export default function AccesosPage() {
  const hydrated = useHydrated();
  const community = useMyCommunity();
  const { cursos } = useCourses(community?.id ?? "");
  const { invitaciones, crear } = useInvitations(community?.id ?? "");

  const [correosTexto, setCorreosTexto] = useState("");
  const [cursoIdsSeleccionados, setCursoIdsSeleccionados] = useState<string[]>([]);
  const [todaLaComunidad, setTodaLaComunidad] = useState(false);
  const [enviando, setEnviando] = useState(false);

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

  async function handleEnviar() {
    if (!puedeEnviar || enviando) return;
    setEnviando(true);
    try {
      const creadas = await crear(
        validos,
        todaLaComunidad ? "todos" : cursoIdsSeleccionados
      );

      // Se envía uno a uno y se cuentan los fallos por separado: si el correo
      // de alguien rebota, los demás ya salieron y su invitación sigue viva.
      // Abortar el lote entero por un correo malo sería peor.
      const fallidos: string[] = [];
      for (const inv of creadas) {
        try {
          await pedirEnlaceInvitacion(community!.id, inv.email, inv.token);
        } catch {
          fallidos.push(inv.email);
        }
      }

      if (fallidos.length === 0) {
        toast.success(
          creadas.length === 1
            ? "Invitación enviada"
            : `${creadas.length} invitaciones enviadas`
        );
      } else {
        toast.warning(
          `${creadas.length - fallidos.length} de ${creadas.length} enviadas. ` +
            `No salió el correo de: ${fallidos.join(", ")}. ` +
            `Su invitación está creada — copia el enlace desde la lista.`
        );
      }

      setCorreosTexto("");
      setCursoIdsSeleccionados([]);
      setTodaLaComunidad(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudieron crear las invitaciones"
      );
    } finally {
      setEnviando(false);
    }
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
            Da acceso a tus alumnos por correo — a un submódulo puntual o a toda la comunidad.
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

            {/* El mismo selector que usa «Editar acceso» en Alumnos: invitar y
                cambiar el acceso de alguien tienen que enseñar lo mismo, o el
                dueño creerá que ha dado un acceso distinto del que dio. */}
            <SelectorModulos
              cursos={cursos}
              valor={todaLaComunidad ? "todos" : cursoIdsSeleccionados}
              onCambio={(v) => {
                setTodaLaComunidad(v === "todos");
                setCursoIdsSeleccionados(v === "todos" ? [] : v);
              }}
            />

            <Button onClick={handleEnviar} disabled={!puedeEnviar || enviando} size="lg">
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
                    <TableHead>Módulos</TableHead>
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
                          <Badge className="border-transparent bg-brand/15 text-brand">
                            Aceptada
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.estado === "pendiente" && (
                          <CopiarLinkButton
                            comunidadId={community.id}
                            email={inv.email}
                            token={inv.token}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <VentasAutomaticas comunidadId={community.id} cursos={cursos} />
      </div>
    </TooltipProvider>
  );
}
