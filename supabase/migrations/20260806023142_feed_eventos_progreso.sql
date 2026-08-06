-- Feed de comunidad, eventos y progreso de lecciones.
-- Todo cuelga del curso, no de la comunidad: la vida social vive dentro de
-- cada curso.

create table public.publicaciones (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  autor_id   uuid not null references public.perfiles(id) on delete cascade,
  titulo     text not null default '',
  cuerpo     text not null,
  fijado     boolean not null default false,
  creado_el  timestamptz not null default now()
);
alter table public.publicaciones enable row level security;
create index on public.publicaciones (curso_id);

create table public.comentarios (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  padre_id       uuid references public.comentarios(id) on delete cascade,
  autor_id       uuid not null references public.perfiles(id) on delete cascade,
  cuerpo         text not null,
  creado_el      timestamptz not null default now()
);
alter table public.comentarios enable row level security;
create index on public.comentarios (publicacion_id);

-- Tabla y no una lista dentro de la publicacion. Con una lista, dos personas
-- que dan me gusta a la vez se pisan la escritura y uno de los dos desaparece.
-- Ademas, "nadie da me gusta a nombre de otro" no se puede expresar sobre una
-- lista guardada dentro de la publicacion ajena.
create table public.me_gusta (
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  primary key (publicacion_id, usuario_id)
);
alter table public.me_gusta enable row level security;

create table public.eventos (
  id           uuid primary key default gen_random_uuid(),
  curso_id     uuid not null references public.cursos(id) on delete cascade,
  titulo       text not null,
  descripcion  text not null default '',
  fecha_inicio timestamptz not null,
  duracion_min integer not null default 60,
  url_sala     text not null default ''
);
alter table public.eventos enable row level security;
create index on public.eventos (curso_id);

create table public.progreso (
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  leccion_id    uuid not null references public.lecciones(id) on delete cascade,
  completada_el timestamptz not null default now(),
  primary key (usuario_id, leccion_id)
);
alter table public.progreso enable row level security;

create policy "publicaciones: miembros del curso"
  on public.publicaciones for select to authenticated
  using (privado.cubre_curso(curso_id)
         or exists (select 1 from public.cursos c
                    where c.id = curso_id
                      and privado.es_propietario_de(c.comunidad_id)));

create policy "publicaciones: escribe el autor"
  on public.publicaciones for insert to authenticated
  with check (autor_id = (select auth.uid()) and privado.cubre_curso(curso_id));

create policy "publicaciones: edita el autor"
  on public.publicaciones for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy "publicaciones: borra el autor o el propietario"
  on public.publicaciones for delete to authenticated
  using (autor_id = (select auth.uid())
         or exists (select 1 from public.cursos c
                    where c.id = curso_id
                      and privado.es_propietario_de(c.comunidad_id)));

create policy "comentarios: via su publicacion"
  on public.comentarios for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id and privado.cubre_curso(p.curso_id)));

create policy "comentarios: escribe el autor"
  on public.comentarios for insert to authenticated
  with check (autor_id = (select auth.uid())
              and exists (select 1 from public.publicaciones p
                          where p.id = publicacion_id
                            and privado.cubre_curso(p.curso_id)));

create policy "comentarios: edita el autor"
  on public.comentarios for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy "comentarios: borra el autor o el propietario"
  on public.comentarios for delete to authenticated
  using (autor_id = (select auth.uid())
         or exists (select 1 from public.publicaciones p
                    join public.cursos c on c.id = p.curso_id
                    where p.id = publicacion_id
                      and privado.es_propietario_de(c.comunidad_id)));

create policy "me_gusta: via su publicacion"
  on public.me_gusta for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id and privado.cubre_curso(p.curso_id)));

create policy "me_gusta: solo el propio"
  on public.me_gusta for insert to authenticated
  with check (usuario_id = (select auth.uid())
              and exists (select 1 from public.publicaciones p
                          where p.id = publicacion_id
                            and privado.cubre_curso(p.curso_id)));

create policy "me_gusta: quita el propio"
  on public.me_gusta for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy "eventos: miembros del curso"
  on public.eventos for select to authenticated
  using (privado.cubre_curso(curso_id)
         or exists (select 1 from public.cursos c
                    where c.id = curso_id
                      and privado.es_propietario_de(c.comunidad_id)));

create policy "eventos: los gestiona el propietario"
  on public.eventos for all to authenticated
  using (exists (select 1 from public.cursos c
                 where c.id = curso_id
                   and privado.es_propietario_de(c.comunidad_id)))
  with check (exists (select 1 from public.cursos c
                      where c.id = curso_id
                        and privado.es_propietario_de(c.comunidad_id)));

-- El progreso es del alumno y de nadie mas, ni siquiera del dueno de la
-- academia. Si algun dia hace falta un informe agregado, se hara con una
-- vista o funcion que devuelva totales, nunca abriendo esta tabla.
create policy "progreso: solo el propio"
  on public.progreso for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

grant select, insert, update, delete on
  public.publicaciones, public.comentarios, public.me_gusta,
  public.eventos, public.progreso to authenticated;
