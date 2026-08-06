-- El correo, tambien en el perfil.
--
-- El cimiento lo dejo solo en `auth.users` para no duplicarlo, y era la
-- decision razonable. Pero `auth.users` no es legible por nadie salvo el
-- servidor, y `/admin/alumnos` necesita mostrar a quien pertenece cada
-- inscripcion: invitas por correo, asi que el correo es como identificas a una
-- persona en esa pantalla. Sin el, la lista muestra nombres vacios de quienes
-- aun no han entrado.
--
-- Se copia en `perfiles`, donde las politicas ya deciden quien puede verlo:
-- el propio interesado y quienes comparten comunidad con el.
alter table public.perfiles add column email text not null default '';

-- Rellenar los que ya existen.
update public.perfiles p
set email = u.email
from auth.users u
where u.id = p.id;

-- Y que el trigger lo ponga de aqui en adelante. Se reemplaza la funcion
-- entera: `create or replace` conserva el trigger que ya la referencia.
create or replace function public.crear_perfil_al_registrarse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;
