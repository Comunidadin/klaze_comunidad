-- Nada de `public` para el anonimo, ni ahora ni en las tablas de manana.
--
-- Dos cosas que se habian quedado a medias, y juntas eran una sola: la unica
-- barrera entre internet sin sesion y escritura completa sobre esta base era
-- que un resolver devolviera falso con un `auth.uid()` nulo.
--
-- 1. CUATRO POLITICAS DECIAN `to public` EN VEZ DE `to authenticated`.
--    `public` en Postgres no significa "publicas": significa TODOS LOS ROLES,
--    incluido `anon`. Las otras 19 tablas lo hacen bien; estas se saltaron el
--    patron. Hoy no dejan pasar ni una fila --- las cuatro dependen de
--    `auth.uid()`, que para un anonimo es nulo --- pero eso es suerte de sus
--    condiciones, no una decision.
--
-- 2. `anon` TENIA SELECT, INSERT, UPDATE, DELETE Y TRUNCATE SOBRE LAS 23
--    TABLAS. No lo puso nadie aqui: son los privilegios por defecto de Supabase
--    (`pg_default_acl` concede todo a `anon` sobre cada tabla nueva de
--    `public`). Lo cual significa que **cada tabla que creemos los hereda
--    sola**, sin que nadie lo escriba ni lo revise.
--
-- Juntando las dos: basta una politica futura escrita sin `to authenticated`
-- --- que por defecto es `public` --- y con una condicion que no mire
-- `auth.uid()`, para abrir una tabla entera a cualquiera. Este proyecto anade
-- politicas cada semana.
--
-- Comprobado antes de escribir esto: NINGUNA pagina publica lee tablas. El
-- login no consulta `comunidades` (solo pasa el slug a `/api/recuperar`), y la
-- invitacion tampoco. No hay lectura anonima que romper.
--
-- Lo que NO se toca: `storage.objects`. Las imagenes publicas --- logos,
-- portadas, avatares --- se sirven por ahi y tienen que seguir viendose sin
-- sesion.

/* 1 --- Las cuatro politicas, recreadas con el mismo cuerpo y otro rol. ---- */

drop policy if exists "comunidades: los miembros la ven" on public.comunidades;
create policy "comunidades: los miembros la ven"
  on public.comunidades for select to authenticated
  using (privado.inscrito_en(id) or privado.es_superadmin());

-- `inscrito_en` y no `pertenece_a`, y sigue siendo a proposito: si suspender
-- una academia quitara tambien la lectura de su fila, la app no podria
-- distinguir "suspendida" de "no existe" y ensenaria "Comunidad no encontrada".
-- Ese callejon sin salida ya aparecio una vez aqui.

drop policy if exists "comunidades: el propietario edita la suya" on public.comunidades;
create policy "comunidades: el propietario edita la suya"
  on public.comunidades for update to authenticated
  using (propietario_id = (select auth.uid()) and estado = 'activa')
  with check (propietario_id = (select auth.uid()) and estado = 'activa');

drop policy if exists "cursos: los gestiona el propietario" on public.cursos;
create policy "cursos: los gestiona el propietario"
  on public.cursos for all to authenticated
  using (privado.es_propietario_de(comunidad_id))
  with check (privado.es_propietario_de(comunidad_id));

drop policy if exists "modulos: via su curso" on public.modulos;
create policy "modulos: via su curso"
  on public.modulos for select to authenticated
  using (
    (publicado and privado.cubre_curso(curso_id))
    or exists (select 1 from public.cursos c
               where c.id = modulos.curso_id
                 and privado.es_propietario_de(c.comunidad_id))
  );

/* 2 --- Y los permisos, que son la otra mitad. ---------------------------- */

-- Las tablas que ya existen.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Y las que se creen a partir de ahora, que es lo que de verdad cierra esto:
-- sin esta linea, la proxima `create table` volveria a conceder todo a `anon`
-- y habria que acordarse de revocarlo a mano cada vez. Acordarse no es un
-- mecanismo.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
