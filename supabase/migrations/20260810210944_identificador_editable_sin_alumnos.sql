-- El identificador de una academia se puede cambiar, pero solo mientras no
-- tenga alumnos.
--
-- Hace falta porque el super enlace lo deriva del nombre de la empresa sin
-- preguntar: quien escriba mal el nombre de su negocio al comprar se quedaria
-- con esa direccion para siempre. Los primeros dias no hay nada que romper, asi
-- que ahi cambiarlo es gratis.
--
-- En cuanto entra el primer alumno deja de serlo. El slug vive en `/c/{slug}` y
-- en `/login/{slug}`: son las direcciones que esa gente tiene guardadas, en un
-- marcador o en el correo de bienvenida que ya recibieron. Renombrarlo las
-- rompe todas a la vez, y eso no tiene arreglo hacia atras.
--
-- La regla vive AQUI y no en la pantalla. Puesta solo en el cliente, un
-- descuido —o una pestaña vieja abierta— bastaria para que un creador con 300
-- alumnos rompiera 300 enlaces. Una comprobacion que solo existe en el
-- navegador no es una regla, es una sugerencia.
create function public.slug_congelado_con_alumnos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  alumnos integer;
begin
  if new.slug = old.slug then
    return new;
  end if;

  -- El propietario no cuenta: `crearAcademia` le inscribe en su propia academia
  -- para que "Ver como alumno" le enseñe algo, asi que toda academia nace con
  -- una inscripcion. Contarla dejaria el identificador congelado desde el
  -- primer segundo.
  select count(*) into alumnos
  from public.inscripciones i
  where i.comunidad_id = old.id
    and i.usuario_id <> old.propietario_id;

  if alumnos > 0 then
    raise exception
      'No se puede cambiar la direccion de una academia que ya tiene alumnos: romperia los enlaces que tienen guardados (% alumnos)', alumnos
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger congelar_slug_con_alumnos
  before update on public.comunidades
  for each row execute function public.slug_congelado_con_alumnos();
