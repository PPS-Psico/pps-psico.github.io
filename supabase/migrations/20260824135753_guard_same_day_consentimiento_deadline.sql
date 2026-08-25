create or replace function public.consentimiento_deadline(
  p_fecha_inicio text,
  p_selected_at timestamptz,
  p_lista_entregada_at timestamptz default null
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_date date;
  v_start timestamptz;
begin
  if p_fecha_inicio is null or p_selected_at is null then
    return null;
  end if;

  if substring(trim(p_fecha_inicio) from '^\d{4}-\d{2}-\d{2}') is null then
    return null;
  end if;

  v_date := substring(trim(p_fecha_inicio) from 1 for 10)::date;
  v_start := make_timestamptz(
    extract(year from v_date)::integer,
    extract(month from v_date)::integer,
    extract(day from v_date)::integer,
    0,
    0,
    0,
    'America/Argentina/Buenos_Aires'
  );

  -- Una selección hecha cuando la PPS ya empezó nunca puede nacer vencida.
  -- Conserva 24 horas completas desde la selección.
  if p_selected_at >= v_start then
    v_start := p_selected_at + interval '24 hours';
  elsif p_selected_at <= v_start - interval '24 hours' then
    v_start := v_start - interval '24 hours';
  end if;

  if p_lista_entregada_at is not null then
    return least(v_start, p_lista_entregada_at);
  end if;

  return v_start;
exception
  when others then
    return null;
end;
$function$;

comment on function public.consentimiento_deadline(text, timestamptz, timestamptz)
is 'Calcula el cierre del consentimiento en Buenos Aires; una selección realizada desde el inicio de la PPS recibe 24 horas completas para evitar bajas inmediatas.';
