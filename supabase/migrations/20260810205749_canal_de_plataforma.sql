-- Un enlace de compra que, en vez de dar acceso a un alumno, da de alta una
-- academia entera.
--
-- Es el nivel de arriba: alguien compra Klaze y entra solo, igual que sus
-- alumnos entrarán solos cuando le compren a el. Hasta ahora eso exigia que el
-- superadmin creara la academia a mano desde /plataforma, asi que vender la
-- plataforma mientras duermes no era posible.
--
-- Se generaliza `canales_venta` en vez de crear una tabla paralela. Un canal de
-- plataforma necesita exactamente lo mismo que ya hay aqui —token de 32 bytes,
-- busqueda por token, tope diario, registro de recepciones y el panel que lo
-- enseña— con otro efecto al final. Dos tablas serian dos busquedas, dos
-- registros y dos limitadores que dentro de unos meses no coinciden.

alter table public.canales_venta
  -- Discriminador explicito y no "si `comunidad_id` es nulo, es de
  -- plataforma": un nulo con significado oculto es justo lo que nadie recuerda
  -- al volver al archivo dentro de tres meses.
  add column tipo text not null default 'academia'
    check (tipo in ('academia','plataforma')),
  add column plan_id text references public.planes(id),
  alter column comunidad_id drop not null;

-- Que no exista un canal a medio camino: uno de academia sin academia, o uno de
-- plataforma sin plan. La base lo impide en vez de confiar en que las dos rutas
-- se acuerden.
alter table public.canales_venta
  add constraint canal_coherente check (
    (tipo = 'academia'   and comunidad_id is not null) or
    (tipo = 'plataforma' and comunidad_id is null and plan_id is not null)
  );

-- Las dos politicas daban por hecho que hay comunidad, y con `comunidad_id`
-- nulo `es_propietario_de(null)` es falso para todo el mundo: sin rehacerlas,
-- un canal de plataforma seria invisible incluso para el superadmin.
--
-- Un creador NO puede ver ni crear canales de plataforma. Si pudiera, se
-- regalaria academias.
drop policy if exists "canales_venta: solo el propietario" on public.canales_venta;
create policy "canales_venta: su dueno, y los de plataforma el superadmin"
  on public.canales_venta for all to authenticated
  using (
    case when tipo = 'plataforma' then privado.es_superadmin()
         else privado.es_propietario_de(comunidad_id) or privado.es_superadmin()
    end
  )
  with check (
    case when tipo = 'plataforma' then privado.es_superadmin()
         else privado.es_propietario_de(comunidad_id) or privado.es_superadmin()
    end
  );

drop policy if exists "recepciones_canal: las lee el dueno del canal" on public.recepciones_canal;
create policy "recepciones_canal: las lee el dueno del canal"
  on public.recepciones_canal for select to authenticated
  using (exists (
    select 1 from public.canales_venta c
    where c.id = canal_id
      and case when c.tipo = 'plataforma' then privado.es_superadmin()
               else privado.es_propietario_de(c.comunidad_id)
                    or privado.es_superadmin()
          end
  ));

-- Tres resultados nuevos, los del nivel de plataforma.
alter table public.recepciones_canal
  drop constraint if exists recepciones_canal_resultado_check;
alter table public.recepciones_canal
  add constraint recepciones_canal_resultado_check check (resultado in (
    'creado','ya_tenia','suspendido','sin_email','sin_cuenta','rechazado',
    'academia_creada','academia_reactivada','academia_suspendida'
  ));
