-- Contenido: cursos, sus modulos y lecciones, y los espacios del feed.
-- Aqui solo hay politicas de propietario. El acceso de los miembros llega en
-- la migracion siguiente, que es cuando existe `privado.cubre_curso`.

create table public.cursos (
  id                 uuid primary key default gen_random_uuid(),
  comunidad_id       uuid not null references public.comunidades(id) on delete cascade,
  slug               text not null,
  titulo             text not null,
  descripcion        text not null default '',
  portada_url        text not null default '',
  precio_referencial numeric(10,2) not null default 0,
  nivel_requerido    integer,
  publicado          boolean not null default false,
  creado_el          timestamptz not null default now(),
  unique (comunidad_id, slug)
);
alter table public.cursos enable row level security;

create table public.modulos (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  titulo      text not null,
  orden       integer not null,
  portada_url text
);
alter table public.modulos enable row level security;
create index on public.modulos (curso_id);

create table public.lecciones (
  id           uuid primary key default gen_random_uuid(),
  modulo_id    uuid not null references public.modulos(id) on delete cascade,
  titulo       text not null,
  orden        integer not null,
  tipo         text not null check (tipo in ('video','texto')),
  vimeo_id     text,
  duracion_min integer not null default 0,
  contenido    text not null default '',
  -- Lista de {nombre, url}. Se queda como jsonb y no como tabla: nunca se
  -- consulta por separado ni tiene permisos propios.
  recursos     jsonb not null default '[]'::jsonb
);
alter table public.lecciones enable row level security;
create index on public.lecciones (modulo_id);

-- Los espacios cuelgan del CURSO, no de la comunidad. En el modelo anterior
-- existian en los dos sitios: el area de miembros leia los del curso y
-- /admin/comunidad editaba los de la comunidad, que ya no veia nadie.
create table public.secciones (
  id       uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  titulo   text not null,
  orden    integer not null
);
alter table public.secciones enable row level security;
create index on public.secciones (curso_id);

create table public.espacios (
  id           uuid primary key default gen_random_uuid(),
  seccion_id   uuid not null references public.secciones(id) on delete cascade,
  slug         text not null,
  nombre       text not null,
  icono        text not null default '',
  orden        integer not null,
  solo_lectura boolean not null default false
);
alter table public.espacios enable row level security;
create index on public.espacios (seccion_id);

create policy "cursos: los gestiona el propietario"
  on public.cursos for all to authenticated
  using (exists (select 1 from public.comunidades c
                 where c.id = cursos.comunidad_id
                   and c.propietario_id = (select auth.uid())))
  with check (exists (select 1 from public.comunidades c
                      where c.id = cursos.comunidad_id
                        and c.propietario_id = (select auth.uid())));

grant select, insert, update, delete on
  public.cursos, public.modulos, public.lecciones,
  public.secciones, public.espacios to authenticated;
