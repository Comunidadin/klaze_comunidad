-- Goteo de contenido: los modulos se abren cuando toca.
--
-- Quien compra recibia hoy el temario entero el primer dia. Podia verlo todo en
-- un fin de semana y pedir el reembolso, y ademas se llevaba el ritmo por
-- delante: nadie vuelve a una comunidad de la que ya se llevo todo.
--
-- EL RESOLVER NO VA DENTRO DE `cubre_curso`, y esa es la decision de fondo.
-- `cubre_curso` decide si el modulo EXISTE para ti; metiendo ahi la fecha, un
-- modulo pendiente desapareceria de la lista sin candado, sin fecha y sin
-- explicacion, arrastrando su ficha y su fila del ranking --- y `cubre_curso_de`
-- alimenta el directorio de miembros, asi que la gente apareceria y
-- desapareceria de el segun el dia. Es el callejon sin salida de las academias
-- suspendidas: la app no puede distinguir "todavia no" de "no existe".
--
-- La division correcta ya existe aqui: `inscrito_en` deja ver la fila,
-- `pertenece_a` deja ver el contenido. Esto la repite un nivel mas abajo.

/* 1 --- La configuracion, en el propio modulo. --------------------------- */

alter table public.cursos
  add column goteo_modo  text not null default 'ninguno'
    check (goteo_modo in ('ninguno','dias','fecha')),
  -- Solo en modo 'dias': cuantos dias desde que el alumno entro a la academia.
  add column goteo_dias  integer,
  -- Solo en modo 'fecha'. `timestamptz` y no `date` porque el creador elige
  -- fecha Y hora: con solo fecha habria que inventarse una hora y una zona, y
  -- "el 15 de septiembre" significaria cosas distintas en Quito y en Madrid.
  add column goteo_desde timestamptz;

-- Discriminador explicito, y no "si goteo_dias no es nulo entonces es por
-- dias". Misma decision que `canales_venta.tipo`: un nulo con significado es lo
-- que hace que dentro de tres meses nadie recuerde por que esa columna es
-- opcional. Con la restriccion, un modo a medias no se puede guardar ni
-- saltandose la pantalla.
alter table public.cursos
  add constraint cursos_goteo_coherente check (
    (goteo_modo = 'ninguno' and goteo_dias is null and goteo_desde is null) or
    (goteo_modo = 'dias'    and goteo_dias is not null and goteo_dias > 0
                            and goteo_desde is null) or
    (goteo_modo = 'fecha'   and goteo_desde is not null and goteo_dias is null)
  );

/* 2 --- Los umbrales de nivel, que hasta hoy solo existian en TypeScript. -- */

-- Copia de `NIVEL_UMBRALES` de `src/lib/levels.ts`. Existir en dos sitios es el
-- precio de aplicar el candado por nivel en la base en vez de solo en la
-- pantalla; `tests/rls/goteo.test.ts` compara los dos para que no se separen.
--
-- `greatest(1, ...)` porque `ajustar_puntos` RESTA al borrar una leccion, asi
-- que un alumno puede acabar bajo cero. TypeScript devuelve 1 ahi, y esto tiene
-- que devolver lo mismo o los dos candados discreparian justo en el caso raro.
create function privado.nivel_por_puntos(p_puntos integer) returns integer
language sql immutable set search_path = '' as $$
  select greatest(1, (
    select count(*)::integer
    from unnest(array[0,20,65,155,315,515,815,1215,1715]) u
    where p_puntos >= u
  ));
$$;

/* 3 --- El resolver. ------------------------------------------------------ */

-- "Este modulo esta abierto para mi ahora mismo?" --- una sola pregunta que
-- comprueba los DOS candados: la fecha del goteo y el nivel.
--
-- Una funcion y no dos, aunque sean reglas distintas: tienen el mismo efecto y
-- el mismo sitio de llamada. Separarlas obligaria a cada consumidor futuro a
-- acordarse de invocar las dos --- que es exactamente como `lecciones` se quedo
-- sin comprobar `publicado` cuando `modulos` si lo comprobaba.
--
-- Un `p_curso` inexistente devuelve null, y una politica trata null como falso:
-- el resultado correcto.
create function privado.curso_disponible(p_curso uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    (case c.goteo_modo
       when 'fecha' then c.goteo_desde <= now()
       when 'dias'  then exists (
         select 1 from public.inscripciones i
         where i.usuario_id = (select auth.uid())
           and i.comunidad_id = c.comunidad_id
           and i.estado = 'activo'
           and i.creado_el + make_interval(days => c.goteo_dias) <= now())
       else true
     end)
    and
    (c.nivel_requerido is null
     or privado.nivel_por_puntos(
          coalesce((select p.puntos from public.perfiles p
                    where p.id = (select auth.uid())), 0)
        ) >= c.nivel_requerido)
  from public.cursos c
  where c.id = p_curso;
$$;

grant execute on function privado.nivel_por_puntos(integer) to authenticated;
grant execute on function privado.curso_disponible(uuid) to authenticated;

/* 4 --- Las dos politicas. ------------------------------------------------ */

-- Solo cambia la rama del MIEMBRO. La del dueno queda intacta y es
-- deliberado: es lo que le deja preparar el modulo antes de que abra. El precio
-- es que su "Ver como alumno" miente, y la pantalla lo dice.

drop policy if exists "modulos: via su curso" on public.modulos;
create policy "modulos: via su curso"
  on public.modulos for select to authenticated
  using (
    (publicado
     and privado.cubre_curso(curso_id)
     and privado.curso_disponible(curso_id))
    or exists (select 1 from public.cursos c
               where c.id = modulos.curso_id
                 and privado.es_propietario_de(c.comunidad_id))
  );

-- OJO: esta politica NO comprobaba `m.publicado`. La migracion
-- `20260807024857_modulo_en_borrador_no_sale_de_la_base` lo arreglo en
-- `modulos` y se dejo esta fuera, asi que las clases de un submodulo en
-- borrador SI salian de la base aunque el submodulo no apareciera. Se arregla
-- aqui porque es la misma linea y el mismo repaso --- y porque sin ese
-- `m.publicado` la cascada del goteo tampoco funcionaria.
drop policy if exists "lecciones: via su modulo" on public.lecciones;
create policy "lecciones: via su modulo"
  on public.lecciones for select to authenticated
  using (
    exists (
      select 1 from public.modulos m
      where m.id = lecciones.modulo_id
        and (
          (m.publicado
           and privado.cubre_curso(m.curso_id)
           and privado.curso_disponible(m.curso_id))
          or exists (select 1 from public.cursos c
                     where c.id = m.curso_id
                       and privado.es_propietario_de(c.comunidad_id))
        )
    )
  );
