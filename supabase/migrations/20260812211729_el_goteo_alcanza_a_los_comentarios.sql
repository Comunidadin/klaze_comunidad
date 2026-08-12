-- El goteo no llegaba a los comentarios de una clase.
--
-- Las politicas de comentarios_leccion comprobaban cubre_curso, que dice "esto
-- te lo vendieron", pero no curso_disponible, que dice "y ya toca". Es el
-- mismo consumidor-que-repite-la-condicion que 20260812193847 arreglo para
-- modulos y lecciones: quien conserve un leccion_id de antes de encender el
-- goteo podia seguir leyendo y escribiendo comentarios de una clase de un
-- modulo todavia cerrado, aunque la clase en si (titulo, video, bloques) siga
-- sin salir.
--
-- Solo cambian las dos politicas que miran cubre_curso (select e insert). Las
-- de update/delete solo miran autor_id o es_propietario_de, no cubre_curso, y
-- no tienen esta grieta.
--
-- Nombres y cuerpos copiados de 20260806151642_comentarios_leccion.sql y
-- verificados contra pg_policies antes de escribir este archivo.

drop policy if exists "comentarios_leccion: quien tiene acceso al curso" on public.comentarios_leccion;
create policy "comentarios_leccion: quien tiene acceso al curso"
  on public.comentarios_leccion for select to authenticated
  using (exists (
    select 1 from public.lecciones l
    join public.modulos m on m.id = l.modulo_id
    join public.cursos c on c.id = m.curso_id
    where l.id = comentarios_leccion.leccion_id
      and ((privado.cubre_curso(m.curso_id) and privado.curso_disponible(m.curso_id))
           or privado.es_propietario_de(c.comunidad_id))
  ));

drop policy if exists "comentarios_leccion: escribe el autor" on public.comentarios_leccion;
create policy "comentarios_leccion: escribe el autor"
  on public.comentarios_leccion for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.lecciones l
      join public.modulos m on m.id = l.modulo_id
      join public.cursos c on c.id = m.curso_id
      where l.id = comentarios_leccion.leccion_id
        and ((privado.cubre_curso(m.curso_id) and privado.curso_disponible(m.curso_id))
             or privado.es_propietario_de(c.comunidad_id))
    )
  );
