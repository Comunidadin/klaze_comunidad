-- Anade `completada_el` a `progreso_de_mis_alumnos`.
--
-- La version anterior la excluia a proposito, con el argumento de que el dueno
-- debia saber cuanto ha avanzado alguien pero no a que hora estudia. Suena
-- bien, y estaba de mas: en una plataforma de formacion, que un profesor vea
-- cuando avanzo un alumno es normal y esperado, y sin la fecha no se puede
-- construir el grafico de actividad semanal de /admin/reportes — una funcion
-- real perdida por una cautela que nadie pidio.
--
-- Lo que sigue acotado es el alcance: solo el dueno de esa academia (o el
-- superadmin) ve estas filas, y solo las de SUS cursos.
drop function if exists public.progreso_de_mis_alumnos(uuid);

create function public.progreso_de_mis_alumnos(p_comunidad uuid)
returns table (usuario_id uuid, leccion_id uuid, completada_el timestamptz)
language sql security definer stable set search_path = '' as $$
  select p.usuario_id, p.leccion_id, p.completada_el
  from public.progreso p
  join public.lecciones l on l.id = p.leccion_id
  join public.modulos m on m.id = l.modulo_id
  join public.cursos c on c.id = m.curso_id
  where c.comunidad_id = p_comunidad
    and (privado.es_propietario_de(p_comunidad) or privado.es_superadmin());
$$;

grant execute on function public.progreso_de_mis_alumnos(uuid) to authenticated;
