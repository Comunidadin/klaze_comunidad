-- Perfiles, planes y comunidades: la base sobre la que se apoya todo.
-- Las politicas de aqui son provisionales y se amplian en la migracion de
-- inscripciones, que es cuando existe el concepto de "miembro".

-- Perfil: extiende auth.users 1:1. No duplica el correo, que vive en auth.
create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null default '',
  avatar_url  text not null default '',
  bio         text not null default '',
  rol         text not null default 'alumno'
                check (rol in ('alumno','creador','superadmin')),
  puntos      integer not null default 0,
  creado_el   timestamptz not null default now()
);
alter table public.perfiles enable row level security;

create table public.planes (
  id          text primary key check (id in ('starter','pro','scale')),
  nombre      text not null,
  precio_mes  numeric(10,2) not null default 0,
  max_alumnos integer not null,
  max_cursos  integer not null,
  destacado   boolean not null default false
);
alter table public.planes enable row level security;

create table public.comunidades (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  nombre          text not null,
  descripcion     text not null default '',
  logo_url        text not null default '',
  color_acento    text not null default '#0073B0',
  propietario_id  uuid not null references public.perfiles(id) on delete restrict,
  plan_id         text not null references public.planes(id),
  estado          text not null default 'activa'
                    check (estado in ('activa','suspendida')),
  nombres_niveles text[] not null default '{}',
  marca_auth      jsonb not null default '{}'::jsonb,
  creado_el       timestamptz not null default now()
);
alter table public.comunidades enable row level security;
create index on public.comunidades (propietario_id);

-- Al crearse una cuenta, su perfil. Es un trigger y no codigo de la app para
-- que no exista un instante con cuenta pero sin perfil: si lo hiciera la app,
-- un fallo entre las dos escrituras dejaria una cuenta huerfana.
create function public.crear_perfil_al_registrarse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

create policy "perfiles: leer el propio"
  on public.perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy "perfiles: editar el propio"
  on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "planes: leer autenticado"
  on public.planes for select to authenticated using (true);

create policy "comunidades: leer la propia"
  on public.comunidades for select to authenticated
  using (propietario_id = (select auth.uid()));

-- Crear una tabla por SQL no la expone al API sola: hay que conceder acceso
-- explicito a los roles. Siempre junto con RLS, nunca sin el.
grant select on public.planes to authenticated;
grant select, update on public.perfiles to authenticated;
grant select on public.comunidades to authenticated;

insert into public.planes (id, nombre, precio_mes, max_alumnos, max_cursos, destacado) values
  ('starter', 'Starter',  29,   100,   3, false),
  ('pro',     'Pro',      79,  1000,  15, true),
  ('scale',   'Scale',   199, 10000, 100, false);
