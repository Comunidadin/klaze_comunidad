# Rebanada 1 — Tu academia y tus cursos, de punta a punta

Fecha: 2026-08-06
Estado: propuesto, pendiente de revisión
Sucede al cimiento (`2026-08-05-backend-cimiento-design.md`)

## 1. Objetivo

Que el dueño pueda **crear su academia, entrar de verdad, cargar su curso con
los enlaces de Vimeo, y verlo como lo verá un alumno** — con todo guardado en
Postgres, no en el navegador.

**Criterio de terminación.** Una sesión completa que hoy es imposible:

1. Se da de alta la academia con un comando.
2. El dueño entra con un enlace recibido por correo. Ninguna contraseña.
3. Crea un curso, un módulo y una lección, y pega el enlace de Vimeo.
4. **Recarga la página, y todo sigue ahí.**
5. Abre la misma cuenta en otro navegador y ve lo mismo.
6. Publica el curso y lo ve desde el área de miembro, con el vídeo funcionando.

El paso 4 es el que hoy falla y el que define la rebanada.

### Por qué esta reordenación

El plan original iba por capas (todas las lecturas, luego todas las escrituras).
Con ese orden, cargar la primera clase solo era posible al terminar las dos.
Esta rebanada corta en vertical: menos ordenado, pero termina en algo usable.

## 2. Alcance

**Entra:** alta de la academia, sesión real por enlace de correo, lectura del
armazón (perfil, comunidad, cursos con sus módulos y lecciones) y escritura de
cursos desde `/admin/cursos`.

**No entra:** alumnos e invitaciones (rebanada 2), feed, comentarios, eventos,
ranking y directorio (rebanada 3), subida de archivos, y las pantallas de
`/plataforma` del superadmin.

### El estado intermedio, y por qué es seguro

Durante esta rebanada convivirán datos reales con pantallas que aún leen mocks.
Está comprobado que eso **degrada a vacío, no a roto**: `useFeed`, `useEvents`,
`useMembers` y `useGamification` filtran sus mocks por `comunidadId`, y una
comunidad real (UUID) no coincide con ninguno, así que devuelven listas vacías.
Ninguno lanza.

Consecuencia visible y aceptada: con la academia real, el feed y el calendario
se ven vacíos hasta la rebanada 3.

## 3. Alta de la academia

Un comando, no una pantalla: las pantallas que escriben del superadmin son
trabajo posterior y aquí solo hace falta arrancar.

```bash
bun run crear-academia -- --email jefe@empresa.com --empresa "Mi Empresa" --slug mi-empresa
```

`scripts/crear-academia.ts` usa la clave secreta y, en una transacción:

1. Crea la cuenta en `auth.users` (el trigger del cimiento crea su perfil).
2. Marca `rol = 'creador'` en su perfil.
3. Crea la comunidad con esa persona como `propietario_id` y plan `pro`.
4. Imprime el enlace de acceso para entrar por primera vez.

Es idempotente por `slug`: repetirlo no duplica, avisa y sale.

## 4. Sesión real

Hoy `login/page.tsx` acepta **cualquier contraseña** — está así desde que era
una demo. Se sustituye por enlace de correo (`signInWithOtp`).

- `/login` pide solo el correo y confirma "te hemos enviado un enlace".
  Responde igual exista o no la cuenta: decir "ese correo no existe" convierte
  el formulario en un detector de quién está dado de alta.
- `/registro` y la acción `registrarCreador` **se retiran**. El alcance es alta
  manual; que cualquiera se cree una academia lo contradice.
- `/recuperar` se retira: no hay contraseña que recuperar.
- `user-switcher.tsx` se retira. Cambiar de usuario sin credencial es una
  herramienta de demo y, con cuentas reales, una puerta trasera.

**Correo:** en esta rebanada el único usuario es el dueño, así que basta el
emisor incorporado de Supabase (limitado a unos pocos envíos por hora y no apto
para producción). El proveedor real se contrata en la rebanada 2, que es cuando
entran alumnos.

`useSession()` conserva su firma. Por dentro pasa de leer `currentUserId` del
store a `supabase.auth.getSession()` más el perfil cargado.

## 5. Lectura del armazón

**Enfoque: una carga al entrar, hooks sin cambios de firma.**

Los datos del armazón —perfil, comunidad, cursos con módulos y lecciones— son
pocos: una academia son decenas de cursos, no miles de filas. Se traen de una
vez al iniciar sesión y viven en el store. Los 20 hooks conservan su firma
síncrona y **los 75 componentes cliente (de 111 `.tsx`) no se tocan**.

Esto no escala a datos sin techo, y por eso el feed va con carga propia y
paginación en la rebanada 3. Aquí sería complejidad sin beneficio.

```ts
// Nuevo en el store. Reemplaza a los mocks como origen del armazón.
datosServidor: {
  perfil: Perfil;
  comunidad: Community | null;   // la que posee, o en la que está inscrito
  cursos: Course[];              // con modulos y lecciones anidados
} | null;
```

**`useHydrated()` cambia de significado, no de firma.** Hoy es "el store leyó de
localStorage". Pasa a ser "ya sé quién eres y, si eres alguien, tus datos
llegaron". Los **24 archivos** que ya lo consultan —incluidos los 4 layouts de
grupo, que gobiernan el acceso a todas las áreas— siguen esperando
correctamente sin tocarles una línea. Es la pieza que abarata esta rebanada.

**Selectores:** la regla de `CLAUDE.md` sigue vigente. `datosServidor` se
selecciona crudo y se deriva con `useMemo` dentro del hook; nada de `.filter()`
dentro del selector.

Hooks que migran: `useSession`, `useMyCommunity`, `useCommunity`, `useCourses`,
`useAdminCourses`, `useAdminCourse`, `useLesson`, `useMarcaAuth`.

`useMarcaAuth` es especial: corre **sin sesión** (es la portada del login), así
que no lee `datosServidor` sino la función `marca_publica(slug)` del cimiento.

## 6. Escritura de cursos

`guardarCurso(curso)` deja de escribir en `cursosEditados` y pasa a guardar en
Postgres: `upsert` del curso, de sus módulos y de sus lecciones, borrando los
que ya no estén. Después refresca `datosServidor`.

### Los identificadores cambian de origen

`CLAUDE.md` manda hoy generar IDs con contadores persistidos
(`siguienteCursoId`, `siguienteModuloId`, `siguienteLeccionId`) y prohíbe
expresamente `Math.random`. Esa regla nació para que la demo fuera
determinista, y **con una base real es incorrecta**: dos personas editando a la
vez generarían el mismo `curso-4`.

Se sustituye por `crypto.randomUUID()` en el navegador. No es un capricho: al
generar el identificador en el cliente, el editor puede seguir montando el curso
entero en memoria —módulos y lecciones incluidos— y guardarlo de una vez, sin el
baile de identificadores provisionales que haría falta si los pusiera la base.
Postgres acepta UUID enviados por el cliente.

Los tres contadores desaparecen del store. **`CLAUDE.md` se actualiza**: la
prohibición se mantiene para los seeds, no para los identificadores de runtime.

### Vimeo

No cambia nada del reproductor ni del campo: `VimeoField` ya extrae el
identificador de una URL larga, corta o pelada y enseña el vídeo al momento. Lo
único que hoy falta es que ese identificador **sobreviva a la recarga**, y eso
lo da esta sección.

## 7. Qué se retira

- `registrarCreador` del store, `/registro` y `/recuperar`.
- `user-switcher.tsx`.
- `siguienteCursoId`, `siguienteModuloId`, `siguienteLeccionId`, `cursosEditados`.
- Los mocks de comunidades, cursos y usuarios **dejan de leerse** en los hooks
  migrados. Los archivos se conservan hasta la rebanada 3, porque el feed y los
  eventos todavía los usan.
- Las 2 violaciones de `mocks → hooks → páginas` que caen en esta rebanada:
  `admin/cursos/page.tsx` y `shared/user-switcher.tsx` (este último por
  eliminación). `admin/reportes/page.tsx` y `perfil/page.tsx` quedan para la
  rebanada 3.

## 8. Verificación

`bun run build` y `bun run lint` limpios, y `bun run test:rls` sigue en verde:
esta rebanada no toca políticas, y si alguna prueba de aislamiento se pone roja
es que algo se rompió.

Pruebas nuevas en `tests/rls/cursos.test.ts`, sobre la base real:

1. `crear-academia` deja la comunidad con el dueño correcto y es idempotente.
2. El dueño guarda un curso con dos módulos y tres lecciones, y al releerlo
   están los mismos identificadores, el mismo orden y el mismo `vimeo_id`.
3. Guardar el curso otra vez sin un módulo lo borra de verdad de la base.
4. Un curso en borrador no lo ve un alumno inscrito; publicado, sí. (Ya cubierto
   por el cimiento, se repite aquí sobre el camino de escritura real.)
5. `marca_publica` devuelve la marca de la academia recién creada sin sesión.

Y una comprobación manual que ninguna prueba sustituye: **recargar la página
después de guardar un curso, y que siga ahí.**

## 9. Riesgo conocido

El editor de cursos (`_curso-editor.tsx`) monta el curso completo en memoria y
lo guarda de golpe. Con una sola persona editando, correcto. Con dos a la vez,
la última escritura gana y la otra pierde su trabajo sin avisar.

**Se acepta en esta rebanada**: hoy hay un solo dueño por academia. Queda
anotado porque el día que haya dos administradores dejará de ser aceptable, y la
solución (control de versión por fila) es más barata de añadir sabiendo que
falta que descubriéndolo.
