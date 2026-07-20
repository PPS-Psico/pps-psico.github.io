-- Indices de soporte para las claves de auditoria agregadas al flujo de
-- desaprobacion institucional. Los predicados evitan indexar filas sin actor.

create index if not exists idx_practicas_desaprobacion_registrado_por
  on public.practicas (desaprobacion_registrado_por)
  where desaprobacion_registrado_por is not null;

create index if not exists idx_penalizaciones_anulada_por
  on public.penalizaciones (anulada_por)
  where anulada_por is not null;
