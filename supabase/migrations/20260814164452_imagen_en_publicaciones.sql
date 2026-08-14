-- Una imagen por publicacion.
--
-- La columna es una URL al bucket publico (o externa): las politicas de
-- `publicaciones` ya gobiernan quien escribe la fila, asi que la columna no
-- necesita politica propia.

alter table public.publicaciones add column imagen_url text;

-- La carpeta de imagenes de posts, con la misma forma que la de avatares:
-- `publicaciones/{usuario_id}/{uuid}.webp`. La carpeta ES el usuario, asi que
-- nadie puede subir "al post de aquel" — y los alumnos pueden subir, cosa que
-- la carpeta `academias/` (solo propietario) no permite.
drop policy if exists "publico: cada cual gestiona sus imagenes de posts" on storage.objects;
create policy "publico: cada cual gestiona sus imagenes de posts"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
