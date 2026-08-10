-- La nota académica deja de ser un dato autodeclarado por el estudiante.
-- Las sesiones estudiantiles conservan únicamente la corrección de fecha de cierre;
-- coordinación y service_role mantienen los flujos administrativos existentes.

create or replace function public.check_practica_updates()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then
    return new;
  end if;

  if (to_jsonb(new) - 'fecha_finalizacion')
     is distinct from
     (to_jsonb(old) - 'fecha_finalizacion') then
    raise exception 'Los datos académicos de la PPS sólo pueden ser modificados por coordinación.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.check_practica_updates() is
  'Fail-closed para estudiantes: sólo permite modificar fecha_finalizacion. Nota y columnas presentes o futuras quedan reservadas a coordinación.';

create or replace function public.strip_student_declared_finalization_grades()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  sanitized_items jsonb;
begin
  if (select auth.uid()) is null or (select public.is_admin()) then
    return new;
  end if;

  if jsonb_typeof(new.detalle_practicas -> 'items') = 'array' then
    select coalesce(
      jsonb_agg((item - 'nota') || jsonb_build_object('nota', '')),
      '[]'::jsonb
    )
    into sanitized_items
    from jsonb_array_elements(new.detalle_practicas -> 'items') as item;

    new.detalle_practicas := jsonb_set(
      jsonb_set(new.detalle_practicas, '{items}', sanitized_items, true),
      '{notaPromedio}',
      'null'::jsonb,
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists strip_student_declared_finalization_grades_trigger
  on public.finalizacion_pps;
create trigger strip_student_declared_finalization_grades_trigger
before insert or update of detalle_practicas on public.finalizacion_pps
for each row execute function public.strip_student_declared_finalization_grades();

comment on function public.strip_student_declared_finalization_grades() is
  'Elimina nota y promedio autodeclarados de nuevas solicitudes estudiantiles. Administración conserva el dato legacy existente para conciliación.';
