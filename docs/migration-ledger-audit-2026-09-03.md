# Auditoría del ledger de migraciones — 2026-09-03

Proyecto Supabase: `qxnxtnhtbpsgzprqtrjl`.

Esta es una fotografía fechada del repositorio y del ledger productivo. No es un
conteo permanente ni autoriza a renombrar, borrar, reparar o reaplicar
migraciones. Durante la auditoría no se ejecutó DDL ni DML.

## Resultado ejecutivo

| Indicador                                                       | Cantidad |
| --------------------------------------------------------------- | -------: |
| Archivos locales                                                |      258 |
| Archivos locales rastreados por Git                             |      248 |
| Archivos locales sin seguimiento                                |       10 |
| Entradas remotas                                                |      256 |
| Coincidencias exactas `version:name`                            |      176 |
| Mismo nombre, timestamp diferente                               |       76 |
| SQL equivalente sin comentarios de línea entre esas diferencias |       71 |
| Nombres solo locales                                            |        6 |
| Nombres solo remotos                                            |        4 |

Conclusión: el historial local sigue siendo reproducible, pero no representa
literalmente las claves del ledger alojado. Las diferencias anteriores a esta
fecha deben conservarse como historia aplicada. La reconciliación correcta es
documentarlas y comparar contenido, no modificar las versiones productivas.

## Método

1. Se leyó `supabase_migrations.schema_migrations` desde la base viva.
2. Se extrajo `version`, `name` y un MD5 del SQL normalizado, omitiendo
   comentarios `--` y diferencias de whitespace.
3. Se enumeraron los archivos `supabase/migrations/*.sql` y el índice de Git.
4. Se compararon clave exacta, nombre y hash. Un hash coincidente es evidencia
   de equivalencia textual normalizada; un hash diferente exige revisión y no
   demuestra por sí solo una diferencia semántica.

## Archivos locales sin seguimiento

| Archivo                                                      | Estado frente al ledger |
| ------------------------------------------------------------ | ----------------------- |
| `20260903000000_speed_up_sweep_catalog.sql`                  | Clave exacta en remoto  |
| `20260903001500_window_only_prior_year_tasks.sql`            | Clave exacta en remoto  |
| `20260903010000_drain_unread_tasks_in_one_sweep.sql`         | Clave exacta en remoto  |
| `20260903020000_link_task_mismatch_safe_cases.sql`           | Clave exacta en remoto  |
| `20260903030000_close_reviewed_task_mismatch_cases.sql`      | Clave exacta en remoto  |
| `20260903120000_dedupe_repeated_practicas.sql`               | Solo local              |
| `20260903121500_relink_linares_lara_barriletes_cohort.sql`   | Solo local              |
| `20260903130000_dedupe_all_and_relink_lara.sql`              | Solo local              |
| `20260903201021_special_pps_research_project.sql`            | Clave exacta en remoto  |
| `20260903201500_register_research_task_and_assign_petit.sql` | Clave exacta en remoto  |

Estos archivos pertenecen a trabajo concurrente. No se agregaron al índice, no
se renombraron y no se aplicaron desde esta tarea.

## Mismo nombre con timestamp diferente

| Nombre                                                               |  Versión local | Versión remota | SQL normalizado                                                 |
| -------------------------------------------------------------------- | -------------: | -------------: | --------------------------------------------------------------- |
| `harden_pps_reenrollment_and_atomic_withdrawal`                      | 20260805143611 | 20260805144037 | Equivalente                                                     |
| `create_practice_on_direct_selection_insert`                         | 20260805150116 | 20260805150142 | Equivalente                                                     |
| `normalize_legacy_practice_names_for_reenrollment`                   | 20260805150826 | 20260805150855 | Equivalente                                                     |
| `harden_consent_timeout_terminal_practices`                          | 20260805153842 | 20260805151510 | Equivalente                                                     |
| `harden_consentimiento_contract`                                     | 20260807111146 | 20260807112709 | Equivalente                                                     |
| `restrict_consent_counts_to_staff`                                   | 20260807113852 | 20260807113934 | Equivalente                                                     |
| `add_final_consent_reminder`                                         | 20260807153000 | 20260807140718 | Revisión manual                                                 |
| `restrict_final_consent_reminder_rpcs`                               | 20260807154500 | 20260807141104 | Equivalente                                                     |
| `create_moodle_task_catalog_and_links`                               | 20260810170000 | 20260810143739 | Equivalente                                                     |
| `create_moodle_grade_observations`                                   | 20260810171000 | 20260810171157 | Equivalente                                                     |
| `harden_student_practice_grade_writes`                               | 20260810172000 | 20260810171159 | Equivalente                                                     |
| `create_moodle_grade_discrepancy_report`                             | 20260810173000 | 20260810172558 | Equivalente                                                     |
| `harden_moodle_grade_database_advisors`                              | 20260810174000 | 20260810172920 | Equivalente                                                     |
| `harden_student_practice_deletes`                                    | 20260810224845 | 20260810231141 | Equivalente                                                     |
| `repair_all_moodle_linkages_2024_2026`                               | 20260811114411 | 20260811115106 | Equivalente                                                     |
| `repair_remaining_deterministic_practice_links`                      | 20260811115316 | 20260811115411 | Equivalente                                                     |
| `complete_legacy_moodle_practice_links`                              | 20260811120500 | 20260811120245 | Equivalente                                                     |
| `repair_assigned_practice_orientation`                               | 20260811121500 | 20260811120546 | Equivalente                                                     |
| `prioritize_explicit_moodle_task_urls`                               | 20260811122500 | 20260811120927 | Equivalente                                                     |
| `index_practica_moodle_tareas`                                       | 20260811123000 | 20260811121439 | Equivalente                                                     |
| `support_direct_moodle_grade_observations`                           | 20260811125018 | 20260811125515 | Equivalente                                                     |
| `require_moodle_pps_for_student_signup`                              | 20260811130614 | 20260811132340 | Equivalente                                                     |
| `apply_moodle_grades_automatically`                                  | 20260811133357 | 20260811133801 | Equivalente                                                     |
| `index_moodle_grade_applications_student`                            | 20260811135056 | 20260811135112 | Equivalente                                                     |
| `preserve_moodle_grade_progress`                                     | 20260811164546 | 20260811165154 | Equivalente                                                     |
| `moodle_grade_workflow_v2`                                           | 20260812113644 | 20260812114158 | Revisión manual                                                 |
| `moodle_grade_bulk_reconciliation`                                   | 20260812115431 | 20260812115457 | Equivalente                                                     |
| `index_moodle_workflow_foreign_keys`                                 | 20260812120656 | 20260812120723 | Equivalente                                                     |
| `reconcile_moodle_discrepancy_scale`                                 | 20260812121806 | 20260812121907 | Equivalente                                                     |
| `harden_finalization_grade_resolution`                               | 20260812122235 | 20260812122322 | Equivalente                                                     |
| `require_complete_finalization_grade_average`                        | 20260812122357 | 20260812122438 | Revisión manual                                                 |
| `support_multi_option_launches`                                      | 20260812160113 | 20260812160727 | Equivalente                                                     |
| `add_option_schedule_capacities`                                     | 20260813113000 | 20260813120845 | Revisión manual                                                 |
| `sync_launch_capacity_from_option_schedules`                         | 20260813124500 | 20260813122146 | Equivalente                                                     |
| `jefe_area_panel_v1`                                                 | 20260817003033 | 20260817003348 | Equivalente                                                     |
| `restrict_jefe_private_helpers`                                      | 20260817005151 | 20260817005208 | Equivalente                                                     |
| `allow_jefe_panel_grade_source`                                      | 20260817011500 | 20260817010239 | Equivalente                                                     |
| `include_en_proceso_in_jefe_snapshot`                                | 20260817012500 | 20260817010847 | Equivalente                                                     |
| `jefe_moodle_zero_touch_login`                                       | 20260817012759 | 20260817013222 | Equivalente                                                     |
| `add_jefe_readonly_preview`                                          | 20260817014755 | 20260817015413 | Equivalente                                                     |
| `harden_jefe_preview_identity`                                       | 20260817020239 | 20260817020358 | Equivalente                                                     |
| `archive_stale_jefe_reports`                                         | 20260817033000 | 20260817135837 | Equivalente                                                     |
| `testable_jefe_report_boundary`                                      | 20260817035000 | 20260817141007 | Equivalente                                                     |
| `repair_online_practice_classification`                              | 20260818161348 | 20260818161826 | Equivalente                                                     |
| `repair_multi_option_schedule_encoding`                              | 20260819130750 | 20260819131224 | Equivalente                                                     |
| `merge_duplicate_fernando_ulloa_admission_interviews`                | 20260819152557 | 20260819152724 | Equivalente                                                     |
| `use_real_moodle_submission_dates_for_jefe_reports`                  | 20260819230405 | 20260819231134 | Equivalente                                                     |
| `sync_jefe_area_moodle_tasks_by_year`                                | 20260819232841 | 20260819233638 | Equivalente                                                     |
| `include_all_year_area_tasks_in_jefe_sync`                           | 20260819234041 | 20260819234114 | Equivalente                                                     |
| `make_jefe_moodle_sync_wrappers_invoker`                             | 20260819234455 | 20260819234537 | Equivalente                                                     |
| `backfill_santiago_ifd_submission_date`                              | 20260819235040 | 20260819235102 | Equivalente                                                     |
| `enable_jefe_moodle_sync_in_admin_preview`                           | 20260820001332 | 20260820002035 | Equivalente                                                     |
| `create_moodle_task_intents_and_participants`                        | 20260820100000 | 20260820134410 | Equivalente                                                     |
| `backfill_legacy_moodle_task_intents`                                | 20260820101000 | 20260820134417 | Equivalente                                                     |
| `harden_moodle_v2_advisors`                                          | 20260820110500 | 20260820140301 | Equivalente                                                     |
| `fix_null_grade_revision_on_first_moodle_application`                | 20260821123000 | 20260821122043 | Equivalente                                                     |
| `fix_conversion_mode_sanatorio_juan_xxiii_cpavzo`                    | 20260821143000 | 20260821130406 | Equivalente                                                     |
| `informe_sla_weekly_digest`                                          | 20260821150000 | 20260821131612 | Equivale a remoto `20260821131816_informe_sla_weekly_digest_v2` |
| `jefe_sync_include_prior_year_open_submissions`                      | 20260821160000 | 20260821143221 | Equivalente                                                     |
| `add_student_pps_withdrawal_requests`                                | 20260826122255 | 20260826122637 | Equivalente                                                     |
| `add_pps_withdrawal_resolver_index`                                  | 20260826125125 | 20260826125139 | Equivalente                                                     |
| `assign_special_pps_tasks`                                           | 20260827122009 | 20260827155403 | Equivalente                                                     |
| `index_special_pps_task_catalog_aula_entrega`                        | 20260827155849 | 20260827155859 | Equivalente                                                     |
| `allow_service_role_special_pps_audit`                               | 20260827155947 | 20260827160011 | Equivalente                                                     |
| `fix_special_pps_cancellation_state`                                 | 20260827160100 | 20260827160124 | Equivalente                                                     |
| `register_2026_interview_tasks_clinical_educational`                 | 20260827161753 | 20260827161832 | Equivalente                                                     |
| `add_moodle_submission_evidence`                                     | 20260827200000 | 20260827234830 | Equivalente                                                     |
| `create_hybrid_accreditation_transition`                             | 20260827201000 | 20260828000044 | Equivalente                                                     |
| `guard_hybrid_finalization_origin`                                   | 20260827202000 | 20260828001553 | Equivalente                                                     |
| `fix_accreditation_report_null_guard`                                | 20260828114200 | 20260828114304 | Equivalente                                                     |
| `audit_jefe_unmatched_and_shadow_paths`                              | 20260829135459 | 20260829140134 | Equivalente                                                     |
| `resolve_safe_jefe_moodle_links`                                     | 20260829145002 | 20260829145615 | Equivalente                                                     |
| `management_report_v1`                                               | 20260831225929 | 20260831230147 | Equivalente                                                     |
| `management_report_include_2024_agreements_and_account_availability` | 20260831234934 | 20260831235618 | Equivalente                                                     |
| `management_report_group_institutions_and_access`                    | 20260901002317 | 20260901105136 | Equivalente                                                     |
| `management_report_pending_application_distribution`                 | 20260901110028 | 20260901110533 | Equivalente                                                     |

Las 71 filas marcadas como equivalentes difieren en timestamp
pero conservan el mismo SQL sin comentarios de línea. Sus nombres de archivo no
deben cambiarse retroactivamente.

## Nombres presentes solo de un lado

### Solo local

| Archivo local                                                  | Seguimiento     | Correspondencia por SQL                                       |
| -------------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `20260807160000_reset_final_reminder_on_reselection.sql`       | Rastreado       | `20260807141821_reset_final_consent_reminder_on_reselection`  |
| `20260821140000_add_cmid_and_year_to_grade_discrepancies.sql`  | Rastreado       | `20260821123428_add_cmid_and_year_to_grade_discrepancies_v2`  |
| `20260821153000_resolve_jefe_sync_ambiguity_by_precedence.sql` | Rastreado       | `20260821134841_resolve_jefe_sync_ambiguity_by_precedence_v2` |
| `20260903120000_dedupe_repeated_practicas.sql`                 | Sin seguimiento | No encontrada                                                 |
| `20260903121500_relink_linares_lara_barriletes_cohort.sql`     | Sin seguimiento | No encontrada                                                 |
| `20260903130000_dedupe_all_and_relink_lara.sql`                | Sin seguimiento | No encontrada                                                 |

### Solo remoto

| Entrada remota                                                | Correspondencia local por SQL                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `20260807141821_reset_final_consent_reminder_on_reselection`  | `20260807160000_reset_final_reminder_on_reselection.sql`       |
| `20260821123428_add_cmid_and_year_to_grade_discrepancies_v2`  | `20260821140000_add_cmid_and_year_to_grade_discrepancies.sql`  |
| `20260821131816_informe_sla_weekly_digest_v2`                 | `20260821150000_informe_sla_weekly_digest.sql`                 |
| `20260821134841_resolve_jefe_sync_ambiguity_by_precedence_v2` | `20260821153000_resolve_jefe_sync_ambiguity_by_precedence.sql` |

Las correspondencias por hash explican cambios históricos de nombre sin alterar
el ledger. Las entradas sin correspondencia requieren decidir si son
migraciones nuevas todavía no aplicadas, variantes reemplazadas o evidencia que
debe recuperarse desde producción.

## Excepciones que requieren revisión humana

Las filas `Revisión manual` no se resolvieron por semejanza de nombre. En la
muestra actual incluyen diferencias conocidas de codificación UTF-8, formato o
contenido acumulado para replay. Antes de cambiar un archivo hay que contrastar
la definición viva del objeto afectado y conservar el SQL remoto como evidencia
si fuese necesario.

## Protocolo canónico desde esta fecha

- Consultar el ledger vivo antes de clasificar una migración.
- Crear migraciones nuevas con una versión nueva; nunca reutilizar una versión.
- Aplicar cada cambio una sola vez y regenerar `src/types/supabase.ts` después
  de cualquier cambio real de schema.
- No usar `migration repair`, `db push` ni renombrar archivos históricos para
  forzar coincidencia visual.
- Ejecutar `npm run check:migrations` en cada integración y el replay aislado
  cuando Docker esté disponible.
- Registrar futuras divergencias en una nueva sección fechada; no sobrescribir
  esta fotografía.
