-- La cara del asistente, junto a su nombre.
--
-- Va en `comunidades` y no en la plataforma por lo mismo que `nombre_ia`:
-- BecarIA es la identidad de UNA academia. Una foto global se la pondria a
-- todas, que es el error que costo la reescritura de marca blanca.
--
-- Nullable: sin foto, el chat usa el icono de siempre.
alter table public.comunidades
  add column if not exists avatar_ia text;
