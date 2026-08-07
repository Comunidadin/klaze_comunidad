-- El directorio de miembros de un modulo enseñaba UNA sola persona: tu.
--
-- Lo leia de `inscripciones`, y esa tabla no es publica a proposito: su
-- politica de lectura deja ver la propia fila, o todas si eres el dueño de la
-- academia. Es la decision correcta --- una inscripcion lleva el correo, el
-- estado y que modulos tiene contratados cada cual, y eso no es asunto de un
-- compañero de clase. Pero el directorio pedia justo esa tabla, asi que a un
-- alumno le devolvia su propia fila y nada mas. Sin error: RLS filtra, no falla.
--
-- El dueño lo veia bien, que es por lo que sobrevivio hasta produccion.
--
-- La respuesta no es abrir `inscripciones`. Es que el directorio deje de
-- pedirla y pida solo lo que enseña: nombre, foto, biografia y puntos.

-- Primero, `cubre_curso` para CUALQUIER usuario y no solo para quien pregunta.
--
-- El directorio necesita saber si acceden OTROS, y `cubre_curso` solo sabia
-- responder por `auth.uid()`. La tentacion es copiar su cuerpo aqui con otro
-- id --- y copiarlo es exactamente lo que dejo cuatro caminos abiertos cuando
-- se arreglo la suspension. Asi que se generaliza y `cubre_curso` pasa a ser
-- una linea que llama a esta. Un solo cuerpo: lo que se arregle aqui queda
-- arreglado en los dos sitios.
create or replace function privado.cubre_curso_de(p_usuario uuid, p_curso uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.inscripciones i
    join public.cursos c on c.comunidad_id = i.comunidad_id
    join public.comunidades com on com.id = c.comunidad_id
    left join public.inscripcion_cursos ic
      on ic.inscripcion_id = i.id and ic.curso_id = c.id
    where i.usuario_id = p_usuario
      and c.id = p_curso
      and i.estado = 'activo'
      and com.estado = 'activa'
      and c.publicado
      and (i.todos_los_cursos or ic.curso_id is not null)
  );
$$;

create or replace function privado.cubre_curso(p_curso uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select privado.cubre_curso_de(auth.uid(), p_curso);
$$;

grant execute on all functions in schema privado to authenticated;

-- El directorio.
--
-- Devuelve un conjunto fijo de columnas, y ahi esta la gracia: NO lleva el
-- correo, ni el estado, ni que modulos tiene contratado cada cual. No hay forma
-- de pedirle esos campos porque no los tiene. Es el mismo patron que
-- `marca_publica` y `progreso_de_mis_alumnos` --- exponer la pregunta concreta
-- en vez de abrir la tabla.
--
-- Quien pregunta tiene que tener acceso al modulo. Sin esa condicion, un alumno
-- de otra academia listaria a los de esta poniendo un id a mano: la funcion es
-- `security definer` y se salta RLS, asi que la puerta la tiene que poner ella.
--
-- Se lista a quien tiene acceso ACTIVO. Un suspendido desaparece del directorio
-- igual que desaparece del contenido, sin que esta funcion tenga que acordarse:
-- se lo pregunta al resolver.
-- `drop` antes del `create`: `create or replace` se niega a cambiar el tipo de
-- retorno de una funcion que ya existe, y anadir una columna lo cambia. Sin
-- esto, la migracion falla en cualquier base donde ya se hubiera aplicado una
-- version anterior.
drop function if exists public.miembros_del_curso(uuid);

create function public.miembros_del_curso(p_curso uuid)
returns table (
  usuario_id uuid,
  nombre     text,
  -- La parte de delante de la arroba, NO el correo.
  --
  -- Una cuenta recien invitada tiene el nombre en blanco, y sin esto sale una
  -- tarjeta sin nombre que parece un fallo de carga. El respaldo lo decide
  -- `nombreVisible` en el cliente --- aqui solo se le da con que.
  --
  -- Entero seria un correo suelto en un directorio que ve cualquier compañero
  -- de clase. Partido es reconocible sin ser contactable.
  alias      text,
  avatar_url text,
  bio        text,
  puntos     integer,
  creado_el  timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre, split_part(p.email, '@', 1),
         p.avatar_url, p.bio, p.puntos, p.creado_el
  from public.cursos c
  join public.inscripciones i on i.comunidad_id = c.comunidad_id
  join public.perfiles p on p.id = i.usuario_id
  where c.id = p_curso
    and privado.cubre_curso_de(i.usuario_id, p_curso)
    and (
      -- La puerta: o eres alumno del modulo, o mandas en la academia.
      privado.cubre_curso(p_curso)
      or privado.es_propietario_de(c.comunidad_id)
      or privado.es_superadmin()
    )
  order by p.puntos desc, p.nombre;
$$;

revoke all on function public.miembros_del_curso(uuid) from public, anon;
grant execute on function public.miembros_del_curso(uuid) to authenticated;
