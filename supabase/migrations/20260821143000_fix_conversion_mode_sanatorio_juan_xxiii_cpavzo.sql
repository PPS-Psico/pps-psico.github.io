-- Auditoria de conversion_mode contra lecturas reales de Campus (2026-08-21).
-- Solo dos tareas del catalogo tenian el modo mal declarado:
--
-- #15 Sanatorio Juan XXIII (2026, laboral): declarado 'percentage' pero todas
--    las observaciones traen valor crudo 9 (docente carga nota directa en
--    campo /100). Con 'percentage' se convertia 9/100*10 = 0.9.
--
-- #24 Colegio Psicólogos CPAVZO (2026, clinica): declarado 'direct_10' pero
--    las observaciones traen porcentajes reales (60-80 sobre 100). Con
--    'direct_10' el trigger habria rechazado la nota por fuera de rango.
--
-- Ambas tareas tienen sus snapshots scan_closed, por lo que el cambio no
-- dispara reescrituras; solo corrige la proxima lectura (o reapertura).

update public.aula_entregas
set grade_conversion_mode = 'direct_10'
where id = 15
  and grade_conversion_mode = 'percentage';

update public.aula_entregas
set grade_conversion_mode = 'percentage'
where id = 24
  and grade_conversion_mode = 'direct_10';
