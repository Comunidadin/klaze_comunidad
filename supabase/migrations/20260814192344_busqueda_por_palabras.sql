-- Buscar por palabras, sin exigir la frase exacta ni los acentos.
--
-- El buscador hacia `ilike '%frase%'`: "como comunidad" no encontraba
-- "Cómo usar la comunidad" (ni por orden ni por tilde). Esta funcion parte la
-- consulta en palabras y exige que TODAS aparezcan —en cualquier orden y en
-- cualquier parte— comparando sin acentos por `unaccent`.
--
-- Es `security INVOKER`, a proposito y contra la costumbre de este esquema:
-- corre como quien busca, asi que las politicas de `lecciones` (borradores,
-- goteo), `publicaciones` y `perfiles` (comparte_comunidad_con) se aplican
-- solas. Un `definer` tendria que repetirlas a mano — justo el error que los
-- resolvers existen para evitar.

create extension if not exists unaccent with schema extensions;

create function public.buscar_en_comunidad(p_comunidad uuid, p_q text)
returns table (tipo text, id uuid, titulo text, detalle text, ruta_slug text)
language sql stable security invoker set search_path = ''
as $$
  with palabras as (
    -- `%` y `_` se escapan: son texto que alguien tecleo, no comodines.
    select coalesce(
      array_agg(
        replace(replace(replace(extensions.unaccent(lower(w)), '\', '\\'),
                        '%', '\%'), '_', '\_')
      ) filter (where length(w) >= 2),
      '{}'
    ) as ws
    from regexp_split_to_table(trim(coalesce(p_q, '')), '\s+') as w
  ),
  clases as (
    select 'clase'::text, l.id, l.titulo, c.titulo, c.slug
    from public.lecciones l
    join public.modulos m on m.id = l.modulo_id
    join public.cursos c on c.id = m.curso_id, palabras
    where c.comunidad_id = p_comunidad
      and cardinality(ws) > 0
      and not exists (
        select 1 from unnest(ws) w
        where extensions.unaccent(lower(l.titulo)) not like '%' || w || '%'
      )
    order by c.orden, m.orden, l.orden
    limit 8
  ),
  posts as (
    select 'publicacion'::text, p.id, p.titulo, null::text, e.slug
    from public.publicaciones p
    left join public.espacios e on e.id = p.espacio_id, palabras
    where p.comunidad_id = p_comunidad
      and cardinality(ws) > 0
      and not exists (
        select 1 from unnest(ws) w
        where extensions.unaccent(lower(p.titulo || ' ' || p.cuerpo)) not like '%' || w || '%'
      )
    order by p.creado_el desc
    limit 8
  ),
  miembros as (
    select 'miembro'::text, pf.id, pf.nombre, pf.avatar_url, null::text
    from public.perfiles pf, palabras
    where cardinality(ws) > 0
      and pf.nombre <> ''
      and not exists (
        select 1 from unnest(ws) w
        where extensions.unaccent(lower(pf.nombre)) not like '%' || w || '%'
      )
    order by pf.nombre
    limit 8
  )
  select * from clases
  union all select * from posts
  union all select * from miembros;
$$;

revoke all on function public.buscar_en_comunidad(uuid, text) from public, anon;
grant execute on function public.buscar_en_comunidad(uuid, text) to authenticated;
