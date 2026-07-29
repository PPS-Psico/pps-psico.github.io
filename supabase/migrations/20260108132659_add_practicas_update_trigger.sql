-- TRIGGER: Enforce column update restrictions
-- Prevents students from changing anything except 'fecha_finalizacion' (and potentially other safe fields in future).
CREATE OR REPLACE FUNCTION public.check_practica_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is admin (bypass check)
  IF (SELECT is_admin()) THEN
      RETURN NEW;
  END IF;

  -- If student, SILENTLY REVERT modification of restricted columns
  -- This handles cases where UI sends full object back without intended changes.
  NEW.estudiante_id := OLD.estudiante_id;
  NEW.lanzamiento_id := OLD.lanzamiento_id;
  NEW.estado := OLD.estado;
  NEW.tutor_evaluacion := OLD.tutor_evaluacion;
  
  -- Only 'fecha_finalizacion' (and any unlisted cols) will be accepted from NEW.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_practica_updates ON public.practicas;
CREATE TRIGGER trg_check_practica_updates
BEFORE UPDATE ON public.practicas
FOR EACH ROW EXECUTE FUNCTION public.check_practica_updates();
