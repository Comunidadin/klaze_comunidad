# Despliegue de Klaze a producción

**Fecha:** 2026-08-06
**Estado:** aprobado

## Qué hace

Publica Klaze en Cloudflare Workers con el adaptador OpenNext, que ya estaba
configurado y compilando. Lo que faltaba no era código: era el nombre del
worker, los secretos del servidor y que Supabase reconozca el dominio nuevo.

**URL:** `https://klaze.workers.dev`
**Cuenta:** `automatizacioncomunidad@gmail.com` (ID `01022d7888b61493d755cb0b16d43894`)

## Decisiones

| Decisión | Elegido | Por qué |
|---|---|---|
| Dónde | Cloudflare Workers | Ya configurado y compilando. Cambiar a Vercel tiraría lo que funciona; una VPS añade administrar un servidor a cambio de nada que se necesite. |
| Dominio | `klaze.workers.dev` | Gratis e inmediato. Sirve para probar y para enseñar internamente, no para vender: se nota que es provisional. |
| Nombre del worker | `klaze` | Era `comunidad-intercambio`, y el nombre **decide la URL** — habría publicado bajo la marca que acabábamos de sacar de la interfaz. |
| Vimeo | Fuera de alcance | Necesita la URL publicada para poder pegarla en su panel. Va después. |

## Lo que hay que aceptar

**En Cloudflare no hay middleware de Next.** Next 16 renombró `middleware.ts` a
`proxy.ts`, y ahí no existe la opción `runtime`: es solo Node, que Workers no
ejecuta. Ya rompió el build una vez y por eso `proxy.ts` se borró.

Consecuencia real: los guards de sesión son del lado del cliente, así que quien
pida una URL protegida recibe el esqueleto HTML antes de que le redirijan. **No
es un agujero** —los datos los protege RLS en la base, no la pantalla— pero
significa que la protección nunca vendrá de una capa intermedia. Si algún día
hace falta gatear en el servidor, habrá que salir de Workers.

## Dónde vive cada secreto

Tres sitios, y confundirlos es la forma más rápida de filtrar una clave.

| Variable | Dónde | Por qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, al compilar | Next la incrusta en el bundle del navegador. Es pública por diseño. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | igual | Igual. RLS la hace inofensiva. |
| `SUPABASE_SECRET_KEY` | secreto de Cloudflare | Se salta todas las políticas. Jamás con prefijo `NEXT_PUBLIC_`. |
| `RESEND_API_KEY` | secreto de Cloudflare | Permite mandar correo en nombre del dominio. |
| `RESEND_FROM` | secreto de Cloudflare | No es sensible, pero viaja con las otras dos y es más simple que esté al lado. |
| `SUPABASE_DB_URL` | **solo en tu máquina** | Es la contraseña maestra de Postgres. La usan las migraciones y las pruebas; el worker no la necesita y no debe tenerla. |

## Pasos

1. **Renombrar el worker** a `klaze` en `wrangler.jsonc`.
2. **Limpiar dos comentarios que mienten**: `next.config.ts` cita
   `src/lib/mocks/courses.ts`, que ya no existe, y `open-next.config.ts` dice
   que el estado real vive en `localStorage`, que dejó de ser cierto en la
   rebanada 2.
3. **Preview local** con `bun run cf:preview`: levanta el worker real con el
   runtime de producción. Es donde aparece cualquier dependencia de una API de
   Node que Workers no tenga, antes de publicar.
4. **Cargar los tres secretos** con `wrangler secret put`.
5. **Desplegar** con `bun run cf:deploy`.
6. **Añadir la URL a Supabase** — `Authentication → URL Configuration`: la URL
   del sitio y `https://klaze.workers.dev/callback` en las redirecciones
   permitidas.

   Sin esto, las invitaciones y los enlaces de acceso fallan **solo en
   producción** y con un error que no dice qué pasa. Es el paso que más tiempo
   cuesta diagnosticar si se olvida.
7. **Verificar en la URL publicada**: entrar como dueño, abrir `/plataforma`,
   dar de alta una academia de prueba y comprobar que la contraseña temporal
   sirve. Borrarla al terminar.

## Errores previstos

| Situación | Señal | Qué hacer |
|---|---|---|
| Falta un secreto | 500 en `/api/academias` o `/api/invitaciones` con "Faltan variables de servidor" | `wrangler secret list` y cargar el que falte. |
| Falta la URL en Supabase | El enlace de acceso lleva a una pantalla de error de Supabase | Paso 6. |
| Una API de Node no existe en Workers | El preview falla, el deploy no | Por eso el preview va antes. |
| El bundle supera el límite del plan | `wrangler` lo dice al desplegar | El worker iba por 1,74 MiB; el límite del plan gratuito son 3 MiB comprimidos. Hay margen. |

## Fuera de alcance

- Dominio propio de Klaze.
- Restricción de dominio en Vimeo.
- Despliegue automático desde GitHub.
- Rotar las credenciales expuestas — sigue pendiente y es del usuario.
