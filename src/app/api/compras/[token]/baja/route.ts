import { NextResponse } from "next/server";
import {
  canalPorToken,
  clienteAdmin,
  emailDelCuerpo,
  leerCuerpo,
  registrar,
  topeAlcanzado,
} from "@/lib/compras";

/**
 * La otra mitad del enlace de compra: quitar el acceso.
 *
 * Se llama desde donde se entere del reembolso, el contracargo o la baja de la
 * suscripción — la misma herramienta que dispara el alta, o la pasarela.
 *
 * **Suspende, no borra.** Es la diferencia que ya existe en el modelo:
 * `pertenece_a` corta el contenido pero `inscrito_en` deja ver la fila, así que
 * el alumno ve «tu acceso está suspendido» en vez de «academia no encontrada».
 * Y si vuelve a comprar, el alta lo reactiva sin perder su progreso ni sus
 * puntos.
 *
 * Toca **solo esta academia**. La cuenta no se toca: la misma persona puede
 * estar estudiando en otra, y darla de baja aquí no puede dejarla fuera de allí.
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

  const canal = await canalPorToken(admin, token);
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

  if (await topeAlcanzado(admin, canal.id)) {
    await registrar(admin, canal.id, {
      email,
      accion: "baja",
      resultado: "rechazado",
      detalle: "Tope diario alcanzado",
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, motivo: "tope_diario" }, { status: 429 });
  }

  const { data: usuarioId } = await admin.rpc("perfil_por_email", { p_email: email });

  if (!usuarioId) {
    await registrar(admin, canal.id, {
      email,
      accion: "baja",
      resultado: "sin_cuenta",
      detalle: "Ese correo no tiene cuenta en Klaze",
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, motivo: "sin_cuenta" });
  }

  // `select()` y no solo `update()`: RLS aquí no filtra —va con la clave
  // secreta— pero un correo sin inscripción en ESTA academia actualiza cero
  // filas y vuelve sin error. Sin mirar las filas, se registraría como
  // suspendido alguien que nunca estuvo dentro.
  const { data: filas, error } = await admin
    .from("inscripciones")
    .update({ estado: "suspendido" })
    .eq("usuario_id", usuarioId)
    .eq("comunidad_id", canal.comunidadId)
    .select("id");

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

  const suspendido = (filas ?? []).length > 0;

  await registrar(admin, canal.id, {
    email,
    accion: "baja",
    resultado: suspendido ? "suspendido" : "sin_cuenta",
    detalle: suspendido ? "" : "No estaba inscrito en esta academia",
    cuerpo: crudo,
  });

  return NextResponse.json({ ok: suspendido });
}
