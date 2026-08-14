-- El directorio de la ACADEMIA, para el area de alumno.
--
-- `miembros_del_curso` responde "quien tiene acceso a este modulo"; las
-- pestañas Miembros y Ranking del area de alumno preguntan otra cosa: "quien
-- esta en esta academia". Y no pueden leer `inscripciones` a pelo — RLS solo
-- se la enseña a su dueño y al administrador, asi que a un alumno le
-- devolveria su propia fila y el directorio diria "1 persona" siempre.
--
-- Mismo criterio que su hermana: conjunto FIJO de columnas, el alias es la
-- parte de delante de la arroba (nunca el correo entero), y los puntos son
-- los de ESTA academia (privado.puntos_en).
create function public.miembros_de_comunidad(p_comunidad uuid)
returns table (
  usuario_id uuid,
  nombre     text,
  alias      text,
  avatar_url text,
  bio        text,
  puntos     integer,
  creado_el  timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre, split_part(p.email, '@', 1),
         p.avatar_url, p.bio,
         privado.puntos_en(p.id, p_comunidad),
         p.creado_el
  from public.inscripciones i
  join public.perfiles p on p.id = i.usuario_id
  where i.comunidad_id = p_comunidad
    and i.estado = 'activo'
    and (
      privado.pertenece_a(p_comunidad)
      or privado.es_propietario_de(p_comunidad)
      or privado.es_superadmin()
    )
  order by privado.puntos_en(p.id, p_comunidad) desc, p.nombre;
$$;

revoke all on function public.miembros_de_comunidad(uuid) from public, anon;
grant execute on function public.miembros_de_comunidad(uuid) to authenticated;
