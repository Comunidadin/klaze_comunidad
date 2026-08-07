-- Portada por leccion.
--
-- Dentro de un modulo, las clases se listaban como texto. En las plataformas
-- que el usuario ya usa aparecen como tarjetas con miniatura, y esa miniatura
-- es lo que hace que una clase se distinga de otra de un vistazo.
--
-- Nullable a proposito: una clase sin portada cae en la del modulo, y esa a su
-- vez en el degradado con inicial. Ninguna pantalla queda con un hueco, asi que
-- subirla nunca es obligatorio.
alter table public.lecciones
  add column if not exists portada_url text;
