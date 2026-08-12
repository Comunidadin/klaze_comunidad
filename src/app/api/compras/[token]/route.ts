import { NextResponse } from "next/server";
import { darAcceso } from "@/lib/dar-acceso";
import {
  canalPorToken,
  clienteAdmin,
  emailDelCuerpo,
  leerCuerpo,
  nombreDelCuerpo,
  registrar,
  topeAlcanzado,
} from "@/lib/compras";

/**
 * El enlace de compra: da acceso a quien acaba de comprar, sin que nadie toque
 * el panel.
 *
 * **No hay sesión.** El permiso es tener el token, que va en la dirección y son
 * 32 bytes aleatorios. Es el mismo trato que un enlace de invitación: quien lo
 * tiene, entra. Por eso el panel lo enseña con la advertencia de tratarlo como
 * una contraseña, y por eso hay tope diario y registro de todo lo que llega.
 *
 * Los códigos de estado están pensados para una máquina, no para una persona:
 *
 * - Token desconocido, canal apagado o academia suspendida → **404**, sin
 *   distinguir cuál de los tres. Un 403 confirmaría que el token existe.
 * - Cuerpo sin correo → **200**, no 400. Las herramientas de webhooks
 *   desactivan un destino que devuelve error, y aquí no hay nada que
 *   reintentar: el aviso va al panel, no al código de estado.
 * - El correo no sale pero el acceso se dio → **200** con `enviado: false`. Un
 *   502 haría que la otra aplicación reintentara y duplicara. Esto es lo
 *   contrario que en `/api/invitaciones`, donde el 502 sí sirve porque hay una
 *   persona mirando la pantalla.
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

  const canal = await canalPorToken(admin, token, "academia");
  if (!canal) {
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  }

  const { campos, crudo } = await leerCuerpo(request);
  const email = emailDelCuerpo(campos);

  if (!email) {
    await registrar(admin, canal.id, {
      email: null,
      accion: "alta",
      resultado: "sin_email",
      detalle: "No se encontró ningún correo en el cuerpo",
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, motivo: "sin_email" });
  }

  if (await topeAlcanzado(admin, canal)) {
    await registrar(admin, canal.id, {
      email,
      accion: "alta",
      resultado: "rechazado",
      detalle: "Tope diario alcanzado",
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, motivo: "tope_diario" }, { status: 429 });
  }

  try {
    const r = await darAcceso(admin, {
      comunidadId: canal.comunidadId,
      comunidadNombre: canal.comunidadNombre,
      email,
      nombre: nombreDelCuerpo(campos),
      cursoIds: canal.todosLosCursos ? "todos" : canal.cursoIds,
      origen: new URL(request.url).origin,
      enviarCorreo: true,
    });

    // Quien acaba de pagar espera acceso AHORA, no la próxima vez que inicie
    // sesión. Para una cuenta nueva ya lo hizo el trigger; para una que ya
    // existía —estudia en otra academia, o le reembolsaron y vuelve— el
    // trigger no salta, porque solo salta al crearse la cuenta.
    //
    // Es la misma función que corre al iniciar sesión, con el id por
    // parámetro, y es idempotente: llamarla de más no cuesta nada.
    if (r.usuarioId) {
      await admin.rpc("aceptar_invitaciones_de", { p_usuario: r.usuarioId });
    }

    await registrar(admin, canal.id, {
      email,
      accion: "alta",
      resultado: r.yaTenia ? "ya_tenia" : "creado",
      detalle: r.enviado ? "" : `El correo no salió: ${r.errorCorreo ?? "sin detalle"}`,
      cuerpo: crudo,
    });

    return NextResponse.json({ ok: true, enviado: r.enviado });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    await registrar(admin, canal.id, {
      email,
      accion: "alta",
      resultado: "rechazado",
      detalle,
      cuerpo: crudo,
    });
    return NextResponse.json({ ok: false, error: detalle }, { status: 500 });
  }
}
