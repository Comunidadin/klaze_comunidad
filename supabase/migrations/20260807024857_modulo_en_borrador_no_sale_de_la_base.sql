-- Un curso en borrador no debe llegar al navegador del alumno, no solo
-- quedarse sin pintar.
--
-- La app ya lo filtra en `cursosVisiblesParaMiembro`, pero eso ocurre DESPUES
-- de que la respuesta viaje: quien mirase la peticion en las herramientas del
-- navegador veria los titulos y los identificadores de Vimeo de lo que aun no
-- has publicado. Es exactamente la clase de cosa que este proyecto decidio
-- resolver en la base y no en la pantalla.
--
-- Una vitrina sin publicar ya se ocultaba asi --- `privado.cubre_curso`
-- comprueba `c.publicado` ---, y esto pone el nivel de en medio al mismo
-- nivel de rigor.
--
-- El propietario sigue viendolo todo: es quien lo esta preparando.
drop policy if exists "modulos: via su curso" on public.modulos;
create policy "modulos: via su curso"
  on public.modulos for select
  using (
    (publicado and privado.cubre_curso(curso_id))
    or exists (
      select 1 from public.cursos c
      where c.id = modulos.curso_id
        and privado.es_propietario_de(c.comunidad_id)
    )
  );
