-- El candado de un espacio (`espacios.solo_lectura`) se cumple en la base.
--
-- Hasta ahora solo lo respetaba la pantalla: el feed esconde el composer a
-- quien no es dueño, pero la política de insert de `publicaciones` no miraba
-- el espacio, así que cualquier alumno con la API a pelo podía publicar en
-- «Anuncios». La regla de la casa es que el acceso vive en las políticas, no
-- en el cliente.
--
-- La política nueva añade dos cosas:
--
-- 1. El espacio tiene que ser DE la misma comunidad que la publicación. Antes
--    nada ataba `espacio_id` a `comunidad_id` y se podía colar un espacio
--    ajeno en el feed propio.
-- 2. Si el espacio es de solo lectura, solo publica el propietario.
--
-- Y hace explícito al propietario en la pertenencia: en el flujo real siempre
-- está inscrito (lo inscribe `crearAcademia`), pero su derecho a publicar en
-- su academia no debería depender de esa fila.

drop policy "publicaciones: escribe el autor" on public.publicaciones;
create policy "publicaciones: escribe el autor"
  on public.publicaciones for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and (privado.pertenece_a(comunidad_id)
         or privado.es_propietario_de(comunidad_id))
    and exists (
      select 1
      from public.espacios esp
      join public.secciones s on s.id = esp.seccion_id
      where esp.id = espacio_id
        and s.comunidad_id = publicaciones.comunidad_id
        and (not esp.solo_lectura
             or privado.es_propietario_de(publicaciones.comunidad_id))
    )
  );
