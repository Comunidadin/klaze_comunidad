-- Inscripciones y el aislamiento entre empresas.
--
-- Esta migracion es el corazon del cimiento: convierte los cuatro "resolvers
-- centrales" de CLAUDE.md en funciones de la base. Alli su cumplimiento
-- dependia de que cada consumidor se acordara de llamarlos — y CLAUDE.md
-- documenta que ese olvido fue el origen de cada bug importante del repo.
-- Aqui no hay consulta que los pueda rodear.

create table public.inscripciones (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.perfiles(id) on delete cascade,
  comunidad_id     uuid not null references public.comunidades(id) on delete cascade,
  estado           text not null default 'invitado'
                     check (estado in ('invitado','activo','suspendido')),
  todos_los_cursos boolean not null default false,
  creado_el        timestamptz not null default now(),
  unique (usuario_id, comunidad_id)
);
alter table public.inscripciones enable row level security;
create index on public.inscripciones (comunidad_id);

-- Tabla y no un array de ids dentro de la inscripcion: asi, al borrar un
-- curso, desaparece de los accesos por cascada en vez de dejar una
-- referencia fantasma apuntando a nada.
create table public.inscripcion_cursos (
  inscripcion_id uuid not null references public.inscripciones(id) on delete cascade,
  curso_id       uuid not null references public.cursos(id) on delete cascade,
  primary key (inscripcion_id, curso_id)
);
alter table public.inscripcion_cursos enable row level security;

-- Esquema privado: no expuesto al API. Las funciones van aqui por dos motivos
-- distintos. Uno, cortan la recursion entre politicas: si la politica de
-- comunidades consultara inscripciones y la de inscripciones consultara
-- comunidades, Postgres entraria en bucle; una funcion `security definer` no
-- vuelve a evaluar RLS y rompe el ciclo. Dos, una funcion `security definer`
-- en un esquema expuesto seria invocable directamente desde el API.
create schema privado;
revoke all on schema privado from anon, authenticated;
grant usage on schema privado to authenticated;

-- `set search_path = ''` no es adorno: sin el, alguien puede anteponer un
-- esquema propio y cambiar el significado de la funcion.
create function privado.es_superadmin() returns boolean
language sql security definer stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') = 'superadmin';
$$;

create function privado.es_propietario_de(p_comunidad uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.comunidades
    where id = p_comunidad and propietario_id = auth.uid()
  );
$$;

-- Gemelo SQL de resolverEstadoEnrollment. "Suspender DEBE revocar acceso real,
-- no solo cambiar un badge" deja de ser una advertencia en un documento y pasa
-- a ser una condicion que no se puede saltar.
create function privado.pertenece_a(p_comunidad uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.inscripciones
    where usuario_id = auth.uid()
      and comunidad_id = p_comunidad
      and estado = 'activo'
  );
$$;

-- Gemelo SQL de enrollmentCubreCurso Y de cursosVisiblesParaMiembro: exige a la
-- vez que el acceso cubra el curso y que el curso este publicado. Por eso un
-- borrador no se filtra ni aunque el acceso del alumno lo incluya.
create function privado.cubre_curso(p_curso uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.cursos c on c.comunidad_id = i.comunidad_id
    left join public.inscripcion_cursos ic
      on ic.inscripcion_id = i.id and ic.curso_id = c.id
    where i.usuario_id = auth.uid()
      and c.id = p_curso
      and i.estado = 'activo'
      and c.publicado
      and (i.todos_los_cursos or ic.curso_id is not null)
  );
$$;

-- Sin equivalente en el codigo actual: la necesita la politica de perfiles para
-- que el directorio de miembros muestre a los companeros sin abrir la tabla
-- entera de perfiles.
create function privado.comparte_comunidad_con(p_usuario uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.inscripciones mias
    join public.inscripciones suyas on suyas.comunidad_id = mias.comunidad_id
    where mias.usuario_id = auth.uid()
      and suyas.usuario_id = p_usuario
      and mias.estado = 'activo'
      and suyas.estado = 'activo'
  );
$$;

grant execute on all functions in schema privado to authenticated;

create policy "inscripciones: la propia o las de mi comunidad"
  on public.inscripciones for select to authenticated
  using (usuario_id = (select auth.uid())
         or privado.es_propietario_de(comunidad_id)
         or privado.es_superadmin());

create policy "inscripciones: las gestiona el propietario"
  on public.inscripciones for all to authenticated
  using (privado.es_propietario_de(comunidad_id) or privado.es_superadmin())
  with check (privado.es_propietario_de(comunidad_id) or privado.es_superadmin());

create policy "inscripcion_cursos: via su inscripcion"
  on public.inscripcion_cursos for select to authenticated
  using (exists (select 1 from public.inscripciones i
                 where i.id = inscripcion_id
                   and (i.usuario_id = (select auth.uid())
                        or privado.es_propietario_de(i.comunidad_id))));

create policy "inscripcion_cursos: las gestiona el propietario"
  on public.inscripcion_cursos for all to authenticated
  using (exists (select 1 from public.inscripciones i
                 where i.id = inscripcion_id
                   and privado.es_propietario_de(i.comunidad_id)))
  with check (exists (select 1 from public.inscripciones i
                      where i.id = inscripcion_id
                        and privado.es_propietario_de(i.comunidad_id)));

-- Ahora si: acceso de los miembros al contenido.
create policy "comunidades: los miembros la ven"
  on public.comunidades for select to authenticated
  using (privado.pertenece_a(id) or privado.es_superadmin());

create policy "cursos: el miembro ve los que cubre su acceso"
  on public.cursos for select to authenticated
  using (privado.cubre_curso(id) or privado.es_superadmin());

create policy "modulos: via su curso"
  on public.modulos for select to authenticated
  using (privado.cubre_curso(curso_id)
         or exists (select 1 from public.cursos c
                    where c.id = curso_id
                      and privado.es_propietario_de(c.comunidad_id)));

create policy "lecciones: via su modulo"
  on public.lecciones for select to authenticated
  using (exists (select 1 from public.modulos m
                 where m.id = modulo_id
                   and (privado.cubre_curso(m.curso_id)
                        or exists (select 1 from public.cursos c
                                   where c.id = m.curso_id
                                     and privado.es_propietario_de(c.comunidad_id)))));

create policy "secciones: via su curso"
  on public.secciones for select to authenticated
  using (privado.cubre_curso(curso_id)
         or exists (select 1 from public.cursos c
                    where c.id = curso_id
                      and privado.es_propietario_de(c.comunidad_id)));

create policy "espacios: via su seccion"
  on public.espacios for select to authenticated
  using (exists (select 1 from public.secciones s
                 where s.id = seccion_id
                   and (privado.cubre_curso(s.curso_id)
                        or exists (select 1 from public.cursos c
                                   where c.id = s.curso_id
                                     and privado.es_propietario_de(c.comunidad_id)))));

create policy "perfiles: los companeros de comunidad"
  on public.perfiles for select to authenticated
  using (privado.comparte_comunidad_con(id) or privado.es_superadmin());

grant select, insert, update, delete on
  public.inscripciones, public.inscripcion_cursos to authenticated;
