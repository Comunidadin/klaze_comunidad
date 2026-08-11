-- El orden en que se enseñan los modulos de una academia.
--
-- Hasta hoy no habia ninguno: la lista salia como la devolviera Postgres, que
-- no promete nada. Con dos modulos daba igual; con los diez de una mentoria
-- entera, el orden ES el temario --- "Introduccion y Bienvenida" no puede
-- aparecer detras de "Avanzada".
--
-- `modulos` y `lecciones` ya tenian su `orden`; esto termina de subirlo un
-- nivel, y con el mismo nombre y el mismo tipo.
alter table public.cursos add column orden integer not null default 0;

-- Los que ya existen conservan el orden en que se crearon, que es el unico que
-- su dueno ha visto. Dejarlos todos en 0 los habria barajado en la primera
-- lectura.
with numerados as (
  select id, row_number() over (
           partition by comunidad_id order by creado_el, id
         ) as fila
  from public.cursos
)
update public.cursos c
   set orden = n.fila
  from numerados n
 where n.id = c.id;

-- La lista pide siempre (comunidad, orden). Sin el indice, cada carga del
-- armazon ordena en memoria.
create index cursos_comunidad_orden on public.cursos (comunidad_id, orden);
