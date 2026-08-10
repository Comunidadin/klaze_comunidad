-- Aceptar las invitaciones de CUALQUIER usuario, no solo las de quien pregunta.
--
-- `aceptar_mis_invitaciones()` corre al iniciar sesion, y con eso bastaba
-- mientras invitar fuera un acto humano: el dueno invita, la persona entra
-- cuando puede, y ahi se convierte la invitacion en inscripcion.
--
-- Con los enlaces de compra ya no basta. Quien acaba de pagar espera tener
-- acceso AHORA, no la proxima vez que inicie sesion. Y si ya tenia cuenta —
-- porque estudia en otra academia, o porque le reembolsaron y vuelve a
-- comprar — el trigger `z_aceptar_invitaciones` no salta, porque solo salta al
-- crearse la cuenta. Se quedaria pagando y sin ver nada.
--
-- La tentacion es que el webhook escriba la inscripcion por su cuenta. Copiar
-- este cuerpo con otro id es exactamente lo que dejo cuatro caminos abiertos
-- cuando se arreglo la suspension. Asi que se generaliza, igual que se hizo con
-- `cubre_curso_de`, y `aceptar_mis_invitaciones` pasa a ser una linea que llama
-- a esta. Un solo cuerpo.

create function public.aceptar_invitaciones_de(p_usuario uuid) returns integer
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

-- Solo el servidor con la clave secreta. Si `authenticated` pudiera llamarla,
-- cualquiera aceptaria las invitaciones de otro pasando su id — que es
-- justamente lo que evitaba que `aceptar_mis_invitaciones` recibiera el correo
-- por parametro.
revoke all on function public.aceptar_invitaciones_de(uuid) from public, anon, authenticated;
grant execute on function public.aceptar_invitaciones_de(uuid) to service_role;

-- El correo sigue saliendo de `auth.users` via el id, nunca de un parametro.
create or replace function public.aceptar_mis_invitaciones() returns integer
language sql security definer set search_path = '' as $$
  select public.aceptar_invitaciones_de(auth.uid());
$$;

grant execute on function public.aceptar_mis_invitaciones() to authenticated;
