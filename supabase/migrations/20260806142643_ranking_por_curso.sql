-- El ranking puede acotarse a un curso.
--
-- La pestana de ranking vive DENTRO de un curso, no a nivel de academia. Sin
-- este parametro, el podio de un curso mezclaria a alumnos de cursos distintos
-- ordenados por su avance total — comparando a quien va por la mitad de un
-- curso de 40 lecciones con quien termino uno de 5.
--
-- Se reemplaza la funcion en vez de anadir una sobrecarga: dos funciones con el
-- mismo nombre y distinto numero de parametros obligan a mirar cual se esta
-- llamando en cada sitio.
drop function if exists public.ranking_de_comunidad(uuid, timestamptz);

create function public.ranking_de_comunidad(
  p_comunidad uuid,
  p_desde timestamptz default null,
  p_curso uuid default null
)
returns table (usuario_id uuid, puntos integer)
language sql security definer stable set search_path = '' as $$
  select p.usuario_id, (count(*) * 10)::integer as puntos
  from public.progreso p
  join public.lecciones l on l.id = p.leccion_id
  join public.modulos m on m.id = l.modulo_id
  join public.cursos c on c.id = m.curso_id
  where c.comunidad_id = p_comunidad
    and (p_curso is null or c.id = p_curso)
    and (p_desde is null or p.completada_el >= p_desde)
    and (privado.pertenece_a(p_comunidad)
         or privado.es_propietario_de(p_comunidad)
         or privado.es_superadmin())
  group by p.usuario_id;
$$;

grant execute on function public.ranking_de_comunidad(uuid, timestamptz, uuid)
  to authenticated;
