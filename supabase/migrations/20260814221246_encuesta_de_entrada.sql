-- La encuesta de entrada: la que salta como ventana al entrar a la academia.
--
-- El creador marca UNA encuesta del feed como "de entrada" y a cada alumno le
-- aparece en un popup al llegar — hasta que vota o la descarta. Misma
-- mecanica que `fijado`: una sola por academia, y el cambio pasa por una
-- funcion con el nombre del dueno, no por un update a pelo (la politica de
-- update de publicaciones es del autor, y moderar no es editar).

alter table public.publicaciones
  add column encuesta_entrada boolean not null default false;

create function public.marcar_encuesta_entrada(
  p_publicacion uuid,
  p_activa boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_comunidad uuid;
begin
  select p.comunidad_id into v_comunidad
  from public.publicaciones p
  where p.id = p_publicacion;

  if v_comunidad is null then
    raise exception 'La publicacion no existe';
  end if;

  if not (privado.es_propietario_de(v_comunidad) or privado.es_superadmin()) then
    raise exception 'Solo el dueno de la academia decide la encuesta de entrada';
  end if;

  if p_activa and not exists (
    select 1 from public.encuesta_opciones o where o.publicacion_id = p_publicacion
  ) then
    raise exception 'Esa publicacion no es una encuesta';
  end if;

  -- Se apaga la anterior ANTES de encender la nueva: al reves habria un
  -- instante con dos, y el popup hace `.limit(1)`.
  update public.publicaciones set encuesta_entrada = false
  where comunidad_id = v_comunidad and encuesta_entrada;

  if p_activa then
    update public.publicaciones set encuesta_entrada = true
    where id = p_publicacion;
  end if;
end;
$$;

revoke all on function public.marcar_encuesta_entrada(uuid, boolean) from public, anon;
grant execute on function public.marcar_encuesta_entrada(uuid, boolean) to authenticated;
