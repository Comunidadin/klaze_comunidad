-- Encuestas en el feed: una publicacion puede llevar opciones y votos.
--
-- Dos tablas y no columnas JSON en `publicaciones`: los votos necesitan la
-- restriccion "una persona, un voto por encuesta", y eso es una primary key,
-- no una convencion en el cliente.

create table public.encuesta_opciones (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  texto          text not null,
  orden          integer not null default 1
);
alter table public.encuesta_opciones enable row level security;
create index on public.encuesta_opciones (publicacion_id);

-- Un voto por persona y ENCUESTA (no por opcion): la clave es
-- (publicacion, usuario). Cambiar de opinion es un upsert sobre esa clave.
create table public.encuesta_votos (
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  opcion_id      uuid not null references public.encuesta_opciones(id) on delete cascade,
  creado_el      timestamptz not null default now(),
  primary key (publicacion_id, usuario_id)
);
alter table public.encuesta_votos enable row level security;

-- Lectura: quien pertenece a la academia de la publicacion (los totales son
-- publicos dentro de la academia — un voto secreto seria otra funcion).
create policy "encuesta_opciones: las lee quien pertenece"
  on public.encuesta_opciones for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id
                   and (privado.pertenece_a(p.comunidad_id)
                        or privado.es_propietario_de(p.comunidad_id))));

-- Las opciones las crea (y borra) el AUTOR de la publicacion.
create policy "encuesta_opciones: las gestiona el autor del post"
  on public.encuesta_opciones for all to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id
                   and p.autor_id = (select auth.uid())))
  with check (exists (select 1 from public.publicaciones p
                      where p.id = publicacion_id
                        and p.autor_id = (select auth.uid())));

create policy "encuesta_votos: los lee quien pertenece"
  on public.encuesta_votos for select to authenticated
  using (exists (select 1 from public.publicaciones p
                 where p.id = publicacion_id
                   and (privado.pertenece_a(p.comunidad_id)
                        or privado.es_propietario_de(p.comunidad_id))));

-- Cada cual vota por si mismo, y solo con una opcion DE ESA encuesta,
-- perteneciendo a la academia. Update incluido: cambiar el voto es lo normal.
create policy "encuesta_votos: cada cual el suyo"
  on public.encuesta_votos for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (
    usuario_id = (select auth.uid())
    and exists (
      select 1
      from public.encuesta_opciones o
      join public.publicaciones p on p.id = o.publicacion_id
      where o.id = opcion_id
        and o.publicacion_id = encuesta_votos.publicacion_id
        and (privado.pertenece_a(p.comunidad_id)
             or privado.es_propietario_de(p.comunidad_id))
    )
  );

grant select, insert, update, delete on
  public.encuesta_opciones, public.encuesta_votos to authenticated;
