-- Aplicar únicamente después de publicar el frontend que ya no consume
-- get_student_signup_status. Adelantar esta revocación rompe el alta legacy.

revoke execute on function public.get_student_signup_status(text, text)
from public, anon, authenticated;

grant execute on function public.get_student_signup_status(text, text)
to service_role;
