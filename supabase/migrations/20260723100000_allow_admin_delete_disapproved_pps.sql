-- Migration: Permitir la eliminación de registros de PPS desaprobadas por administradores
-- y actualizar la clave foránea en penalizaciones a ON DELETE CASCADE.

-- 1. Actualizar la función desencadenadora para permitir que la administración (is_admin()) pueda eliminar PPS desaprobadas.
create or replace function public.proteger_desaprobacion_pps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_user not in ('postgres', 'service_role')
     and not public.is_admin()
     and old.estado = 'Desaprobada' then
    raise exception 'Una PPS desaprobada sólo puede ser eliminada por administración.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and current_user not in ('postgres', 'service_role')
     and not public.is_admin()
     and (
       old.estado = 'Desaprobada'
       or new.estado = 'Desaprobada'
       or old.desaprobacion_fecha is distinct from new.desaprobacion_fecha
       or old.desaprobacion_causas is distinct from new.desaprobacion_causas
       or old.desaprobacion_motivo_publico is distinct from new.desaprobacion_motivo_publico
       or old.desaprobacion_notificado_at is distinct from new.desaprobacion_notificado_at
       or old.desaprobacion_registrado_por is distinct from new.desaprobacion_registrado_por
     ) then
    raise exception 'La desaprobación de una PPS sólo puede ser gestionada por coordinación.'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- 2. Cambiar la restricción FK en penalizaciones.practica_id a ON DELETE CASCADE para evitar errores de Foreign Key Constraint al borrar la práctica.
alter table public.penalizaciones
  drop constraint if exists penalizaciones_practica_id_fkey;

alter table public.penalizaciones
  add constraint penalizaciones_practica_id_fkey
  foreign key (practica_id)
  references public.practicas(id)
  on delete cascade;
