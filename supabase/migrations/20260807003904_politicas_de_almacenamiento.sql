-- Subida de imágenes: quién puede escribir dónde.
--
-- El bucket `publico` es de lectura libre —los logos y portadas se ven sin
-- sesión, incluida la pantalla de entrada— pero escribir está acotado por la
-- PRIMERA carpeta de la ruta, que es lo único que distingue una imagen de otra:
--
--   academias/{comunidad_id}/{tipo}/{uuid}.webp   → solo su propietario
--   avatares/{usuario_id}/{uuid}.webp             → solo esa persona
--
-- Sin esta separación, cualquiera con sesión podría sobrescribir el logo de
-- otra empresa: en `storage.objects` no hay nada más que diga de quién es un
-- archivo.
--
-- `storage.foldername(name)` devuelve las carpetas de la ruta; el índice 1 es
-- la primera y el 2 la segunda (los arrays de Postgres empiezan en 1).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publico',
  'publico',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- El propietario de una academia gestiona las imágenes de su academia.
--
-- Se apoya en `privado.es_propietario_de`, el mismo resolver que guarda sus
-- cursos: si un día suspender deja de dar acceso, esto lo hereda sin tocar
-- nada. Repetir aquí la condición sería justo el error que ya nos costó dos
-- migraciones en la rebanada 4.
drop policy if exists "publico: el propietario gestiona su academia" on storage.objects;
create policy "publico: el propietario gestiona su academia"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'academias'
    and privado.es_propietario_de(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'academias'
    and privado.es_propietario_de(((storage.foldername(name))[2])::uuid)
  );

-- Cada cual gestiona su propio avatar. La carpeta ES su identificador, así que
-- no hay forma de pedir "sube esto al avatar de aquel".
drop policy if exists "publico: cada cual gestiona su avatar" on storage.objects;
create policy "publico: cada cual gestiona su avatar"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'avatares'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'publico'
    and (storage.foldername(name))[1] = 'avatares'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Lectura libre: las portadas y los logos se ven antes de iniciar sesión (la
-- pantalla de invitación enseña la marca de quien invita). El bucket ya es
-- público, pero la política explícita evita depender solo de esa bandera.
drop policy if exists "publico: lectura libre" on storage.objects;
create policy "publico: lectura libre"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'publico');
