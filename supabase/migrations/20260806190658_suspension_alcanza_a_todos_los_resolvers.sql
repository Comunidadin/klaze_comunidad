-- La migracion anterior arreglo `pertenece_a` y `es_propietario_de`, y las
-- pruebas siguieron rojas: el acceso a un curso no pasa por ninguna de las dos.
--
-- Quedaban cuatro caminos abiertos a una academia suspendida:
--
--   1. `cubre_curso`  --- por donde entra un alumno a un curso.
--   2. La politica ALL de `cursos`, que comprobaba `propietario_id` en linea
--      en vez de usar el resolver, y por eso se quedo fuera del cambio.
--   3. `comparte_comunidad_con` --- perfiles de los companeros.
--   4. `administra_a` --- perfiles de los inscritos, para el panel del dueno.
--
-- La leccion se repite: cada vez que un consumidor re-deriva la regla por su
-- cuenta en vez de llamar al resolver, se queda fuera de la siguiente
-- correccion. Por eso (2) pasa a llamar a `privado.es_propietario_de`.
--
-- Los joins van por comunidad, no globales: quien pertenezca a dos academias y
-- tenga una suspendida conserva el acceso completo a la otra.

create or replace function privado.cubre_curso(p_curso uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.cursos c on c.comunidad_id = i.comunidad_id
    join public.comunidades com on com.id = c.comunidad_id
    left join public.inscripcion_cursos ic
      on ic.inscripcion_id = i.id and ic.curso_id = c.id
    where i.usuario_id = auth.uid()
      and c.id = p_curso
      and i.estado = 'activo'
      and com.estado = 'activa'
      and c.publicado
      and (i.todos_los_cursos or ic.curso_id is not null)
  );
$$;

create or replace function privado.comparte_comunidad_con(p_usuario uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.inscripciones mias
    join public.inscripciones suyas on suyas.comunidad_id = mias.comunidad_id
    join public.comunidades c on c.id = mias.comunidad_id
    where mias.usuario_id = auth.uid()
      and suyas.usuario_id = p_usuario
      and mias.estado = 'activo'
      and suyas.estado = 'activo'
      and c.estado = 'activa'
  );
$$;

create or replace function privado.administra_a(p_usuario uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.comunidades c on c.id = i.comunidad_id
    where i.usuario_id = p_usuario
      and c.propietario_id = auth.uid()
      and c.estado = 'activa'
  );
$$;

-- Pasa por el resolver en vez de repetir la comprobacion: es el punto unico de
-- verdad, y repetirla es justo lo que dejo esta politica fuera del arreglo.
drop policy if exists "cursos: los gestiona el propietario" on public.cursos;
create policy "cursos: los gestiona el propietario"
  on public.cursos for all
  using (privado.es_propietario_de(comunidad_id))
  with check (privado.es_propietario_de(comunidad_id));
