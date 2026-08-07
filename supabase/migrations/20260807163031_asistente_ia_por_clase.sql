-- Asistente de IA por clase.
--
-- El creador lo enciende por clase y le da un guion. Ese guion NO entrena nada:
-- viaja con cada pregunta al modelo. Es inmediato (se edita y la siguiente
-- respuesta ya lo usa), mas barato, y mas fiel que entrenar --- el modelo tiene
-- el texto delante en vez de recordarlo a medias.
--
-- OJO: `ia_contexto` viaja dentro de `lecciones`, asi que llega al navegador de
-- cualquiera con acceso a la clase. No es material secreto --- es la
-- transcripcion de un video que ya estan viendo --- pero el editor lo advierte.
alter table public.lecciones
  add column if not exists ia_habilitada boolean not null default false,
  add column if not exists ia_contexto text;

-- El contador de preguntas.
--
-- Vive en la base y NO en el navegador: en el cliente, vaciar el almacenamiento
-- local reiniciaria el limite y el tope seria un adorno. La clave de OpenAI la
-- paga el dueno de la plataforma para TODAS las academias, asi que este contador
-- es lo unico que separa una factura previsible de una sorpresa.
create table if not exists public.uso_ia (
  usuario_id uuid not null references auth.users on delete cascade,
  dia date not null default current_date,
  preguntas integer not null default 0,
  primary key (usuario_id, dia)
);

alter table public.uso_ia enable row level security;

-- Cada cual lee lo suyo, para poder ensenarle "te quedan 12 preguntas hoy".
drop policy if exists "uso_ia: leer el propio" on public.uso_ia;
create policy "uso_ia: leer el propio"
  on public.uso_ia for select
  to authenticated
  using (usuario_id = (select auth.uid()));

-- Y NADIE escribe desde el navegador. No hay politica de insert ni de update a
-- proposito: el unico que escribe aqui es el Route Handler con la clave
-- secreta, que se salta RLS. Si hubiera politica de escritura, un alumno
-- pondria su contador a cero y preguntaria sin limite.
--
-- Esto es la excepcion a la regla del proyecto de que toda tabla necesita
-- politica de escritura: aqui la ausencia ES la proteccion, y por eso se
-- explica.

grant select on public.uso_ia to authenticated;
