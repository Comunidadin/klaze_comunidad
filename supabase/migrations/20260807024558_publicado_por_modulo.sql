-- Publicar/borrador tambien en el nivel de en medio.
--
-- En la interfaz eso es un CURSO dentro de una vitrina (ver la tabla de
-- vocabulario en CLAUDE.md; aqui la tabla se sigue llamando `modulos`).
--
-- Hasta ahora solo se publicaba la vitrina entera, asi que subir contenido a
-- medias significaba que los alumnos lo veian a medias. En el panel del que
-- viene el dueno, tres de cada cuatro cursos estan en borrador mientras se
-- preparan: es la forma normal de trabajar, no un caso raro.
--
-- `default true` y NOT NULL a proposito: todo lo que ya existe tiene que
-- seguir viendose. Un default `false` habria vaciado las academias en el
-- momento de aplicar esta migracion.
alter table public.modulos
  add column if not exists publicado boolean not null default true;
