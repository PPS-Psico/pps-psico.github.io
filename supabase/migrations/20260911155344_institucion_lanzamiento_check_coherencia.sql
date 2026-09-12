-- El trigger sincroniza, pero razonar sobre sus ramas no es una garantia. Esto
-- lo es: mientras convivan las dos columnas, en reposo no pueden discrepar.
-- Los datos actuales ya la cumplen (cero discrepancias verificadas).
alter table public.lanzamientos_pps
  add constraint lanzamientos_pps_institucion_coherente
  check (institucion_id is not distinct from institucion_uuid::text);
