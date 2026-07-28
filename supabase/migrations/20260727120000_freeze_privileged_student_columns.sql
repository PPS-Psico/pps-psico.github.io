-- Corta la escalada de privilegios.
--
-- Problema: la política "Editar perfil propio" permite a un alumno hacer UPDATE
-- de su propia fila de `estudiantes` sin restringir COLUMNAS, y `is_admin()`
-- decide en base a `estudiantes.role`. Un alumno podía hacer
--   update estudiantes set role = 'SuperUser' where user_id = auth.uid()
-- y quedar con permisos de coordinación en las ~73 políticas que usan is_admin().
--
-- Solución: trigger que congela las columnas privilegiadas para quien no es
-- admin. Mismo patrón que `check_practica_updates`, ya presente en el proyecto.
--
-- Excepciones deliberadas (cada una tiene un motivo verificado):
--  - auth.uid() IS NULL → migraciones, cron y service_role siguen operando.
--  - is_admin()         → coordinación sigue editando todo.
--  - user_id NULL → auth.uid(): es la vinculación de cuenta legítima que hace
--    `register_new_student`, que corre SECURITY DEFINER pero con el alumno YA
--    autenticado (exige auth.uid() = userid_input). Sin esta excepción se rompe
--    el alta de alumnos. Re-apuntar un user_id ya asignado sigue bloqueado.

create or replace function public.freeze_privileged_student_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then
    return new;
  end if;

  new.role := old.role;
  new.legajo := old.legajo;

  -- Vinculación inicial de cuenta: permitida. Cualquier otro cambio de user_id
  -- (incluido apropiarse de otra fila) se descarta.
  if not (old.user_id is null and new.user_id = (select auth.uid())) then
    new.user_id := old.user_id;
  end if;

  return new;
end;
$$;

comment on function public.freeze_privileged_student_columns() is
  'Impide que un alumno modifique role/legajo/user_id de su propia fila. is_admin() depende de role, por lo que sin esto hay auto-elevación a SuperUser.';

-- Las funciones nacen con EXECUTE para PUBLIC. Es una función de trigger (fuera
-- de un trigger sólo puede fallar), pero no hay motivo para dejarla expuesta.
revoke execute on function public.freeze_privileged_student_columns() from public, anon, authenticated;

drop trigger if exists trg_freeze_privileged_student_columns on public.estudiantes;
create trigger trg_freeze_privileged_student_columns
before update on public.estudiantes
for each row
execute function public.freeze_privileged_student_columns();

-- Defensa en profundidad: `anon` no tiene ningún flujo legítimo de escritura
-- sobre estas tablas (las altas van por funciones SECURITY DEFINER). Hasta
-- ahora la RLS era la ÚNICA barrera; si una política falla, no había red abajo.
revoke insert, update, delete on public.estudiantes from anon;
revoke insert, update, delete on public.practicas from anon;
revoke insert, update, delete on public.convocatorias from anon;
