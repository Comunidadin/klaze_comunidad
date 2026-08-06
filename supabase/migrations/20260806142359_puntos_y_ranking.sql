-- Puntos por leccion completada, y el ranking que los ordena.
--
-- Antes de esto, nada otorgaba puntos: estaban escritos a mano en los datos
-- semilla y nunca cambiaban. Con datos reales, todos los alumnos empezaban en
-- cero y el podio quedaba vacio para siempre.

-- Los puntos los otorga la base, no la app.
--
-- Va aqui y no en el codigo por el mismo motivo que los resolvers del cimiento:
-- si dependiera de que cada pantalla se acuerde de sumar, tarde o temprano una
-- no lo hara. Y cubre gratis el caso que siempre se olvida — al borrar una
-- leccion, su progreso cae por cascada y los puntos se ajustan solos.
--
-- `greatest(0, ...)` es un suelo defensivo: sin el, un borrado inesperado
-- podria dejar puntos negativos, que no significan nada.
create function public.ajustar_puntos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.perfiles set puntos = puntos + 10 where id = new.usuario_id;
    return new;
  else
    update public.perfiles set puntos = greatest(0, puntos - 10)
    where id = old.usuario_id;
    return old;
  end if;
end;
$$;

create trigger al_cambiar_progreso
  after insert or delete on public.progreso
  for each row execute function public.ajustar_puntos();

-- Ranking de una comunidad.
--
-- Existe porque un alumno debe ver la posicion de sus companeros, pero NO puede
-- leer su progreso: esa tabla es privada. Devuelve totales por persona, nunca
-- el detalle de que leccion vio cada uno.
--
-- `p_desde` null = desde siempre. Los periodos (7 y 30 dias) salen de
-- `completada_el`, que ya existe, en vez de multiplicar el total por un
-- porcentaje inventado como hacia la version anterior.
create function public.ranking_de_comunidad(
  p_comunidad uuid,
  p_desde timestamptz default null
)
returns table (usuario_id uuid, puntos integer)
language sql security definer stable set search_path = '' as $$
  select p.usuario_id, (count(*) * 10)::integer as puntos
  from public.progreso p
  join public.lecciones l on l.id = p.leccion_id
  join public.modulos m on m.id = l.modulo_id
  join public.cursos c on c.id = m.curso_id
  where c.comunidad_id = p_comunidad
    and (p_desde is null or p.completada_el >= p_desde)
    and (privado.pertenece_a(p_comunidad)
         or privado.es_propietario_de(p_comunidad)
         or privado.es_superadmin())
  group by p.usuario_id;
$$;

grant execute on function public.ranking_de_comunidad(uuid, timestamptz)
  to authenticated;

-- Recalcular lo ya existente: sin esto, quien hubiera completado lecciones
-- antes de esta migracion se quedaria a cero para siempre.
update public.perfiles p
set puntos = coalesce(
  (select count(*) * 10 from public.progreso pr where pr.usuario_id = p.id), 0
);
