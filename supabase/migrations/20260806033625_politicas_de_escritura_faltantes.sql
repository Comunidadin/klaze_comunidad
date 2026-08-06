-- Politicas de escritura que faltaban.
--
-- El cimiento dio a estas tablas politica de SELECT pero ninguna de escritura,
-- asi que nadie podia insertar ni editar en ellas: ni el dueno de la academia
-- en sus propios modulos y lecciones, ni el superadmin en los planes.
--
-- No lo detecto la auditoria porque solo comprobaba que cada tabla tuviera "al
-- menos una politica", y la de SELECT contaba. Lo encontro la primera prueba
-- que intento guardar un curso de verdad. La auditoria se refuerza en
-- `tests/rls/auditoria.test.ts` para que una tabla de solo lectura vuelva a
-- saltar.

-- Contenido del curso: lo gestiona el dueno de la comunidad a la que pertenece.
create policy "modulos: los gestiona el propietario"
  on public.modulos for all to authenticated
  using (exists (select 1 from public.cursos c
                 where c.id = modulos.curso_id
                   and privado.es_propietario_de(c.comunidad_id)))
  with check (exists (select 1 from public.cursos c
                      where c.id = modulos.curso_id
                        and privado.es_propietario_de(c.comunidad_id)));

create policy "lecciones: las gestiona el propietario"
  on public.lecciones for all to authenticated
  using (exists (select 1 from public.modulos m
                 join public.cursos c on c.id = m.curso_id
                 where m.id = lecciones.modulo_id
                   and privado.es_propietario_de(c.comunidad_id)))
  with check (exists (select 1 from public.modulos m
                      join public.cursos c on c.id = m.curso_id
                      where m.id = lecciones.modulo_id
                        and privado.es_propietario_de(c.comunidad_id)));

create policy "secciones: las gestiona el propietario"
  on public.secciones for all to authenticated
  using (exists (select 1 from public.cursos c
                 where c.id = secciones.curso_id
                   and privado.es_propietario_de(c.comunidad_id)))
  with check (exists (select 1 from public.cursos c
                      where c.id = secciones.curso_id
                        and privado.es_propietario_de(c.comunidad_id)));

create policy "espacios: los gestiona el propietario"
  on public.espacios for all to authenticated
  using (exists (select 1 from public.secciones s
                 join public.cursos c on c.id = s.curso_id
                 where s.id = espacios.seccion_id
                   and privado.es_propietario_de(c.comunidad_id)))
  with check (exists (select 1 from public.secciones s
                      join public.cursos c on c.id = s.curso_id
                      where s.id = espacios.seccion_id
                        and privado.es_propietario_de(c.comunidad_id)));

-- La identidad de la academia la edita su dueno desde /admin/configuracion.
-- Solo UPDATE: crear academias va por el comando `crear-academia`, que usa la
-- clave secreta, y suspenderlas es cosa del superadmin.
create policy "comunidades: el propietario edita la suya"
  on public.comunidades for update to authenticated
  using (propietario_id = (select auth.uid()))
  with check (propietario_id = (select auth.uid()));

create policy "comunidades: las gestiona el superadmin"
  on public.comunidades for all to authenticated
  using (privado.es_superadmin())
  with check (privado.es_superadmin());

create policy "planes: los gestiona el superadmin"
  on public.planes for all to authenticated
  using (privado.es_superadmin())
  with check (privado.es_superadmin());

grant insert, update, delete on public.comunidades to authenticated;
grant insert, update, delete on public.planes to authenticated;
