-- Los puntos son POR ACADEMIA, y derivados — el contador global se retira.
--
-- `perfiles.puntos` era un total unico por persona, mantenido por trigger.
-- Con multi-academia eso es un agujero doble: puntos ganados en una academia
-- abrian candados de nivel en otra, y el podio de "quien es quien" mezclaba
-- academias. El ranking ya hacia lo correcto —contar `progreso` cruzando
-- hasta `cursos.comunidad_id`— asi que ese criterio pasa a ser EL criterio,
-- y la copia materializada desaparece: toda copia se descuadra tarde o
-- temprano, y esta ya no tiene ningun lector que la necesite.

-- Cuantos puntos tiene alguien DENTRO de una comunidad. En `privado` porque
-- es un ladrillo de resolvers, no una API; las pantallas usan
-- `ranking_de_comunidad`, que ya devuelve lo mismo para todos los miembros.
create function privado.puntos_en(p_usuario uuid, p_comunidad uuid)
returns integer
language sql stable security definer set search_path = '' as $$
  select (count(*) * 10)::integer
  from public.progreso pr
  join public.lecciones l on l.id = pr.leccion_id
  join public.modulos m on m.id = l.modulo_id
  join public.cursos c on c.id = m.curso_id
  where pr.usuario_id = p_usuario
    and c.comunidad_id = p_comunidad;
$$;
grant execute on function privado.puntos_en(uuid, uuid) to authenticated;

-- El candado por nivel cuenta el progreso EN LA COMUNIDAD DEL CURSO.
create or replace function privado.curso_disponible(p_curso uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    (case c.goteo_modo
       when 'fecha' then c.goteo_desde <= now()
       when 'dias'  then exists (
         select 1 from public.inscripciones i
         where i.usuario_id = (select auth.uid())
           and i.comunidad_id = c.comunidad_id
           and i.estado = 'activo'
           and i.creado_el + make_interval(days => c.goteo_dias) <= now())
       else true
     end)
    and
    (c.nivel_requerido is null
     or privado.nivel_por_puntos(
          privado.puntos_en((select auth.uid()), c.comunidad_id)
        ) >= c.nivel_requerido)
  from public.cursos c
  where c.id = p_curso;
$$;

-- El directorio del curso enseña los puntos de ESA academia.
create or replace function public.miembros_del_curso(p_curso uuid)
returns table (
  usuario_id uuid,
  nombre     text,
  alias      text,
  avatar_url text,
  bio        text,
  puntos     integer,
  creado_el  timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre, split_part(p.email, '@', 1),
         p.avatar_url, p.bio,
         privado.puntos_en(p.id, c.comunidad_id),
         p.creado_el
  from public.cursos c
  join public.inscripciones i on i.comunidad_id = c.comunidad_id
  join public.perfiles p on p.id = i.usuario_id
  where c.id = p_curso
    and privado.cubre_curso_de(i.usuario_id, p_curso)
    and (
      privado.cubre_curso(p_curso)
      or privado.es_propietario_de(c.comunidad_id)
      or privado.es_superadmin()
    )
  order by privado.puntos_en(p.id, c.comunidad_id) desc, p.nombre;
$$;

-- Y fuera el contador: trigger, funcion y columna.
drop trigger al_cambiar_progreso on public.progreso;
drop function public.ajustar_puntos();
alter table public.perfiles drop column puntos;
