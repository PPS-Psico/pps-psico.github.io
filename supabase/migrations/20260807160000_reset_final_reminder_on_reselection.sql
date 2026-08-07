-- Una nueva decisión de selección inicia un ciclo de consentimiento distinto.
-- El reset vive en la base para cubrir tanto el Lanzador como cualquier RPC o
-- proceso administrativo que cambie la selección.

create or replace function public.reset_consentimiento_final_reminder_on_reselection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado_inscripcion is distinct from old.estado_inscripcion
     or new.selected_at is distinct from old.selected_at then
    new.final_reminder_sent_at := null;
    new.final_reminder_sent_by := null;
    new.final_reminder_claimed_at := null;
    new.final_reminder_claim_token := null;
    new.final_reminder_claimed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_consentimiento_final_reminder_on_reselection
  on public.convocatorias;
create trigger reset_consentimiento_final_reminder_on_reselection
before update of estado_inscripcion, selected_at on public.convocatorias
for each row
execute function public.reset_consentimiento_final_reminder_on_reselection();
