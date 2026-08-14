-- El alta desde el aula PPS deja de cotejarse contra los datos precargados del
-- padrón. Ese cruce venía del flujo anterior (precarga manual de nombre, legajo
-- y DNI que el alumno tenía que reproducir para crear su cuenta) y quedó
-- obsoleto cuando la matriculación en el curso Moodle 3615 pasó a ser el único
-- requisito: hoy Moodle es la fuente de verdad y sus datos se escriben en la
-- ficha en lugar de compararse con ella.
--
-- Con la regla vieja, toda ficha importada sin DNI o sin correo rechazaba el
-- alta con 'Student identity does not match academic record' — la excepción
-- saltaba en `v_student.dni is null`, es decir por no tener con qué comparar.
-- Eran 37 de las 76 fichas con legajo y sin cuenta al momento de este cambio
-- (caso testigo: legajo 32296, ficha con legajo y nombre pero sin DNI ni
-- correo, imposibilitada de darse de alta).
--
-- Qué se conserva: la ficha ya vinculada sigue siendo intocable (`user_id is
-- not null`), de modo que un alta nueva nunca puede apropiarse de una cuenta
-- existente ni de su historial de PPS.

create or replace function private.complete_moodle_student_signup(
  token_hash_input text,
  userid_input uuid,
  legajo_input text,
  dni_input bigint,
  telefono_input text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.moodle_signup_tickets%rowtype;
  v_student public.estudiantes%rowtype;
  v_student_id uuid;
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_legajo text;
  v_phone text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Moodle signup service required';
  end if;

  v_legajo := regexp_replace(coalesce(legajo_input, ''), '\D', '', 'g');
  v_phone := nullif(trim(coalesce(telefono_input, '')), '');

  if token_hash_input !~ '^[0-9a-f]{64}$'
    or userid_input is null
    or length(v_legajo) < 4
    or length(v_legajo) > 8
    or dni_input is null
    or dni_input < 100000
    or dni_input > 999999999
    or v_phone is null
  then
    raise exception 'Invalid Moodle signup data';
  end if;

  select ticket.*
  into v_ticket
  from public.moodle_signup_tickets ticket
  where ticket.token_hash = token_hash_input
  for update;

  if v_ticket.id is null
    or v_ticket.course_id <> 3615
    or v_ticket.used_at is not null
    or v_ticket.expires_at <= now()
    or v_ticket.moodle_username::bigint <> dni_input
  then
    raise exception 'Invalid or expired Moodle signup ticket';
  end if;

  select lower(trim(users.email)), users.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users users
  where users.id = userid_input;

  if v_auth_email is null
    or v_email_confirmed_at is null
    or v_auth_email <> v_ticket.email
  then
    raise exception 'Invalid Moodle signup identity';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('student-signup:' || v_legajo, 0)
  );

  if exists (
    select 1
    from public.estudiantes student
    where student.user_id = userid_input
  ) then
    raise exception 'Student account already linked';
  end if;

  select student.*
  into v_student
  from public.estudiantes student
  where trim(student.legajo) = v_legajo
  order by student.created_at desc nulls last
  limit 1
  for update;

  if v_student.id is not null then
    -- Única barrera que sobrevive al cruce con el padrón: una ficha que ya
    -- tiene cuenta no se puede reclamar desde un alta nueva. El mensaje se
    -- distingue del 'Student account already linked' de arriba (cuenta Auth ya
    -- usada por otra ficha) para que el alumno reciba la instrucción correcta.
    if v_student.user_id is not null then
      raise exception 'Legajo already has an account';
    end if;

    -- DNI y correo llegan verificados contra el ticket de Moodle (el DNI es el
    -- `moodle_username` y el correo es el de la cuenta Auth confirmada), así
    -- que se escriben sobre la ficha en vez de compararse con ella. El nombre
    -- del padrón se conserva cuando existe: es el nombre académico y suele
    -- estar mejor formado que el de Moodle.
    update public.estudiantes
    set
      user_id = userid_input,
      estado = case when estado is distinct from 'Finalizado' then 'Activo' else estado end,
      dni = dni_input,
      correo = v_auth_email,
      telefono = v_phone,
      must_change_password = false,
      nombre = coalesce(
        nullif(trim(nombre), ''),
        trim(concat_ws(' ', v_ticket.firstname, v_ticket.lastname))
      ),
      nombre_separado = coalesce(nullif(trim(nombre_separado), ''), v_ticket.firstname),
      apellido_separado = coalesce(nullif(trim(apellido_separado), ''), v_ticket.lastname)
    where id = v_student.id
      and user_id is null
    returning id into v_student_id;

    if v_student_id is null then
      raise exception 'Student account could not be linked';
    end if;
  else
    -- Sin ficha para ese legajo se crea una nueva. El chequeo de duplicados
    -- sigue siendo por integridad (no abrir una segunda ficha para alguien que
    -- ya figura con otro legajo), no por verificación de identidad.
    if exists (
      select 1
      from public.estudiantes student
      where student.dni = dni_input
        or lower(trim(coalesce(student.correo, ''))) = v_auth_email
    ) then
      raise exception 'Student identity already exists';
    end if;

    insert into public.estudiantes (
      legajo,
      user_id,
      dni,
      correo,
      telefono,
      nombre,
      nombre_separado,
      apellido_separado,
      estado,
      role,
      must_change_password
    ) values (
      v_legajo,
      userid_input,
      dni_input,
      v_auth_email,
      v_phone,
      trim(concat_ws(' ', v_ticket.firstname, v_ticket.lastname)),
      v_ticket.firstname,
      v_ticket.lastname,
      'Activo',
      'Alumno',
      false
    )
    returning id into v_student_id;
  end if;

  update public.moodle_signup_tickets
  set
    used_at = now(),
    auth_user_id = userid_input
  where id = v_ticket.id
    and used_at is null;

  if not found then
    raise exception 'Moodle signup ticket was already consumed';
  end if;

  return v_student_id;
end;
$$;

comment on function private.complete_moodle_student_signup(text, uuid, text, bigint, text) is
  'Consume un ticket del aula PPS 3615 y vincula la cuenta Auth. Los datos de Moodle se escriben en la ficha; no se cotejan contra el padrón.';
