-- El dueno ve los perfiles de TODOS los inscritos en su academia, incluidos
-- los suspendidos.
--
-- Bug encontrado al suspender a un alumno de verdad: la unica politica que
-- dejaba al dueno leer perfiles ajenos era `comparte_comunidad_con`, y esa
-- exige que AMBAS inscripciones esten activas. Al suspender a alguien, el
-- dueno dejaba de poder leer su perfil — asi que la fila volvia con el correo
-- y la fecha vacios, y /admin/alumnos reventaba al formatear la fecha.
--
-- Peor que el error: sin ver a esa persona, el dueno no puede encontrarla para
-- reactivarla. Suspender era una puerta de una sola direccion.
--
-- `comparte_comunidad_con` se queda como esta: para un ALUMNO, dejar de ver a
-- un companero suspendido es correcto. Lo que faltaba era el caso del dueno.
create function privado.administra_a(p_usuario uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.comunidades c on c.id = i.comunidad_id
    where i.usuario_id = p_usuario
      and c.propietario_id = auth.uid()
  );
$$;

grant execute on function privado.administra_a(uuid) to authenticated;

create policy "perfiles: el propietario ve a los inscritos en su academia"
  on public.perfiles for select to authenticated
  using (privado.administra_a(id));
