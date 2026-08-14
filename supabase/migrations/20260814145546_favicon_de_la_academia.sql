-- El favicon de la academia, separado del logo.
--
-- La pestaña del navegador usaba el logo como icono, y eso tiene dos
-- problemas: el creador no puede cambiar el icono sin cambiar el logo, y un
-- logo pensado para verse a 40 px no siempre funciona a 16. Columna nueva y
-- opcional: sin favicon propio, la pestaña sigue cayendo al logo (eso lo
-- decide la app, no la base).
--
-- Sin política nueva: `comunidades` ya tiene las suyas y esto es una columna
-- más de la fila que el propietario ya edita.

alter table public.comunidades add column favicon_url text;

-- Las dos funciones públicas devuelven un conjunto FIJO de columnas (ver la
-- migración `invitaciones_y_acceso_publico`), así que ampliar lo que enseñan
-- exige recrearlas: `create or replace` no puede cambiar el tipo de retorno.

drop function public.marca_publica(text);
create function public.marca_publica(p_slug text)
returns table (nombre text, logo_url text, favicon_url text,
               color_acento text, marca_auth jsonb)
language sql security definer stable set search_path = '' as $$
  select c.nombre, c.logo_url, c.favicon_url, c.color_acento, c.marca_auth
  from public.comunidades c
  where c.slug = p_slug and c.estado = 'activa';
$$;

drop function public.invitacion_publica(text);
create function public.invitacion_publica(p_token text)
returns table (email text, comunidad_nombre text, comunidad_logo text,
               comunidad_favicon text, comunidad_color text,
               todos_los_cursos boolean, cursos text[])
language sql security definer stable set search_path = '' as $$
  select i.email, c.nombre, c.logo_url, c.favicon_url, c.color_acento,
         i.todos_los_cursos,
         coalesce(array_agg(cu.titulo) filter (where cu.titulo is not null), '{}')
  from public.invitaciones i
  join public.comunidades c on c.id = i.comunidad_id
  left join public.invitacion_cursos ic on ic.invitacion_id = i.id
  left join public.cursos cu on cu.id = ic.curso_id
  where i.token = p_token and i.estado = 'pendiente' and c.estado = 'activa'
  group by i.email, c.nombre, c.logo_url, c.favicon_url, c.color_acento,
           i.todos_los_cursos;
$$;

-- `drop function` se lleva los grants: sin volver a darlos, la pantalla de
-- entrada y la de invitación dejarían de ver la marca.
grant execute on function public.marca_publica(text) to anon, authenticated;
grant execute on function public.invitacion_publica(text) to anon, authenticated;
