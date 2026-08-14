import { NextResponse } from "next/server";
import { crearAcademia } from "@/lib/academia";
import { enviarCorreo } from "@/lib/correo";
import { slugLibre } from "@/lib/slug";
import { correoAltaAcademia, escapar } from "@/lib/plantillas";
import {
  academiasDe,
  canalPorToken,
  clienteAdmin,
  emailDelCuerpo,
  empresaDelCuerpo,
  leerCuerpo,
  registrar,
  topeAlcanzado,
} from "@/lib/compras";
import { detalleParaRegistro, registrarFallo } from "@/lib/error-servidor";

/**
 * El súper enlace: alguien compra Klaze y su academia se monta sola.
 *
 * Es el nivel de arriba del mismo mecanismo que ya usa cada creador con sus
 * alumnos. Hasta ahora dar de alta una academia exigía entrar en `/plataforma`
 * y crearla a mano, así que vender la plataforma mientras duermes no era
 * posible.
 *
 * Comparte con `/api/compras/[token]` todo lo que no es el efecto final —
 * lectura del cuerpo, búsqueda del correo, tope diario y registro— porque es el
 * mismo trato: quien tiene el token, entra. Lo único distinto es que aquí lo
 * que se crea es una academia y no una inscripción.
 *
 * Solo acepta tokens de tipo `plataforma`. Uno de academia es aquí tan
 * desconocido como uno inventado.
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

  const origen = new URL(request.url).origin;

  // Estos correos se arman a mano con plantillas de texto, así que lo que entra
  // en un atributo se escapa aquí. No es adorno: `email` sale del cuerpo del
  // webhook, y `esEmailValido` deja pasar `<` y `>` —solo prohíbe espacios y un
  // segundo `@`—, así que `<b>x</b>@evil.com` es un correo válido para el
  // validador y HTML para el cliente de correo.
  const entrada = escapar(`${origen}/login`);

  try {
    // Lo primero: ¿ya tiene academia esta persona?
    //
    // `crearAcademia` es idempotente **por identificador**, y eso aquí no
    // basta. El identificador sale del nombre de la empresa, así que el mismo
    // comprador escribiéndolo distinto —o un formulario que reintenta— se
    // llevaba una segunda academia vacía, y sus alumnos se quedaban en la
    // primera. Lo salvó una prueba, no el sentido común.
    //
    // Una compra por persona: quien vuelve a pagar está renovando, no abriendo
    // una segunda escuela. Si algún día alguien quiere dos, se le crea a mano
    // desde /plataforma.
    const yaSuyas = await academiasDe(admin, email);

    if (yaSuyas.length > 0) {
      // Todas las que tenga, simétrico con lo que suspende la baja.
      await admin
        .from("comunidades")
        .update({ estado: "activa" })
        .in(
          "id",
          yaSuyas.map((a) => a.id)
        );

      // Los correos al creador los firma la plataforma: quien le escribe es
      // Klaze, no su propia academia.
      const correoVuelta = await enviarCorreo({
        para: email,
        remitenteNombre: "Klaze",
        asunto: `Tu academia ${yaSuyas[0].nombre} ya está activa`,
        html: `
          <p>Tu academia vuelve a estar activa. Tus alumnos ya pueden entrar.</p>
          <p>Entra en <a href="${entrada}">${entrada}</a> con tu
             contraseña de siempre.</p>`,
      });

      await registrar(admin, canal.id, {
        email,
        accion: "alta",
        resultado: "academia_reactivada",
        detalle: yaSuyas.map((a) => `/c/${a.slug}`).join(", "),
        cuerpo: crudo,
      });

      return NextResponse.json({
        ok: true,
        slug: yaSuyas[0].slug,
        enviado: correoVuelta.enviado,
      });
    }

    const empresa = empresaDelCuerpo(campos);
    const slug = await slugLibre(admin, empresa);

    // `crearAcademia` ya monta cuenta, perfil, rol, comunidad y la inscripción
    // del propio creador —sin ella, "Ver como alumno" le enseña una academia
    // vacía—.
    const r = await crearAcademia(admin, {
      email,
      empresa,
      slug,
      planId: canal.planId,
    });

    // `slugLibre` acababa de comprobar que ese identificador estaba libre, así
    // que `yaExistia` solo puede significar que otra alta se lo llevó en medio.
    // Devolver la academia de otro con este correo sería mandarle a alguien las
    // llaves de una casa ajena, así que se para aquí.
    if (r.yaExistia) {
      await registrar(admin, canal.id, {
        email,
        accion: "alta",
        resultado: "rechazado",
        detalle: `El identificador /c/${slug} se ocupó a mitad del alta. Vuelve a lanzarlo.`,
        cuerpo: crudo,
      });
      return NextResponse.json({ ok: false, motivo: "identificador_ocupado" }, { status: 409 });
    }

    // El mismo correo que sale del alta a mano en `/plataforma`. Estuvo escrito
    // aquí a pelo, con sus dos ramas, mientras la pantalla del panel no mandaba
    // nada; ahora los dos caminos comparten `correoAltaAcademia` para que no
    // acaben diciendo cosas distintas.
    const { asunto, html } = correoAltaAcademia({
      origen,
      empresa,
      slug,
      correo: email,
      password: r.passwordTemporal,
    });
    const correo = await enviarCorreo({
      para: email,
      asunto,
      html,
      remitenteNombre: "Klaze",
    });

    await registrar(admin, canal.id, {
      email,
      accion: "alta",
      resultado: "academia_creada",
      detalle: [
        `/c/${slug}`,
        correo.enviado ? "" : `El correo no salió: ${correo.error ?? "sin detalle"}`,
      ]
        .filter(Boolean)
        .join(" · "),
      cuerpo: crudo,
    });

    return NextResponse.json({ ok: true, slug, enviado: correo.enviado });
  } catch (e) {
    // El detalle entero va al registro --- lo lee el dueño del canal en su
    // panel, autenticado, y es lo que necesita para saber por qué alguien no
    // entró. Lo que NO puede es viajar en la respuesta: aquí quien la recibe es
    // cualquiera que haga el POST, sin sesión, y un error de Postgres trae
    // nombres de columna y de restricción.
    const detalle = detalleParaRegistro(e);
    registrarFallo("api/plataforma", e);
    await registrar(admin, canal.id, {
      email,
      accion: "alta",
      resultado: "rechazado",
      detalle,
      cuerpo: crudo,
    });
    return NextResponse.json(
      { ok: false, error: "No se pudo completar el alta" },
      { status: 500 }
    );
  }
}
