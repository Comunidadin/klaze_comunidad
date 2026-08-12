# Auditoría de seguridad — Klaze

**Fecha:** 12 de agosto de 2026
**Alcance:** todo el proyecto en `main` @ `585450e`, más el estado real de la base alojada.
**Método:** lectura de código, consultas de solo lectura contra Postgres (`pg_policies`, `pg_class`, `information_schema`, `storage.buckets`), `git log -S` sobre todo el historial, `bun run build` + grep del bundle, `bun audit`.

**Estado:** los 3 ALTO y los 5 MEDIO están arreglados y probados (12 de agosto).
Quedan los 4 BAJO. Cada hallazgo lleva su nota de cierre.

---

## 1. Resumen

| Gravedad | Hallazgos | Estado |
|---|---|---|
| **CRÍTICO** | 0 | — |
| **ALTO** | 3 | **arreglados** el 12/08 |
| **MEDIO** | 5 | **arreglados** el 12/08 |
| **BAJO** | 4 | pendientes |

> **Los ocho hallazgos ALTO y MEDIO están arreglados y probados** (migración `20260812160439_topes_de_uso`,
> `src/lib/limites.ts`, 13 pruebas nuevas). Cada uno lleva abajo su nota de cierre.
> Lo que se descubrió al arreglarlos y no estaba en el reporte original: la
> comprobación del tope de los canales **no era atómica**, así que un envío en
> paralelo se la saltaba entera. Ver el cierre de ALTO-2.

**Ningún secreto está filtrado.** Ni en el código, ni en el bundle del navegador, ni en el historial de Git — comprobado, no supuesto. Ese era el riesgo que más habría dolido y no está.

Lo que sí hay es un patrón: **tres endpoints gastan dinero o mandan correo desde tu dominio sin ningún límite**, y en dos de ellos la única credencial es una cadena que viaja en la URL. No es un fallo de código; es que el proyecto creció hasta tener superficie de abuso y todavía no tiene contadores.

Aparte del reporte, una cosa que no se ve en el repositorio y sigue pendiente desde antes: **las cinco credenciales que pasaron por el chat siguen sin rotar** (clave secreta de Supabase, contraseña maestra de la base, clave de Resend, contraseña del propietario, clave de OpenAI). Eso vence a todo lo de abajo en urgencia.

---

## 2. CRÍTICO

Ninguno.

Se comprobó específicamente, y todo salió limpio:

| Comprobación | Resultado |
|---|---|
| Secretos en código de cliente | **0.** Ningún archivo con `'use client'`, ni nada que importen, toca `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `OPENAI_API_KEY` ni `SUPABASE_DB_URL`. |
| Secretos en el bundle compilado | **0.** `grep -rn` sobre `.next/static/` tras `bun run build`: cero coincidencias con `service_role`, `sk-proj`, y ninguna de las variables de servidor. La única coincidencia con `sb_secret_` es código de la librería `@supabase/supabase-js` (`e.startsWith("sb_publishable_")||e.startsWith("sb_secret_")`), un chequeo de prefijo, no una clave. |
| Secretos en el historial de Git | **0.** `git log --all -S` sobre `sb_secret_`, `sk-proj`, `eyJhbGciOiJIUzI1NiIs` (JWT), y las contraseñas conocidas. Las dos coincidencias con `sb_secret_` son documentación (`.env.example` y un plan), no valores. Ningún `.env*` real estuvo nunca versionado — solo `.env.example`. |
| `.env.local` ignorado | Sí: `.gitignore:34` (`.env*`, con excepción explícita para `.env.example`). |
| Claves escritas a mano en el código | Ninguna. Todo pasa por `variableServidor()` o `process.env`. |
| `SERVICE_ROLE`/clave secreta fuera de servidor | No ocurre. Solo en `app/api/**/route.ts`, `src/lib/compras.ts`, `src/lib/academia.ts`, `src/lib/dar-acceso.ts` y `scripts/` — todos servidor. |
| `security definer` sin `search_path` | **0** de las funciones de `public` y `privado`. |
| Vistas que se saltan RLS | No hay vistas en `public`. |
| Tablas sin RLS | **0.** Las 23 tablas de `public` tienen RLS activado. |
| Políticas `using (true)` sin condición | 1, y es correcta (ver BAJO-4). |
| SQL construido concatenando texto | Ninguno. Todo va por PostgREST o por consultas parametrizadas de `bun:sql`. |

---

## 3. ALTO

### ALTO-1 · `/api/recuperar` no tiene autenticación, ni tope, ni verificación humana

**Dónde:** `src/app/api/recuperar/route.ts:29` (el `POST` entero), envío en `:99`.

**Qué está mal.** Es un endpoint público que, por cada petición, hace una llamada a la API de administración de Supabase y **manda un correo por tu cuenta de Resend**. No pide sesión, no lleva captcha, no cuenta peticiones por IP ni por dirección de correo, y no tiene retardo. Los enlaces de compra sí tienen tope (`TOPE_DIARIO = 200`, `src/lib/compras.ts:16`); este no tiene nada.

**Qué podría hacer un atacante.** Es el ataque más barato que existe hoy contra el proyecto — un bucle de tres líneas:

1. **Bombardeo de buzón.** Elige a un alumno cuyo correo conozca (o lo saque del directorio de miembros de su propia academia) y le manda miles de correos de recuperación. La víctima pierde su buzón; tú no te enteras.
2. **Quema de la cuota de Resend y del dominio.** El coste lo pagas tú. Peor que el dinero: un volumen anómalo de correo transaccional hace que los proveedores marquen tu dominio remitente. Cuando eso pasa, **dejan de llegar los correos de acceso de la gente que sí compró**, y recuperar la reputación de un dominio lleva semanas.
3. **Amplificación de phishing.** El cuerpo acepta un `slug` (`:63-69`) que elige de qué academia salen el nombre y la plantilla. Un atacante puede mandar a cualquier usuario registrado un correo con la marca de la academia que quiera, escrito por el dueño de esa academia, desde tu remitente legítimo.

El único freno actual: si la cuenta no existe, `generateLink` falla y no se manda nada (`:86`). Así que el bombardeo solo funciona contra direcciones reales — lo cual no ayuda mucho, porque son justo las que importan.

**Cómo se arregla.** Un contador en la base, del mismo estilo que `uso_ia`, con clave `(dia, email)` y otra `(dia, ip)`: tope de 3-5 por dirección al día y unas 20 por IP. Devolver siempre `{ok:true}` aunque se pase del tope, para no seguir revelando nada. Como la lógica ya existe en `topeAlcanzado`, es sobre todo trabajo de generalizarla, no de inventarla.

> ### ✅ Cerrado — 12 de agosto
>
> **5 por correo y 20 por IP al día**, en `src/app/api/recuperar/route.ts:78-96`.
>
> El orden de las tres comprobaciones no es casual: primero la IP —es la que
> corta el bucle, y hacerla antes evita que un atacante llene `limites_uso` con
> una fila por cada correo inventado—, después el formato, y solo al final el
> correo.
>
> **Pasarse del tope responde `{ok:true}`**, exactamente igual que acertar o que
> escribir una dirección inventada. Un 429 aquí diría "has llegado al límite de
> ESE correo", o sea "ese correo existe", y habría devuelto por la ventana la
> enumeración de usuarios que este endpoint ya protegía.
>
> Probado en `tests/rls/api-recuperar.test.ts`: que las tres respuestas son
> indistinguibles, y que el tope por IP frena aunque el atacante cambie de
> correo en cada intento —contar solo por correo no habría sido un tope, porque
> quien manda en bucle nunca repite dirección.

---

### ALTO-2 · Los webhooks de compra no verifican firma: la URL entera es la contraseña

**Dónde:** `src/app/api/compras/[token]/route.ts:34-48` y `src/app/api/plataforma/[token]/route.ts:32-46`, resolviendo por `canalPorToken` (`src/lib/compras.ts:73`).

**Qué está mal.** No hay HMAC, ni cabecera de firma, ni marca de tiempo, ni protección contra reenvío. Lo único que autentica la petición es el token de 32 bytes que va **en el path de la URL**.

Quiero ser justo con el diseño: un token secreto en la URL **sí es** una credencial legítima, es lo que hacen varias pasarelas, es aleatorio de verdad, tiene tope diario y deja registro en `recepciones_canal`. Por eso lo clasifico ALTO y no CRÍTICO, en contra de lo que dice el prompt de auditoría por defecto. Pero tiene tres debilidades que una firma no tendría:

- **Las URLs se registran en todas partes.** Logs de la pasarela, logs de Cloudflare, historial del navegador si alguien la pega para probarla, proxies intermedios, capturas de pantalla en soporte.
- **Es la misma cadena para siempre.** No caduca ni rota; quien la vea una vez la tiene para siempre. Una firma HMAC solo sirve para el cuerpo que firmó.
- **Cualquier petición vale.** No hay forma de distinguir la de tu pasarela de la de alguien que copió la URL.

**Qué podría hacer un atacante.** Quien obtenga la URL de un enlace de compra se da acceso gratis a esa academia mandando un `POST` con su correo, hasta 200 veces al día. Y quien obtenga la del **súper enlace** (`/api/plataforma/[token]`) **se crea academias enteras en tu plataforma**, con cuenta de creador incluida, hasta 200 al día. Ese segundo es el que convierte esto en ALTO: no es un alumno colado, es un inquilino nuevo.

**Cómo se arregla.** Dos capas, y la primera ya se puede hacer hoy:

1. Mover el token del path a una cabecera (`X-Klaze-Token`) o al cuerpo. Deja de aparecer en logs y en historiales de golpe. Es el cambio barato.
2. Donde la pasarela lo permita, firma HMAC sobre el cuerpo más una marca de tiempo, rechazando lo que llegue con más de cinco minutos. Requiere que la otra herramienta sepa firmar, y muchas de las que usan tus creadores no saben — de ahí que valga la pena hacer (1) igualmente.
3. Independientemente: baja el tope del canal de plataforma. 200 academias al día no es un tope, es un techo de sala. Con 5 sobra.

> ### ✅ Cerrado — 12 de agosto (con una corrección al propio hallazgo)
>
> **Dos cosas que el reporte original no había visto:**
>
> **La rotación del token ya existía.** Función, política —que ya separa
> correctamente los canales de plataforma para el superadmin— y botón
> «Regenerar» en los dos paneles. El reporte proponía construirla; estaba
> construida. La mitigación de fondo de "credencial en la URL" —poder
> reemplazarla en diez segundos— ya la tenías.
>
> **La comprobación del tope no era atómica, y eso sí era un agujero.**
> `topeAlcanzado` hacía `select count(*)` sobre `recepciones_canal`, luego
> ocurría el trabajo, y el registro se escribía al final. Entre la cuenta y el
> registro cabía un envío entero: veinte peticiones simultáneas leían todas el
> mismo número y pasaban todas. Con el tope de 200 era una molestia. Bajar el de
> plataforma a 5 lo habría convertido en un adorno — un `for` en paralelo lo
> salta y crea veinte academias.
>
> Ahora `topeAlcanzado` **consume** en vez de mirar, con la misma
> `consumir_limite` de ALTO-1: la suma y la comparación en una sola sentencia,
> sin ventana. `src/lib/compras.ts:310-330`.
>
> **Tope por tipo:** `academia` 200, `plataforma` **5** (`src/lib/limites.ts`).
>
> `tests/rls/topes.test.ts` T3 es la prueba que justifica el cambio: veinte
> llamadas simultáneas contra un tope de cinco dejan pasar exactamente cinco.
> Contra la versión anterior habrían pasado las veinte.
>
> **Lo que NO se hizo, y por qué.** Mover el token a una cabecera. La premisa
> del producto es que el enlace funcione con la herramienta que use cada
> creador, y buena parte no sabe mandar cabeceras. Aceptar las dos formas no
> habría dado ninguna seguridad —el camino débil seguiría abierto—, así que la
> defensa real es la que ya hay: token de 32 bytes, tope ajustado, registro de
> todo lo que llega, y rotación en un clic. El panel del súper enlace ahora dice
> las tres cosas.

---

### ALTO-3 · `/api/invitaciones` deja mandar correo ilimitado desde tu dominio

**Dónde:** `src/app/api/invitaciones/route.ts:23` en adelante; envío en `src/lib/dar-acceso.ts:158` → `src/lib/correo.ts:35`.

**Qué está mal.** La autorización es correcta —comprueba sesión (`:44`) y que sea el dueño de esa academia (`:85-88`)— pero **no hay ningún tope**. Un dueño de academia puede llamarlo en bucle con direcciones arbitrarias.

**Qué podría hacer un atacante.** Aquí el atacante es un cliente tuyo, que es un modelo de amenaza incómodo pero real en cuanto vendas Klaze a desconocidos. Con una cuenta de creador legítima:

- Manda correo masivo a listas que no son suyas, **desde tu dominio verificado en Resend**. Las denuncias de spam llegan a tu remitente, no al suyo.
- Te agota la cuota de Resend, con la misma consecuencia que en ALTO-1: dejan de salir los correos de acceso de todos los demás.
- Cada invitación **crea una cuenta de Supabase** para la dirección invitada (`dar-acceso.ts:119`). Miles de invitaciones son miles de usuarios reales en tu proyecto, contra tu plan.

**Cómo se arregla.** Tope por academia y día en la misma tabla que resuelva ALTO-1. Un número honesto para el uso real: 50 invitaciones al día por academia, subible bajo petición. Y registrar el desbordamiento en algún sitio que mires — un creador que choca contra el tope todos los días es información de negocio, no solo de seguridad.

> ### ✅ Cerrado — 12 de agosto
>
> **50 invitaciones al día por academia**, en `src/app/api/invitaciones/route.ts:96-118`.
>
> Va **después** de comprobar que la academia es suya, y ese orden es media
> defensa: al revés, cualquiera con sesión podría agotar el cupo de una academia
> ajena con solo conocer su id, y el freno al abuso sería la herramienta del
> abuso. Hay una prueba dedicada a ese orden.
>
> Cuenta también cuando solo se copia el enlace sin enviar correo: `darAcceso`
> crea la cuenta de Supabase igual, y son esas cuentas —no solo los correos— lo
> que se podía fabricar a miles. Copiar el enlace de la misma persona varias
> veces sale casi gratis: la cuenta ya existe a partir de la primera.
>
> Aquí sí responde **429 con el motivo escrito**, al contrario que
> `/api/recuperar`: quien llama es el dueño autenticado de esa academia, así que
> no hay nada que ocultarle y sí bastante que explicarle.

---

## 4. MEDIO

### MEDIO-1 · El `slug` de una academia no se valida en la base, y acaba sin escapar dentro del correo de bienvenida

**Dónde:** `src/lib/plantillas.ts:189`; columna en `supabase/migrations/20260806023139_base_perfiles_planes_comunidades.sql:30`; limpieza solo de pantalla en `src/app/(creador)/admin/configuracion/page.tsx:160`.

**Qué está mal.** `bloqueAcceso` interpola la URL de entrada sin escapar:

```ts
const entrar = `<p>Entra en <a href="${o.loginUrl}">${o.loginUrl}</a></p>`;
```

y esa URL lleva dentro el `slug` (`src/lib/dar-acceso.ts:148`). La columna es `slug text not null unique`, **sin `check` de formato**. La única limpieza (`slugDesde()`) está en el formulario, y RLS deja al propietario escribir su propia fila.

**Qué podría hacer un atacante.** Un dueño de academia hace un `PATCH` directo a la API de Supabase con su sesión normal, saltándose el formulario, y guarda un slug con comillas y etiquetas. El trigger `congelar_slug_con_alumnos` no lo impide: solo bloquea el cambio **cuando ya hay alumnos**, y esto se hace antes de invitar a nadie. Después invita, y cada correo de bienvenida lleva su HTML dentro del bloque que Klaze presenta como el de confianza — el único sitio del correo donde el alumno espera un enlace legítimo.

Importa más de lo que parece porque todo `plantillas.ts` está construido sobre la regla de que el dueño escribe texto plano y Klaze escapa (por eso `render(..., escapa: true)`, por eso el bloque de acceso no es editable). Esto es exactamente la puerta que esa regla cerraba, abierta por el otro lado.

**Cómo se arregla.** Las dos cosas, no una:

```sql
alter table public.comunidades
  add constraint slug_formato check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$');
```

y escapar igualmente en `bloqueAcceso` y `bloqueRecuperacion`. Lo mismo aplica a `src/app/api/plataforma/[token]/route.ts:166,182`, donde `${slug}` va sin escapar; ahí el valor lo genera `slugLibre()` y hoy es seguro, pero el patrón no debería depender de eso.

> ### Cerrado - 12 de agosto
>
> Las dos mitades, porque una sola no bastaba. La restriccion
> `comunidades_slug_formato` en la base (migracion `20260812163342`), y el
> escapado en `bloqueAcceso` y `bloqueRecuperacion`. Se escapa **aunque la base
> ya lo impida**: lo que entra en un atributo se escapa, sin averiguar cada vez
> de donde venia. Averiguarlo es lo que se hace mal el dia que cambia el origen.
>
> **Y apareció uno mas que el reporte no habia visto.** Los correos de
> `/api/plataforma` se arman a mano y metian `email` sin escapar en
> `<strong>${email}</strong>`. Ese correo sale del cuerpo del webhook, y
> `esEmailValido` deja pasar `<` y `>` --- solo prohibe espacios y un segundo
> `@` ---, asi que `<b>x</b>@evil.com` es valido para el validador y HTML para
> el cliente de correo. Escapados los cinco puntos de interpolacion.
>
> `tests/rls/endurecimiento.test.ts` M1 y M1b prueban los dos caminos: crear una
> academia con slug malo, y **renombrar** la tuya antes de invitar a nadie ---
> que es el camino real del ataque, porque el trigger del slug solo frena cuando
> ya hay alumnos.

---

### MEDIO-2 · Cuatro políticas dicen `to public` en vez de `to authenticated`, y `anon` tiene permisos completos sobre todas las tablas

**Dónde:** estado real de la base, no del código fuente.

| Tabla | Política | Operación |
|---|---|---|
| `comunidades` | los miembros la ven | SELECT |
| `comunidades` | el propietario edita la suya | UPDATE |
| `cursos` | los gestiona el propietario | ALL |
| `modulos` | via su curso | SELECT |

Las otras 19 tablas dicen `to authenticated`. Estas cuatro no.

Y por separado: el rol `anon` tiene `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` sobre **las 23 tablas** de `public`. Eso viene de los privilegios por defecto de Supabase (`pg_default_acl` concede `arwdDxtm` a `anon` en `public`), así que **cada tabla nueva los hereda automáticamente**, incluida `plantillas_correo` de ayer.

**Qué podría hacer un atacante — hoy, nada.** Lo verifiqué condición por condición: las cuatro dependen de `auth.uid()` o de un resolver que lo usa (`inscrito_en`, `es_propietario_de`, `cubre_curso`), y para un anónimo `auth.uid()` es nulo, así que ninguna deja pasar una sola fila. Por eso es MEDIO y no ALTO.

**Por qué lo reporto igual.** Lo único que separa a internet anónimo de escritura completa sobre tu base es que cada condición devuelve falso con un uid nulo. Una política futura escrita sin la cláusula `to` —que por defecto es `public`, o sea todos, incluido `anon`— y con una condición que no dependa de `auth.uid()`, y se acabó. Y este proyecto añade tablas y políticas cada semana. La convención existe en las otras 19; estas cuatro son las que se saltaron el patrón.

**Cómo se arregla.** Recrear las cuatro con `to authenticated`, y añadir a `tests/rls/auditoria.test.ts` una comprobación de que ninguna política de `public` tiene el rol `public` — el mismo sitio donde ya vigilas las tablas sin política de escritura.

> ### Cerrado - 12 de agosto
>
> Migracion `20260812163344`. Las cuatro politicas recreadas con el mismo cuerpo
> y `to authenticated`, y ademas **revocados todos los permisos de `anon` sobre
> `public`** --- las 23 tablas y sus secuencias.
>
> Lo que de verdad cierra esto es la tercera linea: `alter default privileges in
> schema public revoke all on tables from anon`. Sin ella, la proxima `create
> table` volveria a conceder todo a `anon` y habria que acordarse de revocarlo
> cada vez. Acordarse no es un mecanismo.
>
> **Comprobado antes de tocar nada:** ninguna pagina publica lee tablas. El
> login no consulta `comunidades` --- solo pasa el slug a `/api/recuperar` --- y
> la invitacion tampoco. No habia lectura anonima que romper. `storage.objects`
> no se toca: las imagenes publicas tienen que seguir viendose sin sesion.
>
> Cuatro pruebas: que no queda ninguna politica con rol `public`, que `anon` no
> tiene ni un permiso, que **una tabla recien creada tampoco los hereda**, y que
> las condiciones de las cuatro politicas quedaron identicas --- recrear
> politicas es donde se rompe el acceso de todo el mundo sin enterarse.

---

### MEDIO-3 · Se admiten SVG en un bucket público

**Dónde:** `src/components/shared/subir-imagen.tsx:24` (`TIPOS` incluye `image/svg+xml`); bucket `publico` en Supabase Storage, con `public: true`, límite de 5 MB y esos cuatro tipos MIME, política `publico: lectura libre` para SELECT.

**Qué está mal.** Un SVG es un documento XML que puede contener `<script>`. El bucket lo acepta y lo sirve con su `content-type` real. La validación de tamaño y tipo sí está también del lado del servidor (el bucket la aplica), así que eso está bien; el problema es el tipo elegido, no dónde se valida.

**Qué podría hacer un atacante.** Cualquier usuario que pueda subir un avatar sube un SVG con script dentro. La URL queda en `<proyecto>.supabase.co`, que es **otro origen** distinto de la app, así que ese script no puede leer la sesión de nadie en Klaze — por eso no es ALTO. Lo que sí consigue es alojar una página activa en un dominio que parece tuyo y que tus alumnos reconocen, útil para phishing, y la app lo renderiza en `<img>` (donde no se ejecuta) pero el enlace directo sí abre.

**Cómo se arregla.** Quitar `image/svg+xml` de `TIPOS` y de `allowed_mime_types` del bucket. Nada de la interfaz necesita SVG subido por el usuario: `SubirImagen` ya convierte a WebP en el navegador antes de subir.

> ### Cerrado - 12 de agosto
>
> Fuera de las dos listas: del bucket (migracion `20260812163345`, que es la que
> manda porque no depende de que el navegador se porte bien) y de `TIPOS` en
> `subir-imagen.tsx`, para que el aviso salga al elegir el archivo y no despues
> de subirlo.
>
> No rompio nada, y se comprobo antes: no habia ningun SVG guardado, y
> `SubirImagen` recorta y convierte a WebP antes de subir, asi que ningun camino
> real de la aplicacion subia uno.

---

### MEDIO-4 · No hay cabeceras de seguridad

**Dónde:** `next.config.ts` — no define `headers()`. No hay `middleware.ts`.

**Qué está mal.** No se envía `Content-Security-Policy`, ni `X-Frame-Options`/`frame-ancestors`, ni `X-Content-Type-Options`, ni `Referrer-Policy`, ni `Strict-Transport-Security`.

**Qué podría hacer un atacante.** Sin CSP, cualquier XSS que aparezca en el futuro se ejecuta sin ningún freno — y el proyecto renderiza contenido escrito por creadores en varios sitios. Sin `frame-ancestors`, tu panel se puede meter en un iframe en la web de otro y superponerle botones invisibles, lo que basta para conseguir clics en acciones destructivas (eliminar módulo, suspender alumno) de un dueño que cree estar en otra página.

**Cómo se arregla.** Un bloque `headers()` en `next.config.ts`. `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y HSTS se pueden poner hoy sin romper nada. La CSP pide más cuidado: los embeds de clase y las imágenes de dominios arbitrarios necesitan `img-src *` y `frame-src *`, así que empieza con `Content-Security-Policy-Report-Only` y mírala una semana antes de hacerla efectiva.

> ### Cerrado - 12 de agosto (la CSP, en modo aviso)
>
> Seis cabeceras en `next.config.ts`, verificadas contra el servidor. Cinco
> bloquean desde ya: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
> `Permissions-Policy` (camara, microfono, geolocalizacion y pago apagados) y
> HSTS a un ano.
>
> **La CSP va en `Report-Only`, y es lo unico de esta tanda que queda a medias
> a proposito.** Una clase puede insertar el formulario de cualquier servicio y
> ensenar imagenes de cualquier dominio; una CSP estrecha rompe clases **en
> silencio** --- el alumno ve un hueco en blanco y nadie se entera hasta que se
> queja. En modo aviso el navegador la comprueba y la anota en su consola sin
> bloquear.
>
> Aun asi aprieta lo que si se puede cerrar sin riesgo: `object-src 'none'`,
> `base-uri 'self'` (que un `<base>` inyectado no redirija todas las rutas
> relativas a otro dominio) y `form-action 'self'` (que un formulario inyectado
> no publique credenciales fuera).
>
> **Lo que queda por hacer, y es tuyo:** abre la consola del navegador en tu
> academia durante una semana normal --- con clases que tengan embeds e
> imagenes --- y mira los avisos de CSP. Si no aparece ninguno, se cambia
> `Content-Security-Policy-Report-Only` por `Content-Security-Policy` y pasa a
> bloquear. `tests/rls/cabeceras.test.ts` C3 se da la vuelta ese dia.

---

### MEDIO-5 · El `sandbox` de los embeds dice lo contrario que hace

**Dónde:** `src/components/course/bloques-clase.tsx:140-143`.

```tsx
// Sin `allow-same-origin` respecto a NUESTRO origen: lo de dentro no puede
// leer la sesión de quien mira.
sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-presentation"
```

`allow-same-origin` **sí está**. Y `urlDeEmbed` acepta cualquier `https://`, incluido tu propio dominio, con lo cual un creador puede enmarcar una página de Klaze y `allow-scripts` + `allow-same-origin` anula el aislamiento del marco.

**Qué podría hacer un atacante.** Hoy, que yo haya podido encontrar, nada: para aprovecharlo haría falta un punto donde se refleje HTML controlado en tu propio origen, y no lo hay — `bloques-clase.tsx` pinta desde el documento estructurado y nunca desde HTML. Lo reporto porque el comentario **afirma una protección que no existe**, y eso es exactamente lo que hace que dentro de seis meses alguien construya encima confiando en ella.

**Cómo se arregla.** O quitas `allow-same-origin` (y compruebas qué embeds dejan de funcionar: Calendly y Google Forms suelen necesitarlo), o rechazas en `urlDeEmbed` las URLs de tu propio dominio, o corriges el comentario. Lo peor es dejarlo como está.

> ### Cerrado - 12 de agosto (la segunda opcion, no la del comentario)
>
> Se rechazan las direcciones del propio dominio, que es la que quita el riesgo
> sin quitarle nada a nadie: `urlDeEmbed` las devuelve `null` al guardar, con
> una pista que explica por que, y `EmbedDeClase` se niega a pintarlas tambien
> al mostrar --- los bloques guardados antes de esta regla siguen en la base, y
> una regla que solo se aplica al escribir no alcanza a lo que ya esta escrito.
>
> `allow-same-origin` se queda: para una pagina de Calendly o Google Forms
> significa que corre en SU origen, que es lo normal y no le da acceso a nada de
> aqui --- sin ese permiso ni siquiera podrian usar sus cookies y la mitad
> dejaria de cargar. El problema era solo enmarcar una direccion nuestra, y ese
> caso ya no existe.
>
> Y el comentario ahora dice lo que hace el codigo.

---

## 5. BAJO

### BAJO-1 · `cambiarEstadoAlumno` no comprueba filas afectadas

**Dónde:** `src/lib/supabase/alumnos.ts:151-164`.

Es el único escritor del archivo sin la comprobación de cero filas que sí tienen `cambiarAccesoAlumno` (`:117`), `guardarPlantilla`, `borrarCurso`, `reordenarCursos` y `guardarEvento`. RLS filtra en vez de lanzar: si la política rechaza el `update`, suspender vuelve sin error y el panel dice que sí.

Sin consecuencia de seguridad —el rechazo significa que no es su academia— pero rompe la convención del propio proyecto y hace que suspender mienta. Se arregla con un `.select("id")` y un `throw` si vuelve vacío.

### BAJO-2 · Dependencias con avisos altos, todas fuera del tiempo de ejecución

`bun audit`: 25 avisos (12 altos, 12 moderados, 1 bajo). Revisé las cadenas una a una y **ninguna llega al Worker desplegado**:

| Paquete | Llega por | Cuándo corre |
|---|---|---|
| `brace-expansion`, `js-yaml`, `fast-uri` | eslint, shadcn, @opennextjs/cloudflare | desarrollo |
| `hono`, `@hono/node-server`, `ip-address` | shadcn › @modelcontextprotocol/sdk | desarrollo |
| `postcss`, `nanoid` | next › postcss, @tailwindcss/postcss | compilación |
| `sharp` | next › sharp, wrangler › miniflare | compilación / local — el proyecto no usa `next/image` (dicho en `next.config.ts`) |
| `undici` | wrangler › miniflare, shadcn | local — en Cloudflare el `fetch` es el de la plataforma |

`bun update` recoge lo que se pueda sin romper nada. No es urgente.

### BAJO-3 · `/api/academias` devuelve el mensaje de error interno

**Dónde:** `src/app/api/academias/route.ts:84`. El `catch` devuelve `e.message` en el 500, que puede llevar texto de Postgres (nombres de restricción, de columna). Solo lo alcanza un superadmin autenticado, así que el impacto es mínimo, pero es información de la base saliendo por la puerta de una respuesta HTTP. Registrar el detalle y devolver un texto genérico.

### BAJO-4 · `planes` con `using (true)`

Es la única política sin condición de todo el proyecto. Es correcta: `planes` es el catálogo de tarifas, lo mismo para todo el mundo, y solo `SELECT` para `authenticated`. Lo dejo anotado para que no salte como sorpresa en la próxima auditoría.

---

## 6. Lo que se comprobó y está bien

Merece figurar, porque son las cosas que fallan en la mayoría de proyectos de este tamaño:

**Autorización por endpoint.** Los nueve endpoints están cubiertos. Los tres que usan la clave secreta y necesitan sesión (`/api/academias`, `/api/invitaciones`, `/api/baja`) comprueban a mano, en este orden: JWT presente → `getUser` válido → **y el permiso concreto sobre el recurso concreto**, no solo "está logueado". `/api/academias:69` lee el rol de `app_metadata` y nunca de `user_metadata`. `/api/baja:84` va más allá y verifica que el alumno esté de verdad `suspendido` en esa academia — sin eso, un dueño podría mandar correo con su marca a cualquier cuenta de Klaze pasando un id ajeno. No encontré ni un solo IDOR.

**`/api/ia`.** Comprueba el acceso a la lección **con la sesión del alumno**, creando un cliente con su JWT, para que la regla siga viviendo en las políticas y no se duplique en el handler. Incrementa el contador antes de llamar a OpenAI. Tope diario en la base, no en el navegador.

**Nada de protección solo-de-interfaz.** Los cuatro guards de rol son de navegación; la regla real está en las políticas de Postgres. Un botón oculto no protege nada aquí porque no es lo que protege.

**Aislamiento entre academias.** Los resolvers de `privado` son el punto único de verdad y ningún consumidor los rodea. `cubre_curso` une por `comunidad_id`, así que un `curso_id` de otra academia metido a mano en `inscripcion_cursos` no concede absolutamente nada.

**Storage.** Las políticas van por carpeta y por dueño: `avatares/{uid}/` contra `auth.uid()`, `academias/{id}/` contra `es_propietario_de`. Nadie escribe en la carpeta de otro.

**Enumeración de usuarios.** `/api/recuperar` responde `{ok:true}` exista o no la cuenta, y está documentado por qué. No hay mensajes que revelen si un correo está registrado.

**Registros.** Un solo `console.*` en todo `src/`, y no imprime nada sensible.

**Validación en servidor.** `esEmailValido` se aplica del lado del servidor en los enlaces de compra; el `slug` se valida con regex en `/api/academias:76`. El hueco es el `slug` por la vía directa de Supabase (MEDIO-1), no los endpoints.

---

## 7. Qué arreglar primero

> **Actualización del 12 de agosto:** los puntos 2 y 3 de esta lista están
> hechos. Queda el primero, que es el único que no depende de código, y después
> los MEDIO.

Tres cosas, por relación entre riesgo eliminado y trabajo.

### Primero — rotar las cinco credenciales

No sale en ningún hallazgo porque no se ve en el repositorio, y aun así vence a todo lo demás. Clave secreta de Supabase, contraseña maestra de la base, clave de Resend, contraseña del propietario y clave de OpenAI pasaron por un chat. Son quince minutos y anulan por completo la peor hipótesis. Todo lo de abajo asume que esto ya está hecho.

### Segundo — poner topes a los tres endpoints que gastan (ALTO-1 y ALTO-3)

Una tabla con clave `(dia, clave)`, del mismo estilo que `uso_ia`, y tres llamadas. Cierra los dos hallazgos ALTO más fáciles de explotar hoy y protege lo único que no se puede comprar de vuelta: **la reputación de tu dominio de correo**. Si tu remitente se marca como spam, deja de llegar el correo de acceso de todos tus clientes a la vez, y eso tarda semanas en revertirse.

### Tercero — sacar el token del webhook de la URL y bajar el tope del súper enlace (ALTO-2)

Mover el token del path a una cabecera es un cambio de pocas líneas en dos rutas, y deja de sembrar la credencial en logs, historiales y proxies. Bajar el tope del canal de plataforma de 200 a 5 es cambiar un número, y convierte "me crean 200 academias" en "me crean 5 y me entero". La firma HMAC es mejor, pero depende de que la pasarela sepa firmar; estas dos no dependen de nadie.

---

**Los cinco MEDIO tambien estan hechos** (12 de agosto). Queda por decidir una
sola cosa, y es de calendario, no de codigo: pasar la CSP de `Report-Only` a
bloquear, despues de una semana mirando la consola en una academia con clases
reales. Ver el cierre de MEDIO-4.

Y sigue pendiente lo unico que no depende de codigo: **rotar las cinco
credenciales**, el **Site URL de Supabase** y **restringir el dominio en
Vimeo**.

---

## 8. Lo que esta auditoría no cubre

Por honestidad sobre sus límites:

- **No probé la aplicación corriendo.** Todo es análisis de código y consultas a la base. Un fallo que solo aparece con dos usuarios actuando a la vez no se ve aquí.
- **Las pruebas siguen corriendo contra la base de producción.** Es lo que metió academias `empresa-a-*` en tu panel real. No es un hallazgo de seguridad, pero es la clase de cosa que un día borra algo. Sigue pendiente montar un proyecto de Supabase aparte para las pruebas.
- **No es determinista.** Correr esto otra vez puede encontrar cosas distintas. Es una primera pasada, no un certificado.
