-- Los correos que salen a los alumnos, redactados por el dueno de la academia.
--
-- Hasta hoy el texto vivia dentro de `src/lib/dar-acceso.ts` y de
-- `/api/recuperar`, escrito por nosotros y firmado "Klaze". Para quien compra
-- una plataforma para SU marca, ese correo es la primera impresion --- y era de
-- otro.
--
-- Tabla propia y no tres columnas en `comunidades`: son tres tipos hoy y seran
-- cinco, y una fila por tipo no obliga a migrar la tabla grande cada vez que
-- aparezca un correo nuevo.
--
-- La fila puede NO existir: eso significa "usa la de por defecto", que vive en
-- `src/lib/plantillas.ts`. Sembrar una fila por academia al crearla habria
-- congelado el texto por defecto en el momento del alta --- mejorarlo despues
-- no habria llegado a nadie.
create table public.plantillas_correo (
  comunidad_id   uuid not null references public.comunidades(id) on delete cascade,
  -- 'bienvenida'   --- alguien acaba de recibir acceso (panel o enlace de compra)
  -- 'recuperacion' --- "olvide mi contrasena"
  -- 'baja'         --- se le suspendio el acceso
  tipo           text not null check (tipo in ('bienvenida','recuperacion','baja')),
  asunto         text not null,
  -- Texto plano, NO html. Lo escribe alguien en un `<textarea>`, y se escapa
  -- antes de meterlo en el correo: ver `src/lib/plantillas.ts`. Aceptar html
  -- aqui seria dejar que un renglon mal cerrado rompa el correo de todos sus
  -- compradores, y el dueno no se enteraria porque a el le llega bien.
  cuerpo         text not null,
  actualizada_el timestamptz not null default now(),
  primary key (comunidad_id, tipo)
);
alter table public.plantillas_correo enable row level security;

-- El servidor las lee con la clave secreta, que se salta RLS. Esta politica es
-- para el editor del panel: cada quien la suya.
create policy "plantillas_correo: las gestiona el propietario"
  on public.plantillas_correo for all to authenticated
  using (privado.es_propietario_de(comunidad_id) or privado.es_superadmin())
  with check (privado.es_propietario_de(comunidad_id) or privado.es_superadmin());

-- Crear la tabla por SQL no la expone al API: hace falta el grant explicito.
grant select, insert, update, delete on public.plantillas_correo to authenticated;
