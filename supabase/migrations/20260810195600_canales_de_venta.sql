-- Enlaces de compra: dar acceso sin que nadie toque el panel.
--
-- Hasta hoy, vender significaba que alguien entrara en /admin/accesos y
-- escribiera el correo del comprador. Esto es la otra mitad: una direccion a la
-- que el formulario de venta escribe, y el alumno entra solo.
--
-- La idea de fondo: **la URL es el producto**. Un canal por oferta, y los
-- modulos que incluye los guarda el canal. Asi el formulario externo no tiene
-- que mandar ningun identificador --- lo unico que toda herramienta sabe hacer
-- es escribir a una direccion, y eso basta.

create table public.canales_venta (
  id               uuid primary key default gen_random_uuid(),
  comunidad_id     uuid not null references public.comunidades(id) on delete cascade,
  nombre           text not null,
  -- Mismo secreto que las invitaciones: 32 bytes en hex. Va dentro de una URL,
  -- asi que 'hex' y no 'base64' --- base64 produce '/' y '+'.
  --
  -- Quien tiene el token puede dar acceso. Es una contrasena, y el panel lo
  -- dice con esas palabras.
  token            text not null unique
                     default encode(extensions.gen_random_bytes(32), 'hex'),
  todos_los_cursos boolean not null default false,
  activo           boolean not null default true,
  creado_el        timestamptz not null default now()
);
alter table public.canales_venta enable row level security;
create index on public.canales_venta (comunidad_id);

create table public.canal_cursos (
  canal_id uuid not null references public.canales_venta(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  primary key (canal_id, curso_id)
);
alter table public.canal_cursos enable row level security;
create index on public.canal_cursos (curso_id);

-- El registro de lo que llega.
--
-- No es un lujo: el fallo tipico de un webhook es "el formulario disparo y no
-- entro nadie", y sin registro no hay forma de saber si llego. Ademas es el
-- rastro de auditoria de una direccion publica.
create table public.recepciones_canal (
  id          uuid primary key default gen_random_uuid(),
  canal_id    uuid not null references public.canales_venta(id) on delete cascade,
  email       text,
  accion      text not null check (accion in ('alta','baja')),
  resultado   text not null check (resultado in
                ('creado','ya_tenia','suspendido','sin_email','sin_cuenta','rechazado')),
  detalle     text not null default '',
  -- El cuerpo tal cual llego, truncado. Es lo que permite ver por que no se
  -- encontro el correo cuando la otra aplicacion llama al campo de otra forma.
  cuerpo      text not null default '',
  recibida_el timestamptz not null default now()
);
alter table public.recepciones_canal enable row level security;
create index on public.recepciones_canal (canal_id, recibida_el desc);

create policy "canales_venta: solo el propietario"
  on public.canales_venta for all to authenticated
  using (privado.es_propietario_de(comunidad_id) or privado.es_superadmin())
  with check (privado.es_propietario_de(comunidad_id) or privado.es_superadmin());

create policy "canal_cursos: via su canal"
  on public.canal_cursos for all to authenticated
  using (exists (select 1 from public.canales_venta c
                 where c.id = canal_id
                   and privado.es_propietario_de(c.comunidad_id)))
  with check (exists (select 1 from public.canales_venta c
                      where c.id = canal_id
                        and privado.es_propietario_de(c.comunidad_id)));

-- Solo lectura, y a proposito: la AUSENCIA de politica de escritura ES la
-- proteccion. Aqui solo escribe el Route Handler con la clave secreta, que se
-- salta RLS. Con una politica de escritura, el dueno podria borrar o inventar
-- recepciones --- y un registro que se puede editar no es un registro.
--
-- Es la segunda excepcion de A2b en `tests/rls/auditoria.test.ts`, junto a
-- `uso_ia`, por la misma razon.
create policy "recepciones_canal: las lee el dueno del canal"
  on public.recepciones_canal for select to authenticated
  using (exists (select 1 from public.canales_venta c
                 where c.id = canal_id
                   and (privado.es_propietario_de(c.comunidad_id)
                        or privado.es_superadmin())));

-- Crear la tabla por SQL no la expone al API: hace falta el grant explicito.
grant select, insert, update, delete on
  public.canales_venta, public.canal_cursos to authenticated;
grant select on public.recepciones_canal to authenticated;

-- Encontrar a alguien por su correo, en una consulta.
--
-- Sustituye a `listUsers({ perPage: 1000 })`, que es lo que hacia
-- `/api/invitaciones` para saber si el invitado ya tenia cuenta. Pasadas mil
-- cuentas deja de encontrar a quien ya existe, intenta crearla otra vez y
-- devuelve un error --- es decir, se rompe justo cuando el negocio funciona.
--
-- No es `security definer`: la llama el servidor con la clave secreta, que ya
-- se salta RLS. Sin definer no hay nada que auditar aqui.
--
-- `perfiles.email` es una copia de `auth.users.email` que mantiene un trigger
-- (ver `20260806124902_perfiles_con_email.sql`), asi que preguntar aqui evita
-- tocar el esquema `auth`.
create index perfiles_email_minusculas on public.perfiles (lower(email));

create function public.perfil_por_email(p_email text) returns uuid
language sql stable set search_path = '' as $$
  select id from public.perfiles where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.perfil_por_email(text) from public, anon, authenticated;
grant execute on function public.perfil_por_email(text) to service_role;
