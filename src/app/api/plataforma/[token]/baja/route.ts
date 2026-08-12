import { NextResponse } from "next/server";
import {
  academiasDe,
  canalPorToken,
  clienteAdmin,
  emailDelCuerpo,
  leerCuerpo,
  registrar,
  topeAlcanzado,
} from "@/lib/compras";

/**
 * Un creador deja de pagarte: su academia se suspende.
 *
 * **Suspende, no borra.** Es la misma distinción que con un alumno, y aquí pesa
 * más todavía: detrás de una academia hay cursos, publicaciones y el progreso
 * de mucha gente. `pertenece_a` corta el contenido y `inscrito_en` deja ver la
 * fila, así que sus alumnos ven «suspendida» y no «no encontrada» — y el día
 * que vuelva a pagar, el alta la reactiva con todo dentro.
 *
 * Suspende **solo las academias que esa persona posee**. Su cuenta no se toca:
 * podría además estar estudiando en la academia de otro.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const admin = await clienteAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta configurar SUPABASE_SECRET_KEY" },
      { status: 500 }
    );
  }

  const canal = await canalPorToken(admin, token, "plataforma");
  if (!canal) {
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  }

  const { campos, crudo } = await leerCuerpo(request);
  const email = emailDelCuerpo(campos);

  if (!email) {
    await registrar(admin, canal.id, {
      email: null,
      accion: "baja",
      resultado: "sin_email",
      detalle: "No se encontró ningún correo en el cuerpo",
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, motivo: "sin_email" });
  }

  if (await topeAlcanzado(admin, canal)) {
    await registrar(admin, canal.id, {
      email,
      accion: "baja",
      resultado: "rechazado",
      detalle: "Tope diario alcanzado",
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, motivo: "tope_diario" }, { status: 429 });
  }

  const suyas = await academiasDe(admin, email);

  if (suyas.length === 0) {
    await registrar(admin, canal.id, {
      email,
      accion: "baja",
      resultado: "sin_cuenta",
      detalle: "Ese correo no es dueño de ninguna academia",
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, motivo: "sin_cuenta" });
  }

  const { data: filas, error } = await admin
    .from("comunidades")
    .update({ estado: "suspendida" })
    .in(
      "id",
      suyas.map((a) => a.id)
    )
    .select("slug");

  if (error) {
    await registrar(admin, canal.id, {
      email,
      accion: "baja",
      resultado: "rechazado",
      detalle: error.message,
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const suspendidas = (filas ?? []).map((f) => f.slug);

  await registrar(admin, canal.id, {
    email,
    accion: "baja",
    resultado: suspendidas.length > 0 ? "academia_suspendida" : "sin_cuenta",
    detalle:
      suspendidas.length > 0
        ? suspendidas.map((s) => `/c/${s}`).join(", ")
        : "Ese correo no es dueño de ninguna academia",
    cuerpo: crudo,
  });

  return NextResponse.json({ ok: suspendidas.length > 0, academias: suspendidas });
}
