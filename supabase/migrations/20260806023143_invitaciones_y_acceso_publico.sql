-- Invitaciones y las dos unicas puertas abiertas sin sesion.

-- Token aleatorio. Los de la demo eran secuenciales (inv-1, inv-2...), asi que
-- cualquiera podia probar el siguiente y leer a quien se invito y a que
-- empresa. 'hex' y no 'base64' porque base64 produce '/' y '+', que hay que
-- escapar dentro de una URL.
create table public.invitaciones (
  id               uuid primary key default gen_random_uuid(),
  token            text not null unique
                     default encode(extensions.gen_random_bytes(32), 'hex'),
  email            text not null,
  comunidad_id     uuid not null references public.comunidades(id) on delete cascade,
  todos_los_cursos boolean not null default false,
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente','aceptada')),
  creada_el        timestamptz not null default now()
);
alter table public.invitaciones enable row level security;
create index on public.invitaciones (lower(email));

create table public.invitacion_cursos (
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  curso_id      uuid not null references public.cursos(id) on delete cascade,
  primary key (invitacion_id, curso_id)
);
alter table public.invitacion_cursos enable row level security;

create policy "invitaciones: solo el propietario"
  on public.invitaciones for all to authenticated
  using (privado.es_propietario_de(comunidad_id) or privado.es_superadmin())
  with check (privado.es_propietario_de(comunidad_id) or privado.es_superadmin());

create policy "invitacion_cursos: via su invitacion"
  on public.invitacion_cursos for all to authenticated
  using (exists (select 1 from public.invitaciones i
                 where i.id = invitacion_id
                   and privado.es_propietario_de(i.comunidad_id)))
  with check (exists (select 1 from public.invitaciones i
                      where i.id = invitacion_id
                        and privado.es_propietario_de(i.comunidad_id)));

-- Estas dos funciones viven en `public`, no en `privado`, porque `anon` tiene
-- que poder invocarlas: son las pantallas de antes de tener cuenta. Es la
-- excepcion consciente a la regla, y por eso devuelven un conjunto FIJO de
-- columnas en vez de filas de tabla — no hay forma de pedirles mas.
create function public.marca_publica(p_slug text)
returns table (nombre text, logo_url text, color_acento text, marca_auth jsonb)
language sql security definer stable set search_path = '' as $$
  select c.nombre, c.logo_url, c.color_acento, c.marca_auth
  from public.comunidades c
  where c.slug = p_slug and c.estado = 'activa';
$$;

-- Devuelve vacio para token inexistente, ya aceptado o comunidad suspendida,
-- SIN distinguir entre los tres casos: distinguirlos permitiria confirmar que
-- un token existe, que es justo lo que protege al correo del invitado.
create function public.invitacion_publica(p_token text)
returns table (email text, comunidad_nombre text, comunidad_logo text,
               comunidad_color text, todos_los_cursos boolean, cursos text[])
language sql security definer stable set search_path = '' as $$
  select i.email, c.nombre, c.logo_url, c.color_acento, i.todos_los_cursos,
         coalesce(array_agg(cu.titulo) filter (where cu.titulo is not null), '{}')
  from public.invitaciones i
  join public.comunidades c on c.id = i.comunidad_id
  left join public.invitacion_cursos ic on ic.invitacion_id = i.id
  left join public.cursos cu on cu.id = ic.curso_id
  where i.token = p_token and i.estado = 'pendiente' and c.estado = 'activa'
  group by i.email, c.nombre, c.logo_url, c.color_acento, i.todos_los_cursos;
$$;

grant execute on function public.marca_publica(text) to anon, authenticated;
grant execute on function public.invitacion_publica(text) to anon, authenticated;

-- Al entrar por primera vez, las invitaciones pendientes con ese correo se
-- convierten en inscripciones. Trigger y no codigo de la app: evita el estado
-- intermedio "tiene cuenta pero no acceso", y que dos pestanas creen dos
-- inscripciones a la vez.
create function public.aceptar_invitaciones_al_entrar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  nueva_inscripcion uuid;
begin
  for inv in
    select * from public.invitaciones
    where lower(email) = lower(new.email) and estado = 'pendiente'
  loop
    insert into public.inscripciones
      (usuario_id, comunidad_id, estado, todos_los_cursos)
    values (new.id, inv.comunidad_id, 'activo', inv.todos_los_cursos)
    on conflict (usuario_id, comunidad_id) do update set estado = 'activo'
    returning id into nueva_inscripcion;

    insert into public.inscripcion_cursos (inscripcion_id, curso_id)
    select nueva_inscripcion, ic.curso_id
    from public.invitacion_cursos ic
    where ic.invitacion_id = inv.id
    on conflict do nothing;

    update public.invitaciones set estado = 'aceptada' where id = inv.id;
  end loop;
  return new;
end;
$$;

-- El nombre empieza por "z" a proposito: Postgres dispara los triggers de una
-- misma tabla en orden alfabetico, y este tiene que correr DESPUES de
-- `on_auth_user_created`, porque inscripciones referencia perfiles.
create trigger z_aceptar_invitaciones
  after insert on auth.users
  for each row execute function public.aceptar_invitaciones_al_entrar();

grant select, insert, update, delete on
  public.invitaciones, public.invitacion_cursos to authenticated;
