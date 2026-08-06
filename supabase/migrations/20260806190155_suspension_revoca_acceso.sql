-- Suspender una academia no revocaba nada: `pertenece_a` miraba el estado de
-- la inscripcion y `es_propietario_de` no miraba ninguno. El boton del
-- superadmin solo cambiaba una insignia; el creador y sus alumnos seguian
-- entrando igual.
--
-- Se parte la pregunta en dos. `inscrito_en` responde "tiene inscripcion
-- activa" y guarda la FILA de la academia; `pertenece_a` responde eso Y ademas
-- "la academia esta activa", y guarda el CONTENIDO. Sin esa division, un
-- miembro de una academia suspendida no podria ni leer la fila, y la app le
-- ensenaria "Comunidad no encontrada" en vez de decirle que esta suspendida
-- --- que es exactamente el callejon sin salida que ya aparecio una vez aqui.

create or replace function privado.inscrito_en(p_comunidad uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.inscripciones
    where usuario_id = auth.uid()
      and comunidad_id = p_comunidad
      and estado = 'activo'
  );
$$;

create or replace function privado.pertenece_a(p_comunidad uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.comunidades c on c.id = i.comunidad_id
    where i.usuario_id = auth.uid()
      and i.comunidad_id = p_comunidad
      and i.estado = 'activo'
      and c.estado = 'activa'
  );
$$;

create or replace function privado.es_propietario_de(p_comunidad uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.comunidades
    where id = p_comunidad
      and propietario_id = auth.uid()
      and estado = 'activa'
  );
$$;

-- Los miembros leen la fila de su academia aunque este suspendida: la politica
-- pasa a `inscrito_en`. El propietario ya la leia por `propietario_id` directo,
-- asi que su politica de lectura no hace falta tocarla.
drop policy if exists "comunidades: los miembros la ven" on public.comunidades;
create policy "comunidades: los miembros la ven"
  on public.comunidades for select
  using (privado.inscrito_en(id) or privado.es_superadmin());

-- Editar una academia suspendida tampoco. Esta politica usaba `propietario_id`
-- directo, asi que se habria quedado fuera del cambio de `es_propietario_de`.
--
-- El `with check` es ademas lo que impide que un creador se suspenda a si
-- mismo: la fila nueva tendria estado 'suspendida' y no pasa la comprobacion.
-- Suspender es del superadmin, que es tambien quien puede deshacerlo.
drop policy if exists "comunidades: el propietario edita la suya" on public.comunidades;
create policy "comunidades: el propietario edita la suya"
  on public.comunidades for update
  using (propietario_id = (select auth.uid()) and estado = 'activa')
  with check (propietario_id = (select auth.uid()) and estado = 'activa');
