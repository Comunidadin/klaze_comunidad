-- Fijar una publicacion, ahora que el feed es de la academia.
--
-- Esta funcion se quedo fuera de `20260811224921_comunidad_de_la_academia.sql`
-- y es un buen recordatorio de por que: las politicas se ven en `pg_policies`,
-- pero el cuerpo de una funcion no lo mira nadie hasta que revienta. Aqui lo
-- cazo una prueba con "column p.curso_id does not exist" --- en produccion
-- habria sido el boton de fijar, roto y sin explicacion.
--
-- Lo que hace es lo mismo de antes con un nivel menos: "solo una fijada a la
-- vez" pasa de ser por modulo a ser por academia. Es lo que quiere decir fijar
-- algo cuando hay un unico feed: si cada modulo pudiera dejar la suya, el
-- alumno veria cinco publicaciones fijadas al entrar.
create or replace function public.fijar_publicacion(p_publicacion uuid) returns void
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
    raise exception 'Solo el dueno de la academia puede fijar publicaciones';
  end if;

  -- Se desfija lo anterior ANTES de fijar lo nuevo: al reves habria un instante
  -- con dos fijadas, y `leerFijado` hace `.limit(1)` --- devolveria una de las
  -- dos al azar a quien leyera justo entonces.
  update public.publicaciones set fijado = false
  where comunidad_id = v_comunidad and fijado;

  update public.publicaciones set fijado = true
  where id = p_publicacion;
end;
$$;
