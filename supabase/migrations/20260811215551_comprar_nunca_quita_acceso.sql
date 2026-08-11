-- Comprar suma acceso. Nunca lo quita.
--
-- `aceptar_invitaciones_de` acumulaba bien los modulos --- `inscripcion_cursos`
-- va con `on conflict do nothing`, asi que lo de antes se queda --- pero
-- PISABA la marca de "todos los modulos":
--
--     todos_los_cursos = excluded.todos_los_cursos
--
-- Con un solo producto por academia eso no se notaba. Con varios es un agujero
-- directo: quien compra el pase completo (todos_los_cursos = true) y luego
-- compra un taller suelto (una lista de un modulo) sale de la segunda compra
-- con todos_los_cursos = false y un solo modulo en la lista. Ha pagado dos
-- veces y tiene menos que antes, nadie ha tocado nada, y en el panel su
-- inscripcion sigue "activa".
--
-- El `or` es la regla entera: una compra solo puede sumar. Quitar acceso tiene
-- sus propias puertas --- el `/baja` del enlace de venta y suspender a mano ---
-- y ninguna pasa por aqui.
create or replace function public.aceptar_invitaciones_de(p_usuario uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  su_email text;
  inv record;
  nueva_inscripcion uuid;
  total integer := 0;
begin
  if p_usuario is null then return 0; end if;

  select email into su_email from auth.users where id = p_usuario;
  if su_email is null then return 0; end if;

  for inv in
    select * from public.invitaciones
    where lower(email) = lower(su_email) and estado = 'pendiente'
  loop
    insert into public.inscripciones
      (usuario_id, comunidad_id, estado, todos_los_cursos)
    values (p_usuario, inv.comunidad_id, 'activo', inv.todos_los_cursos)
    on conflict (usuario_id, comunidad_id)
      -- `estado = 'activo'` si se mantiene: volver a comprar despues de una
      -- baja tiene que devolver el acceso, con el progreso donde estaba.
      do update set estado = 'activo',
                    todos_los_cursos = public.inscripciones.todos_los_cursos
                                       or excluded.todos_los_cursos
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

revoke all on function public.aceptar_invitaciones_de(uuid) from public, anon, authenticated;
grant execute on function public.aceptar_invitaciones_de(uuid) to service_role;
