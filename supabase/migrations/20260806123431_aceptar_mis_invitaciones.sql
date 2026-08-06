-- Convierte en inscripciones las invitaciones pendientes del correo de quien
-- llama. Devuelve cuantas creo o reactivo.
--
-- Existe porque `z_aceptar_invitaciones` corre AL CREARSE una cuenta, y hay un
-- caso donde no se crea ninguna: invitar a alguien que ya la tiene, porque
-- estudia en otra academia (el modelo lo permite: una persona puede pertenecer
-- a varias) o porque se le invito antes. Ahi el trigger no salta, la persona
-- entra y no ve nada — sin error y sin pista. El dueno jura que la invito y
-- ella jura que no tiene acceso.
--
-- Se llama en cada inicio de sesion. Es idempotente, asi que llamarla de mas no
-- cuesta nada. El trigger se queda: es mas rapido, cubre el caso nuevo sin
-- esperar a nada. Esta lo respalda: es mas completa. Dos caminos al mismo
-- sitio, a proposito.
--
-- El correo sale de `auth.users` y no de un parametro: si lo recibiera,
-- cualquiera podria aceptar las invitaciones de otro.
create function public.aceptar_mis_invitaciones() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  mi_email text;
  inv record;
  nueva_inscripcion uuid;
  total integer := 0;
begin
  select email into mi_email from auth.users where id = auth.uid();
  if mi_email is null then return 0; end if;

  for inv in
    select * from public.invitaciones
    where lower(email) = lower(mi_email) and estado = 'pendiente'
  loop
    insert into public.inscripciones
      (usuario_id, comunidad_id, estado, todos_los_cursos)
    values (auth.uid(), inv.comunidad_id, 'activo', inv.todos_los_cursos)
    on conflict (usuario_id, comunidad_id)
      do update set estado = 'activo',
                    todos_los_cursos = excluded.todos_los_cursos
    returning id into nueva_inscripcion;

    insert into public.inscripcion_cursos (inscripcion_id, curso_id)
    select nueva_inscripcion, ic.curso_id
    from public.invitacion_cursos ic
    where ic.invitacion_id = inv.id
    on conflict do nothing;

    update public.invitaciones set estado = 'aceptada' where id = inv.id;
    total := total + 1;
  end loop;

  return total;
end;
$$;

grant execute on function public.aceptar_mis_invitaciones() to authenticated;
