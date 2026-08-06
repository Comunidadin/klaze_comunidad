-- `Plan.limites` tiene tres numeros --- comunidades, alumnos y cursos --- y la
-- pantalla de planes edita los tres desde el principio. Pero `public.planes`
-- solo tenia `max_alumnos` y `max_cursos`.
--
-- Mientras los planes vivian en datos semilla nadie lo noto. Al pasarlos a la
-- base, el campo "Comunidades" habria dicho "Plan actualizado" y el numero
-- habria vuelto solo al recargar: guardado en el vacio.
--
-- Por defecto 1: un creador administra una academia. Los limites no se hacen
-- cumplir todavia (decision de la spec) --- este numero es informativo.
alter table public.planes
  add column if not exists max_comunidades integer not null default 1;
