create index moodle_grade_applications_student_latest_idx
  on private.moodle_grade_applications (estudiante_id, source_observed_at desc);
