-- Cubre la FK usada para auditar quién resolvió cada solicitud de baja.
create index if not exists idx_solicitudes_mod_resuelta_por
  on public.solicitudes_modificacion_pps (resuelta_por)
  where resuelta_por is not null;
