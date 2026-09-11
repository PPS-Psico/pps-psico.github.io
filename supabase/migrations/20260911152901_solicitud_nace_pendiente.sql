-- Cierra la otra entrada para falsificar una resolucion: el INSERT.
--
-- Revocar el UPDATE dejo la puerta de atras abierta. Las politicas de INSERT
-- verifican de quien es la solicitud, pero no que nazca sin resolver: un
-- estudiante podia insertar directamente una fila con estado = 'aprobada',
-- horas_aprobadas y resuelta_por cargados. El default 'pendiente' no impide
-- mandar otro valor. Verificado contra la base: entra.
--
-- No acredita horas por si solo —la practica la crea la RPC— pero deja una
-- aprobacion ficticia en el legajo administrativo sin pasar por coordinacion.
--
-- Se resuelve con un trigger y no revocando el privilegio de columna porque
-- create_my_solicitud_baja_pps_v1 es `security invoker` a proposito (se apoya en
-- RLS para que el estudiante solo cree lo suyo) e inserta `estado` de forma
-- explicita: revocar la columna la romperia. Las tres RPC de creacion insertan
-- 'pendiente', asi que para ellas esto es transparente.

create or replace function private.solicitud_nueva_nace_pendiente()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if coalesce(new.estado, 'pendiente') <> 'pendiente' then
    raise exception 'Una solicitud se crea pendiente: la resolucion se escribe solo por las RPC.'
      using errcode = '42501';
  end if;

  if new.horas_aprobadas is not null
     or new.practica_id is not null
     or new.resuelta_at is not null
     or new.resuelta_por is not null
     or new.comentario_rechazo is not null then
    raise exception 'Una solicitud se crea sin datos de resolucion.'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

create or replace function private.solicitud_modificacion_nace_pendiente()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if coalesce(new.estado, 'pendiente') <> 'pendiente' then
    raise exception 'Una solicitud se crea pendiente: la resolucion se escribe solo por las RPC.'
      using errcode = '42501';
  end if;

  -- practica_id no entra: en una modificacion identifica la practica que se
  -- quiere cambiar, que es justamente lo que pide el estudiante.
  if new.horas_aprobadas is not null
     or new.resuelta_at is not null
     or new.resuelta_por is not null
     or new.comentario_rechazo is not null
     or new.penalizacion_id is not null
     or new.tipo_penalizacion_aplicada is not null
     or new.puntaje_penalizacion_aplicado is not null then
    raise exception 'Una solicitud se crea sin datos de resolucion.'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

revoke all on function private.solicitud_nueva_nace_pendiente() from public, anon, authenticated;
revoke all on function private.solicitud_modificacion_nace_pendiente() from public, anon, authenticated;

drop trigger if exists solicitud_nueva_nace_pendiente on public.solicitudes_nueva_pps;
create trigger solicitud_nueva_nace_pendiente
before insert on public.solicitudes_nueva_pps
for each row execute function private.solicitud_nueva_nace_pendiente();

drop trigger if exists solicitud_modificacion_nace_pendiente on public.solicitudes_modificacion_pps;
create trigger solicitud_modificacion_nace_pendiente
before insert on public.solicitudes_modificacion_pps
for each row execute function private.solicitud_modificacion_nace_pendiente();
