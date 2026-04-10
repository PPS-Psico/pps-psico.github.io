-- Remove stray security definer functions copied from the unrelated "pareja" project.
-- These functions reference tables that do not exist in this PPS database.

drop function if exists public.get_coin_history(uuid);
drop function if exists public.get_expense_stats_by_category(uuid);
drop function if exists public.get_member_activity_stats(uuid);
drop function if exists public.get_task_stats_by_category(uuid);
drop function if exists public.get_weekly_task_summary(uuid);
drop function if exists public.get_xp_history(uuid);
