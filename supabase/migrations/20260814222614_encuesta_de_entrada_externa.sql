-- Encuesta de entrada EXTERNA: un Typeform (o similar) como popup al llegar.
--
-- Complementa a la encuesta nativa marcada como popup: para formularios
-- largos el creador pega el codigo de incrustacion en Configuracion y la URL
-- (solo la URL — el HTML nunca se inyecta) se enseña en un iframe dentro del
-- popup. `obligatoria` decide si se puede descartar sin responder.
--
-- Columnas en `comunidades` y no tabla aparte: es UNA por academia, como el
-- color o el logo, y las politicas existentes ya gobiernan quien la edita.

alter table public.comunidades
  add column encuesta_url text,
  add column encuesta_obligatoria boolean not null default false;
