-- Cada academia le pone nombre a su asistente.
--
-- "BecarIA" es la marca de Comunidad del Intercambio, no la de Klaze. Escribirla
-- fija en el codigo haria que el asistente de cualquier otra empresa tambien se
-- llamase asi --- el mismo error que costo la reescritura de marca blanca.
--
-- Nullable: sin nombre propio, el asistente se llama "Asistente" a secas.
alter table public.comunidades
  add column if not exists nombre_ia text;
