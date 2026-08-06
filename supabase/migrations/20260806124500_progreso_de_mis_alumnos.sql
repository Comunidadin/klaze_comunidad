-- Progreso de los alumnos de una academia, para su dueno.
--
-- La tabla `progreso` es privada hasta para el dueno: su politica es "solo el
-- propio". Eso es correcto — el detalle de que lecciones ha visto una persona
-- y cuando es suyo — pero deja sin datos a `/admin/alumnos`, que muestra el
-- avance de cada uno, y eso si es informacion que un profesor necesita.
--
-- La salida se acota a proposito a (usuario, leccion): lo justo para calcular
-- porcentajes. NO devuelve `completada_el`, asi que el dueno sabe cuanto ha
-- avanzado alguien pero no a que hora estudia. Abrir la tabla entera habria
-- dado las dos cosas.
create function public.progreso_de_mis_alumnos(p_comunidad uuid)
returns table (usuario_id uuid, leccion_id uuid)
language sql security definer stable set search_path = '' as $$
  select p.usuario_id, p.leccion_id
  from public.progreso p
  join public.lecciones l on l.id = p.leccion_id
  join public.modulos m on m.id = l.modulo_id
  join public.cursos c on c.id = m.curso_id
  where c.comunidad_id = p_comunidad
    and (privado.es_propietario_de(p_comunidad) or privado.es_superadmin());
$$;

grant execute on function public.progreso_de_mis_alumnos(uuid) to authenticated;
