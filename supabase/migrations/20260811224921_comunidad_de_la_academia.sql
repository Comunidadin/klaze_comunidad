-- La comunidad es de la academia, no de cada modulo.
--
-- El modelo anterior daba a cada modulo su propio feed, sus espacios y sus
-- eventos. Con un modulo por academia se sostenia; con diez —una mentoria
-- entera partida en secciones— cada alumno acaba en una isla distinta segun
-- lo que haya comprado, y el "Preséntate" hay que escribirlo diez veces.
--
-- Sube todo un nivel: `secciones`, `publicaciones` y `eventos` pasan a colgar
-- de `comunidades`.
--
-- EL ORDEN DE ESTE ARCHIVO NO ES ARBITRARIO. `espacios` cae en cascada al
-- borrar su seccion, y `publicaciones` cae con su espacio. Asi que todo se
-- REAPUNTA antes de borrar nada: al reves, fusionar espacios duplicados se
-- llevaria por delante las publicaciones que colgaban de ellos.

/* 1 --- La columna nueva, todavia opcional mientras se rellena. ------------ */

alter table public.secciones    add column comunidad_id uuid references public.comunidades(id) on delete cascade;
alter table public.publicaciones add column comunidad_id uuid references public.comunidades(id) on delete cascade;
alter table public.eventos       add column comunidad_id uuid references public.comunidades(id) on delete cascade;

update public.secciones s
   set comunidad_id = c.comunidad_id
  from public.cursos c where c.id = s.curso_id;

update public.publicaciones p
   set comunidad_id = c.comunidad_id
  from public.cursos c where c.id = p.curso_id;

update public.eventos e
   set comunidad_id = c.comunidad_id
  from public.cursos c where c.id = e.curso_id;

/* 2 --- Fusionar las secciones repetidas, por titulo. ---------------------- */

-- Sobrevive la mas antigua de cada (comunidad, titulo). El resto de sus
-- espacios se mudan a ella ANTES de que se borre ninguna.
create temporary table seccion_superviviente as
select s.id as vieja,
       first_value(s.id) over (
         partition by s.comunidad_id, lower(btrim(s.titulo))
         order by s.orden, s.id
       ) as nueva
from public.secciones s;

update public.espacios e
   set seccion_id = m.nueva
  from seccion_superviviente m
 where e.seccion_id = m.vieja and m.vieja <> m.nueva;

/* 3 --- Fusionar los espacios repetidos, por slug dentro de la academia. --- */

create temporary table espacio_superviviente as
select e.id as viejo,
       first_value(e.id) over (
         partition by s.comunidad_id, lower(btrim(e.slug))
         order by e.orden, e.id
       ) as nuevo
from public.espacios e
join public.secciones s on s.id = e.seccion_id;

-- Las publicaciones se mudan al espacio que sobrevive. Este `update` es la
-- razon de todo el orden de arriba: sin el, el `delete` siguiente se las
-- llevaria en cascada.
update public.publicaciones p
   set espacio_id = m.nuevo
  from espacio_superviviente m
 where p.espacio_id = m.viejo and m.viejo <> m.nuevo;

delete from public.espacios e
 using espacio_superviviente m
 where e.id = m.viejo and m.viejo <> m.nuevo;

delete from public.secciones s
 using seccion_superviviente m
 where s.id = m.vieja and m.vieja <> m.nueva;

/* 4 --- Retirar las politicas que nombran `curso_id`. --------------------- */

-- Va ANTES del `drop column`, que si no falla: Postgres no deja borrar una
-- columna de la que depende una politica. Los nombres estan sacados de
-- `pg_policies` en la base real, no de memoria --- fallar uno dejaria la vieja
-- en pie y la tabla con dos reglas contradictorias.
--
-- Las de UPDATE (`edita el autor`) y la de borrar un me gusta propio no se
-- tocan: solo miran `autor_id`/`usuario_id` y siguen valiendo igual.

drop policy if exists "secciones: via su curso"                     on public.secciones;
drop policy if exists "secciones: las gestiona el propietario"      on public.secciones;
drop policy if exists "espacios: via su seccion"                    on public.espacios;
drop policy if exists "espacios: los gestiona el propietario"       on public.espacios;
drop policy if exists "publicaciones: miembros del curso"           on public.publicaciones;
drop policy if exists "publicaciones: escribe el autor"             on public.publicaciones;
drop policy if exists "publicaciones: borra el autor o el propietario" on public.publicaciones;
drop policy if exists "comentarios: via su publicacion"             on public.comentarios;
drop policy if exists "comentarios: escribe el autor"               on public.comentarios;
drop policy if exists "comentarios: borra el autor o el propietario" on public.comentarios;
drop policy if exists "me_gusta: via su publicacion"                on public.me_gusta;
drop policy if exists "me_gusta: solo el propio"                    on public.me_gusta;
drop policy if exists "eventos: miembros del curso"                 on public.eventos;
drop policy if exists "eventos: los gestiona el propietario"        on public.eventos;

/* 5 --- Cerrar el modelo nuevo. ------------------------------------------- */

-- Las filas huerfanas —de un curso ya borrado— no pueden quedarse: la columna
-- pasa a ser obligatoria.
delete from public.secciones    where comunidad_id is null;
delete from public.publicaciones where comunidad_id is null;
delete from public.eventos       where comunidad_id is null;

alter table public.secciones    alter column comunidad_id set not null;
alter table public.publicaciones alter column comunidad_id set not null;
alter table public.eventos       alter column comunidad_id set not null;

alter table public.secciones    drop column curso_id;
alter table public.publicaciones drop column curso_id;
alter table public.eventos       drop column curso_id;

create index on public.secciones (comunidad_id);
create index on public.publicaciones (comunidad_id, creado_el desc);
create index on public.eventos (comunidad_id);

/* 6 --- Las politicas, ahora por pertenencia y no por compra. -------------- */

-- Es el cambio de fondo, y ademas simplifica: la comunidad deja de depender de
-- QUE modulos compraste. `pertenece_a` significa "tiene inscripcion activa en
-- una academia activa", que es exactamente lo que significa estar dentro.
--
-- Efecto buscado: quien compra un solo modulo participa en la misma comunidad
-- que todos los demas. Antes veia el feed de su modulo, casi siempre vacio, y
-- concluia que no habia nadie.
--
-- Cada una recrea lo que hacia su predecesora, cambiando `cubre_curso(curso)`
-- por `pertenece_a(comunidad)` y el rodeo por `cursos` por la columna directa.

create policy "secciones: las lee quien pertenece"
  on public.secciones for select to authenticated
  using (privado.pertenece_a(comunidad_id) or privado.es_propietario_de(comunidad_id));
create policy "secciones: las gestiona el propietario"
  on public.secciones for all to authenticated
  using (privado.es_propietario_de(comunidad_id))
  with check (privado.es_propietario_de(comunidad_id));

create policy "espacios: los lee quien pertenece"
  on public.espacios for select to authenticated
  using (exists (select 1 from public.secciones s
                 where s.id = seccion_id
                   and (privado.pertenece_a(s.comunidad_id)
                        or privado.es_propietario_de(s.comunidad_id))));
create policy "espacios: los gestiona el propietario"
  on public.espacios for all to authenticated
  using (exists (select 1 from public.secciones s
                 where s.id = seccion_id and privado.es_propietario_de(s.comunidad_id)))
  with check (exists (select 1 from public.secciones s
                      where s.id = seccion_id and privado.es_propietario_de(s.comunidad_id)));

create policy "publicaciones: las lee quien pertenece"
  on public.publicaciones for select to authenticated
  using (privado.pertenece_a(comunidad_id) or privado.es_propietario_de(comunidad_id));
create policy "publicaciones: escribe el autor"
  on public.publicaciones for insert to authenticated
  with check (autor_id = (select auth.uid()) and privado.pertenece_a(comunidad_id));
create policy "publicaciones: borra el autor o el propietario"
  on public.publicaciones for delete to authenticated
  using (autor_id = (select auth.uid()) or privado.es_propietario_de(comunidad_id));

create policy "comentarios: los lee quien pertenece"
  on public.comentarios for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id
                   and (privado.pertenece_a(p.comunidad_id)
                        or privado.es_propietario_de(p.comunidad_id))));
create policy "comentarios: escribe el autor"
  on public.comentarios for insert to authenticated
  with check (autor_id = (select auth.uid())
              and exists (select 1 from public.publicaciones p
                          where p.id = publicacion_id
                            and privado.pertenece_a(p.comunidad_id)));
create policy "comentarios: borra el autor o el propietario"
  on public.comentarios for delete to authenticated
  using (autor_id = (select auth.uid())
         or exists (select 1 from public.publicaciones p
                    where p.id = publicacion_id
                      and privado.es_propietario_de(p.comunidad_id)));

create policy "me_gusta: via su publicacion"
  on public.me_gusta for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id and privado.pertenece_a(p.comunidad_id)));
create policy "me_gusta: solo el propio"
  on public.me_gusta for insert to authenticated
  with check (usuario_id = (select auth.uid())
              and exists (select 1 from public.publicaciones p
                          where p.id = publicacion_id
                            and privado.pertenece_a(p.comunidad_id)));

create policy "eventos: los lee quien pertenece"
  on public.eventos for select to authenticated
  using (privado.pertenece_a(comunidad_id) or privado.es_propietario_de(comunidad_id));
create policy "eventos: los gestiona el propietario"
  on public.eventos for all to authenticated
  using (privado.es_propietario_de(comunidad_id))
  with check (privado.es_propietario_de(comunidad_id));
