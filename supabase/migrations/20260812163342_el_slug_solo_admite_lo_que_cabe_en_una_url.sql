-- El identificador de una academia, con forma obligatoria.
--
-- Hasta hoy la columna era `text not null unique` y nada mas. La limpieza
-- (`slugDesde`) vivia SOLO en el formulario de Configuracion, y una regla que
-- solo existe en el navegador no es una regla: es una sugerencia. RLS deja al
-- propietario escribir su propia fila de `comunidades`, asi que un `PATCH`
-- directo a la API se saltaba el formulario entero.
--
-- Que se conseguia asi: el slug acaba dentro de `href="{origen}/login/{slug}"`
-- en el correo de bienvenida (ver `bloqueAcceso` en `src/lib/plantillas.ts`).
-- Con comillas dentro, el dueno inyectaba HTML en el bloque que Klaze presenta
-- como el de confianza --- el unico sitio del correo donde el alumno espera un
-- enlace legitimo. Y el trigger `congelar_slug_con_alumnos` no lo frenaba,
-- porque solo bloquea el cambio cuando YA hay alumnos: se pone el slug malo
-- antes de invitar a nadie y despues se invita.
--
-- El escapado en `plantillas.ts` se arregla igual, en el mismo commit. Las dos
-- cosas: escapar es lo correcto pase lo que pase, y un identificador que no
-- cabe en una URL no deberia poder guardarse aunque nadie lo escapara.
--
-- El patron es el mismo que ya aplicaba `slugDesde` y que valida
-- `/api/academias`: minusculas, numeros y guiones, sin empezar ni terminar en
-- guion, y 40 caracteres como mucho --- el largo que recorta `slugDesde`.
--
-- Comprobado antes de escribir esto: la unica academia existente
-- (`mentoria-v7`) cumple el patron, asi que la restriccion entra sin pelear.
alter table public.comunidades
  add constraint comunidades_slug_formato
  check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$');
