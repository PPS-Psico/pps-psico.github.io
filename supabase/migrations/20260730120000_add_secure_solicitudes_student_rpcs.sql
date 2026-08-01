-- SOL-01A: caminos aditivos y seguros para lecturas y altas estudiantiles.
-- No retira políticas legacy ni modifica consumidores; eso corresponde a SOL-01B.

begin;
create or replace function public.get_my_solicitudes_ingreso_v1()
returns table (
  id uuid,
  nombre_institucion text,
  estado_seguimiento text,
  actualizacion text,
  created_at timestamptz,
  localidad text,
  direccion_completa text,
  email_institucion text,
  telefono_institucion text,
  referente_institucion text,
  convenio_uflo text,
  tutor_disponible text,
  contacto_tutor text,
  tipo_practica text,
  descripcion_institucion text,
  orientacion_sugerida text,
  motivo_no_concrecion text,
  motivo_no_concrecion_detalle text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.nombre_institucion,
    s.estado_seguimiento,
    s.actualizacion,
    s.created_at,
    s.localidad,
    s.direccion_completa,
    s.email_institucion,
    s.telefono_institucion,
    s.referente_institucion,
    s.convenio_uflo,
    s.tutor_disponible,
    s.contacto_tutor,
    s.tipo_practica,
    s.descripcion_institucion,
    s.orientacion_sugerida,
    s.motivo_no_concrecion,
    s.motivo_no_concrecion_detalle
  from public.solicitudes_pps as s
  where s.estudiante_id = (
    select case
      when count(*) = 1 then (array_agg(e.id order by e.id))[1]
      else null
    end
    from public.estudiantes as e
    where e.user_id = (select auth.uid())
  )
  order by s.created_at desc nulls last, s.id;
$$;
create or replace function public.create_my_solicitud_ingreso_v1(
  p_nombre_institucion text,
  p_localidad text default null,
  p_direccion_completa text default null,
  p_email_institucion text default null,
  p_telefono_institucion text default null,
  p_referente_institucion text default null,
  p_convenio_uflo text default null,
  p_tutor_disponible text default null,
  p_contacto_tutor text default null,
  p_tipo_practica text default null,
  p_descripcion_institucion text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.estudiantes%rowtype;
  v_solicitud_id uuid;
begin
  select e.*
  into v_student
  from public.estudiantes as e
  where e.id = (
    select case
      when count(*) = 1 then (array_agg(candidate.id order by candidate.id))[1]
      else null
    end
    from public.estudiantes as candidate
    where candidate.user_id = (select auth.uid())
  );

  if v_student.id is null then
    raise exception 'No se pudo identificar al estudiante autenticado.'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_nombre_institucion, '')), '') is null then
    raise exception 'El nombre de la institución es obligatorio.'
      using errcode = '22023';
  end if;

  insert into public.solicitudes_pps (
    estudiante_id,
    nombre_alumno,
    legajo,
    email,
    nombre_institucion,
    localidad,
    direccion_completa,
    email_institucion,
    telefono_institucion,
    referente_institucion,
    convenio_uflo,
    tutor_disponible,
    contacto_tutor,
    tipo_practica,
    descripcion_institucion,
    estado_seguimiento,
    actualizacion,
    notas,
    motivo_no_concrecion,
    motivo_no_concrecion_detalle
  )
  values (
    v_student.id,
    v_student.nombre,
    v_student.legajo,
    v_student.correo,
    btrim(p_nombre_institucion),
    nullif(btrim(coalesce(p_localidad, '')), ''),
    nullif(btrim(coalesce(p_direccion_completa, '')), ''),
    nullif(btrim(coalesce(p_email_institucion, '')), ''),
    nullif(btrim(coalesce(p_telefono_institucion, '')), ''),
    nullif(btrim(coalesce(p_referente_institucion, '')), ''),
    nullif(btrim(coalesce(p_convenio_uflo, '')), ''),
    nullif(btrim(coalesce(p_tutor_disponible, '')), ''),
    nullif(btrim(coalesce(p_contacto_tutor, '')), ''),
    nullif(btrim(coalesce(p_tipo_practica, '')), ''),
    nullif(btrim(coalesce(p_descripcion_institucion, '')), ''),
    'Pendiente',
    pg_catalog.to_char(current_date, 'YYYY-MM-DD'),
    null,
    null,
    null
  )
  returning solicitudes_pps.id into v_solicitud_id;

  return v_solicitud_id;
end;
$$;
create or replace function public.get_my_solicitudes_modificacion_v1()
returns table (
  id uuid,
  practica_id uuid,
  tipo_modificacion text,
  horas_nuevas integer,
  planilla_asistencia_url text,
  estado text,
  comentario_rechazo text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.practica_id,
    s.tipo_modificacion::text,
    s.horas_nuevas,
    s.planilla_asistencia_url,
    s.estado::text,
    s.comentario_rechazo,
    s.created_at,
    s.updated_at
  from public.solicitudes_modificacion_pps as s
  where s.estudiante_id = (
    select case
      when count(*) = 1 then (array_agg(e.id order by e.id))[1]
      else null
    end
    from public.estudiantes as e
    where e.user_id = (select auth.uid())
  )
  order by s.created_at desc nulls last, s.id;
$$;
create or replace function public.create_my_solicitud_modificacion_v1(
  p_practica_id uuid,
  p_tipo_modificacion text,
  p_horas_nuevas integer default null,
  p_planilla_asistencia_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_solicitud_id uuid;
begin
  select e.id
  into v_student_id
  from public.estudiantes as e
  where e.id = (
    select case
      when count(*) = 1 then (array_agg(candidate.id order by candidate.id))[1]
      else null
    end
    from public.estudiantes as candidate
    where candidate.user_id = (select auth.uid())
  );

  if v_student_id is null then
    raise exception 'No se pudo identificar al estudiante autenticado.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.practicas as p
    where p.id = p_practica_id
      and p.estudiante_id = v_student_id
  ) then
    raise exception 'La práctica no pertenece al estudiante autenticado.'
      using errcode = '42501';
  end if;

  if p_tipo_modificacion is null
    or p_tipo_modificacion not in ('horas', 'eliminacion')
  then
    raise exception 'El tipo de modificación no es válido.'
      using errcode = '22023';
  end if;

  if p_tipo_modificacion = 'horas'
    and (p_horas_nuevas is null or p_horas_nuevas < 1 or p_horas_nuevas > 120)
  then
    raise exception 'La cantidad de horas debe estar entre 1 y 120.'
      using errcode = '22023';
  end if;

  if p_tipo_modificacion = 'eliminacion' and p_horas_nuevas is not null then
    raise exception 'Una solicitud de eliminación no admite horas nuevas.'
      using errcode = '22023';
  end if;

  insert into public.solicitudes_modificacion_pps (
    estudiante_id,
    practica_id,
    tipo_modificacion,
    horas_nuevas,
    planilla_asistencia_url,
    estado,
    comentario_rechazo,
    notas_admin
  )
  values (
    v_student_id,
    p_practica_id,
    p_tipo_modificacion,
    p_horas_nuevas,
    nullif(btrim(coalesce(p_planilla_asistencia_url, '')), ''),
    'pendiente',
    null,
    null
  )
  returning solicitudes_modificacion_pps.id into v_solicitud_id;

  return v_solicitud_id;
end;
$$;
create or replace function public.get_my_solicitudes_nueva_pps_v1()
returns table (
  id uuid,
  institucion_id uuid,
  nombre_institucion_manual text,
  orientacion text,
  fecha_inicio date,
  fecha_finalizacion date,
  horas_estimadas integer,
  planilla_asistencia_url text,
  informe_final_url text,
  es_online boolean,
  estado text,
  comentario_rechazo text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.institucion_id,
    s.nombre_institucion_manual,
    s.orientacion::text,
    s.fecha_inicio,
    s.fecha_finalizacion,
    s.horas_estimadas,
    s.planilla_asistencia_url,
    s.informe_final_url,
    s.es_online,
    s.estado::text,
    s.comentario_rechazo,
    s.created_at,
    s.updated_at
  from public.solicitudes_nueva_pps as s
  where s.estudiante_id = (
    select case
      when count(*) = 1 then (array_agg(e.id order by e.id))[1]
      else null
    end
    from public.estudiantes as e
    where e.user_id = (select auth.uid())
  )
  order by s.created_at desc nulls last, s.id;
$$;
create or replace function public.create_my_solicitud_nueva_pps_v1(
  p_institucion_id uuid,
  p_nombre_institucion_manual text,
  p_orientacion text,
  p_fecha_inicio date,
  p_fecha_finalizacion date,
  p_horas_estimadas integer,
  p_planilla_asistencia_url text,
  p_informe_final_url text,
  p_es_online boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_nombre_manual text;
  v_solicitud_id uuid;
begin
  select e.id
  into v_student_id
  from public.estudiantes as e
  where e.id = (
    select case
      when count(*) = 1 then (array_agg(candidate.id order by candidate.id))[1]
      else null
    end
    from public.estudiantes as candidate
    where candidate.user_id = (select auth.uid())
  );

  if v_student_id is null then
    raise exception 'No se pudo identificar al estudiante autenticado.'
      using errcode = '42501';
  end if;

  v_nombre_manual := nullif(btrim(coalesce(p_nombre_institucion_manual, '')), '');

  if p_institucion_id is null and v_nombre_manual is null then
    raise exception 'Debe indicarse una institución existente o manual.'
      using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_orientacion, '')), '') is null then
    raise exception 'La orientación es obligatoria.'
      using errcode = '22023';
  end if;

  if p_fecha_inicio is null or p_fecha_finalizacion is null then
    raise exception 'Las fechas de inicio y finalización son obligatorias.'
      using errcode = '22023';
  end if;

  if p_fecha_finalizacion < p_fecha_inicio then
    raise exception 'La fecha de finalización no puede ser anterior a la fecha de inicio.'
      using errcode = '22023';
  end if;

  if p_horas_estimadas is null or p_horas_estimadas < 1 or p_horas_estimadas > 120 then
    raise exception 'La cantidad de horas debe estar entre 1 y 120.'
      using errcode = '22023';
  end if;

  insert into public.solicitudes_nueva_pps (
    estudiante_id,
    institucion_id,
    nombre_institucion_manual,
    orientacion,
    fecha_inicio,
    fecha_finalizacion,
    horas_estimadas,
    planilla_asistencia_url,
    informe_final_url,
    es_online,
    estado,
    comentario_rechazo,
    notas_admin
  )
  values (
    v_student_id,
    p_institucion_id,
    v_nombre_manual,
    btrim(p_orientacion),
    p_fecha_inicio,
    p_fecha_finalizacion,
    p_horas_estimadas,
    nullif(btrim(coalesce(p_planilla_asistencia_url, '')), ''),
    coalesce(p_informe_final_url, ''),
    coalesce(p_es_online, false),
    'pendiente',
    null,
    null
  )
  returning solicitudes_nueva_pps.id into v_solicitud_id;

  return v_solicitud_id;
end;
$$;
alter function public.get_my_solicitudes_ingreso_v1() owner to postgres;
alter function public.create_my_solicitud_ingreso_v1(text, text, text, text, text, text, text, text, text, text, text) owner to postgres;
alter function public.get_my_solicitudes_modificacion_v1() owner to postgres;
alter function public.create_my_solicitud_modificacion_v1(uuid, text, integer, text) owner to postgres;
alter function public.get_my_solicitudes_nueva_pps_v1() owner to postgres;
alter function public.create_my_solicitud_nueva_pps_v1(uuid, text, text, date, date, integer, text, text, boolean) owner to postgres;
comment on function public.get_my_solicitudes_ingreso_v1() is
  'Solicitudes de ingreso del estudiante autenticado sin PII duplicada ni notas internas.';
comment on function public.create_my_solicitud_ingreso_v1(text, text, text, text, text, text, text, text, text, text, text) is
  'Crea una solicitud de ingreso pendiente y deriva la identidad desde auth.uid().';
comment on function public.get_my_solicitudes_modificacion_v1() is
  'Solicitudes de modificación propias sin notas administrativas.';
comment on function public.create_my_solicitud_modificacion_v1(uuid, text, integer, text) is
  'Crea una modificación pendiente sólo sobre una práctica propia.';
comment on function public.get_my_solicitudes_nueva_pps_v1() is
  'Solicitudes de PPS realizada propias sin notas administrativas.';
comment on function public.create_my_solicitud_nueva_pps_v1(uuid, text, text, date, date, integer, text, text, boolean) is
  'Crea una solicitud de PPS realizada pendiente para el estudiante autenticado.';
revoke all on function public.get_my_solicitudes_ingreso_v1() from public, anon;
revoke all on function public.create_my_solicitud_ingreso_v1(text, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.get_my_solicitudes_modificacion_v1() from public, anon;
revoke all on function public.create_my_solicitud_modificacion_v1(uuid, text, integer, text) from public, anon;
revoke all on function public.get_my_solicitudes_nueva_pps_v1() from public, anon;
revoke all on function public.create_my_solicitud_nueva_pps_v1(uuid, text, text, date, date, integer, text, text, boolean) from public, anon;
grant execute on function public.get_my_solicitudes_ingreso_v1() to authenticated;
grant execute on function public.create_my_solicitud_ingreso_v1(text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_my_solicitudes_modificacion_v1() to authenticated;
grant execute on function public.create_my_solicitud_modificacion_v1(uuid, text, integer, text) to authenticated;
grant execute on function public.get_my_solicitudes_nueva_pps_v1() to authenticated;
grant execute on function public.create_my_solicitud_nueva_pps_v1(uuid, text, text, date, date, integer, text, text, boolean) to authenticated;
commit;
