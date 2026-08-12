-- Topes de uso: el contador que le faltaba a lo que gasta dinero.
--
-- Tres puertas mandan correo por la cuenta de Resend del dueno de la
-- plataforma, y hasta hoy solo una tenia tope. `/api/recuperar` es la peor:
-- publica, sin sesion, sin captcha, y un correo por peticion. Un bucle de tres
-- lineas quema la cuota --- pero eso es lo de menos. Lo que de verdad no se
-- compra de vuelta es la REPUTACION DEL DOMINIO: en cuanto un volumen anomalo
-- lo marca como spam, dejan de llegar los correos de acceso de toda la gente
-- que si pago, y recuperarla lleva semanas.
--
-- Tabla generica y no una por endpoint. Son tres hoy y seran cinco, y un
-- contador por sitio significa tres formas distintas de contar el mismo dia.

create table public.limites_uso (
  -- Que se esta limitando: 'recuperar_email', 'recuperar_ip', 'invitaciones'.
  ambito text not null,
  -- A quien: el correo, la direccion IP, o el id de la academia. Texto y no
  -- uuid a proposito --- las tres cosas caben aqui y ninguna tabla apunta a
  -- esto, asi que una clave foranea solo ataria las manos.
  clave  text not null,
  dia    date not null default current_date,
  usos   integer not null default 0,
  primary key (ambito, clave, dia)
);

alter table public.limites_uso enable row level security;

-- SIN NINGUNA POLITICA, y la ausencia ES la proteccion. Aqui solo escribe
-- `consumir_limite`, que es `security definer`. Con una politica de escritura,
-- quien esta siendo limitado pondria su propio contador a cero --- que es
-- exactamente lo que el contador existe para impedir.
--
-- Ni siquiera hay politica de lectura: nadie necesita ver esto desde el
-- navegador. Es la tercera excepcion de A2b en `tests/rls/auditoria.test.ts`,
-- junto a `uso_ia` y `recepciones_canal`, y por la misma razon.
--
-- Y no basta con NO poner el `grant`: Supabase tiene privilegios por defecto
-- (`pg_default_acl`) que conceden todo a `anon` y a `authenticated` sobre cada
-- tabla nueva de `public`. Hay que QUITARLOS a mano. Con RLS y cero politicas
-- ya no pasaria ninguna fila, pero dejar el permiso puesto significa que el dia
-- que alguien anada una politica "para depurar" se abre entera.
revoke all on public.limites_uso from anon, authenticated;

-- Consume un uso y dice si estaba permitido.
--
-- `insert ... on conflict do update ... returning` es una sola sentencia, asi
-- que dos peticiones simultaneas no pueden leer el mismo valor y escribir el
-- mismo numero. Contarlo con un `select` y luego un `update` seria una carrera
-- justo donde importa: un atacante manda en paralelo, no en fila.
--
-- CUENTA TAMBIEN LO QUE RECHAZA. Es deliberado: si un intento bloqueado no
-- sumara, quien esta en el tope podria seguir intentandolo para siempre sin
-- que el contador subiera nunca por encima. Asi, insistir sale mas caro.
create function public.consumir_limite(
  p_ambito text,
  p_clave  text,
  p_tope   integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_usos integer;
begin
  insert into public.limites_uso (ambito, clave, dia, usos)
  values (p_ambito, lower(btrim(p_clave)), current_date, 1)
  on conflict (ambito, clave, dia)
    do update set usos = public.limites_uso.usos + 1
  returning usos into v_usos;

  return v_usos <= p_tope;
end;
$$;

-- Solo el servidor. Desde el navegador esto no se puede ni nombrar: quien
-- pudiera llamarlo gastaria el tope de otro con solo saber su correo.
revoke all on function public.consumir_limite(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.consumir_limite(text, text, integer) to service_role;

-- Borrar lo viejo. Solo se lee el dia de hoy, asi que todo lo anterior es
-- peso muerto: una fila por correo y por IP distintos cada dia se acumula.
--
-- No se programa aqui. Dejarla suelta y llamarla a mano —o engancharla a
-- pg_cron el dia que haga falta— es mejor que un borrado escondido dentro de
-- `consumir_limite`, donde nadie lo vería venir y encima pagaria su coste en
-- la peticion de un usuario.
create function public.purgar_limites(p_dias integer default 30) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_borradas integer;
begin
  delete from public.limites_uso where dia < current_date - p_dias;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke all on function public.purgar_limites(integer) from public, anon, authenticated;
grant execute on function public.purgar_limites(integer) to service_role;
