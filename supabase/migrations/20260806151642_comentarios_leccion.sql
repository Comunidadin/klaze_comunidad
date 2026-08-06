-- Comentarios dentro de una leccion.
--
-- Antes eran decorado: se generaban de un calculo sobre el id de la leccion,
-- salian solo en el curso 1, y no se guardaban en ninguna parte. Escribir uno
-- y recargar lo borraba.
--
-- Tabla propia y no un `leccion_id` opcional en `comentarios`: una columna que
-- a veces apunta a una publicacion y a veces a una leccion obliga a comprobar
-- cual de las dos en cada consulta y en cada politica. Dos tablas con la misma
-- forma son mas aburridas y no se equivocan.
create table public.comentarios_leccion (
  id         uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  padre_id   uuid references public.comentarios_leccion(id) on delete cascade,
  autor_id   uuid not null references public.perfiles(id) on delete cascade,
  cuerpo     text not null,
  creado_el  timestamptz not null default now()
);
alter table public.comentarios_leccion enable row level security;
create index on public.comentarios_leccion (leccion_id);

-- Permisos calcados de los del feed: lo lee quien tiene acceso al curso de esa
-- leccion, y el dueno de la academia.
create policy "comentarios_leccion: quien tiene acceso al curso"
  on public.comentarios_leccion for select to authenticated
  using (exists (
    select 1 from public.lecciones l
    join public.modulos m on m.id = l.modulo_id
    join public.cursos c on c.id = m.curso_id
    where l.id = comentarios_leccion.leccion_id
      and (privado.cubre_curso(m.curso_id)
           or privado.es_propietario_de(c.comunidad_id))
  ));

create policy "comentarios_leccion: escribe el autor"
  on public.comentarios_leccion for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.lecciones l
      join public.modulos m on m.id = l.modulo_id
      join public.cursos c on c.id = m.curso_id
      where l.id = comentarios_leccion.leccion_id
        and (privado.cubre_curso(m.curso_id)
             or privado.es_propietario_de(c.comunidad_id))
    )
  );

create policy "comentarios_leccion: edita el autor"
  on public.comentarios_leccion for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy "comentarios_leccion: borra el autor o el propietario"
  on public.comentarios_leccion for delete to authenticated
  using (
    autor_id = (select auth.uid())
    or exists (
      select 1 from public.lecciones l
      join public.modulos m on m.id = l.modulo_id
      join public.cursos c on c.id = m.curso_id
      where l.id = comentarios_leccion.leccion_id
        and privado.es_propietario_de(c.comunidad_id)
    )
  );

grant select, insert, update, delete on public.comentarios_leccion to authenticated;
