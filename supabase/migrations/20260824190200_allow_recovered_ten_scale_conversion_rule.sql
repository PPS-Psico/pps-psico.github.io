begin;

-- 20260821220000_unify_moodle_grade_reading_rule.sql introdujo la regla de
-- conversion 'recovered_ten_scale' (Moodle dice "9,00 / 100,00" pero el 9 ya
-- esta en escala 0-10), pero el CHECK de moodle_grade_applications nunca la
-- admitio. El defecto quedaba tapado por el candado `scan_closed`: como el
-- trigger salia antes de insertar la auditoria, esa rama no se ejercitaba.
-- Al destrabar la aplicacion, cualquier tarea corregida con ese criterio
-- abortaria con 23514.

alter table private.moodle_grade_applications
  drop constraint if exists moodle_grade_applications_conversion_rule_check;

alter table private.moodle_grade_applications
  add constraint moodle_grade_applications_conversion_rule_check
  check (conversion_rule = any (array[
    'direct_legacy_ten_point',
    'normalized_to_ten',
    'explicit_direct_10',
    'explicit_percentage',
    'explicit_pass_fail',
    'recovered_ten_scale'
  ]));

commit;
