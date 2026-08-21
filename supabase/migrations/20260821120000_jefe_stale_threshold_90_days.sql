-- Sube el corte de "antecedente" de 60 a 90 dias fuera de plazo.
--
-- private.jefe_report_status_v1 clasifica un informe entregado como 'stale'
-- (pasa a antecedentes, fuera de la cola de pendientes) cuando su fecha limite
-- lleva mas de 60 dias vencida. Pedido explicito: subirlo a 90.
create or replace function private.jefe_report_status_v1(
  p_graded boolean, p_submitted boolean, p_deadline date, p_today date
)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_graded then 'corrected'
    when p_submitted
      and p_deadline is not null
      and p_deadline < p_today - 90
      then 'stale'
    when p_submitted then 'pending'
    else 'waiting'
  end;
$$;
