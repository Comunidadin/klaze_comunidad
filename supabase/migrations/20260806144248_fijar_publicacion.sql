-- Fijar una publicacion, en manos del dueno de la academia.
--
-- Bug del cimiento: la politica de UPDATE de `publicaciones` solo permite al
-- autor. Asi que el dueno podia BORRAR el mensaje de un alumno pero no
-- DESTACARLO — que es justo para lo que sirve fijar.
--
-- Se resuelve con una funcion y no ampliando la politica a proposito. Dejar que
-- el dueno haga UPDATE sobre publicaciones ajenas le permitiria cambiar las
-- palabras de otro y dejarlas firmadas con su nombre, que es peor que
-- borrarlas. Esta funcion solo toca `fijado`.
--
-- Ademas garantiza en una sola operacion que hay como mucho una fijada por
-- curso: hacerlo en dos llamadas desde el cliente deja una ventana en la que no
-- hay ninguna, o hay dos.
create function public.fijar_publicacion(p_publicacion uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_curso uuid;
  v_comunidad uuid;
begin
  select p.curso_id, c.comunidad_id into v_curso, v_comunidad
  from public.publicaciones p
  join public.cursos c on c.id = p.curso_id
  where p.id = p_publicacion;

  if v_curso is null then
    raise exception 'La publicacion no existe';
  end if;

  if not (privado.es_propietario_de(v_comunidad) or privado.es_superadmin()) then
    raise exception 'Solo el dueno de la academia puede fijar publicaciones';
  end if;

  update public.publicaciones set fijado = false
  where curso_id = v_curso and fijado;

  update public.publicaciones set fijado = true
  where id = p_publicacion;
end;
$$;

grant execute on function public.fijar_publicacion(uuid) to authenticated;
