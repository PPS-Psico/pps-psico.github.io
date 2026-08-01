-- Restaura los RPC de metricas rotos al cerrar el esquema private.
-- Los clientes ejecutan solamente wrappers publicos SECURITY DEFINER;
-- el namespace y los helpers privados permanecen inaccesibles.

begin;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
alter function public.get_analytics_v2(integer, date) owner to postgres;
alter function public.get_analytics_v2(integer, date) security definer;
alter function public.get_analytics_v2(integer, date) set search_path = '';
alter function public.get_historical_launch_offer_list(integer, date) owner to postgres;
alter function public.get_historical_launch_offer_list(integer, date) security definer;
alter function public.get_historical_launch_offer_list(integer, date) set search_path = '';
alter function public.get_director_report_v1(integer, date) owner to postgres;
alter function public.get_director_report_v1(integer, date) security definer;
alter function public.get_director_report_v1(integer, date) set search_path = '';
alter function public.get_interview_completion_candidates_v1() owner to postgres;
alter function public.get_interview_completion_candidates_v1() security definer;
alter function public.get_interview_completion_candidates_v1() set search_path = '';
alter function private.get_historical_launch_metrics(integer, date) owner to postgres;
alter function private.get_historical_launch_offer_list(integer, date) owner to postgres;
alter function private.get_director_report_v1_impl(integer, date) owner to postgres;
alter function private.get_director_report_active_demand_v1_impl(integer, date) owner to postgres;
alter function private.get_interview_completion_candidates_v1_impl() owner to postgres;
revoke all on function
  private.get_historical_launch_metrics(integer, date),
  private.get_historical_launch_offer_list(integer, date),
  private.get_director_report_v1_impl(integer, date),
  private.get_director_report_active_demand_v1_impl(integer, date),
  private.get_interview_completion_candidates_v1_impl()
from public, anon, authenticated;
revoke all on function
  public.get_analytics_v2(integer, date),
  public.get_historical_launch_offer_list(integer, date),
  public.get_director_report_v1(integer, date),
  public.get_interview_completion_candidates_v1()
from public, anon;
grant execute on function
  public.get_analytics_v2(integer, date),
  public.get_historical_launch_offer_list(integer, date),
  public.get_director_report_v1(integer, date),
  public.get_interview_completion_candidates_v1()
to authenticated;
commit;
