-- Una clase deja de "ser de un tipo" y pasa a tener PIEZAS.
--
-- Hasta ahora una clase era de video O de texto, nunca las dos. Pero lo que
-- hace falta a la primera semana es un video, debajo una explicacion, y al
-- final un formulario para entregar la tarea. Eso eran tres clases seguidas o
-- una que no podia hacerlo.
--
-- `bloques` es un array JSON ordenado. Cada pieza:
--
--   { "id": "...", "tipo": "video", "vimeoId": "123" }
--   { "id": "...", "tipo": "texto", "doc": { ... } }      <- documento del editor
--   { "id": "...", "tipo": "embed", "url": "https://...", "alto": 480 }
--
-- Va en jsonb y no en una tabla aparte porque las piezas SIEMPRE se leen con
-- su clase y nunca por separado: una tabla anadiria un join a cada consulta
-- del armazon para no ganar nada.
--
-- El texto se guarda como DOCUMENTO, no como HTML. Guardar HTML significaria
-- volcarlo luego en la pagina, y ahi cualquier cosa que un creador pegue
-- --- o que le inyecten si le roban la cuenta --- se ejecutaria en el
-- navegador de sus alumnos con la sesion abierta.

alter table public.lecciones
  add column if not exists bloques jsonb not null default '[]'::jsonb;

-- Se traslada lo que ya existe. Sin esto, las clases actuales apareceran
-- vacias: el contenido seguiria en las columnas viejas y nadie las leeria.
update public.lecciones
set bloques = (
  select coalesce(jsonb_agg(pieza order by orden), '[]'::jsonb)
  from (
    -- El video, si lo hay, va primero.
    select 1 as orden,
           jsonb_build_object(
             'id', gen_random_uuid()::text,
             'tipo', 'video',
             'vimeoId', vimeo_id
           ) as pieza
    where tipo = 'video' and vimeo_id is not null and vimeo_id <> ''

    union all

    -- El texto que hubiera, como un parrafo por linea en blanco.
    select 2,
           jsonb_build_object(
             'id', gen_random_uuid()::text,
             'tipo', 'texto',
             'doc', jsonb_build_object(
               'type', 'doc',
               'content', (
                 select jsonb_agg(
                   jsonb_build_object(
                     'type', 'paragraph',
                     'content', jsonb_build_array(
                       jsonb_build_object('type', 'text', 'text', parrafo)
                     )
                   )
                 )
                 from unnest(string_to_array(contenido, E'\n\n')) as parrafo
                 where btrim(parrafo) <> ''
               )
             )
           )
    where contenido is not null and btrim(contenido) <> ''
  ) as piezas
)
where bloques = '[]'::jsonb;

-- Las columnas viejas se van: con `bloques` al lado serian una segunda fuente
-- de verdad, y este proyecto ya pago caro tener dos sitios que dicen lo mismo.
-- `tipo` tambien: ahora se deduce de la primera pieza, para el icono.
alter table public.lecciones
  drop column if exists vimeo_id,
  drop column if exists contenido,
  drop column if exists tipo;
