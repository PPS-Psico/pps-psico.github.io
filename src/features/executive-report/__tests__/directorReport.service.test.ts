import { parseDirectorReportSnapshot, testingDirectorSnapshot } from "../directorReport.service";

describe("director-report-v1", () => {
  it("transforma el contrato nominal sin exponer datos de contacto", () => {
    const parsed = parseDirectorReportSnapshot({
      metric_version: "director-report-v1",
      annual_year: 2026,
      snapshot_date: "2026-07-18",
      generated_at: "2026-07-18T12:00:00Z",
      criteria: {
        total_hours_target: 250,
        specialty_hours_target: 70,
        rotations_target: 3,
        near_total_hours_min: 230,
        near_specialty_hours_min: 50,
      },
      student_summary: {
        active_students: 1,
        students_with_pps: 1,
        without_pps: 0,
        near_completion: 1,
        near_by_reason: {
          total_hours_230_249: 1,
          missing_one_orientation: 0,
          specialty_gap_20_or_less: 0,
        },
        ready_to_request: 0,
        in_accreditation: 0,
        criteria_complete_active: 0,
      },
      without_pps_students: [],
      near_completion_students: [
        {
          student_id: "student-1",
          full_name: "Campos, Lucía",
          legajo: "33001",
          cohort: 2023,
          selected_orientation: "Clínica",
          total_hours: 240,
          specialty_hours: 70,
          rotations: 3,
          orientations: ["Clínica", "Laboral", "Educacional"],
          active_practices: 0,
          reason_code: "total_hours_230_249",
          reason_label: "Le faltan 10 horas",
          total_hours_gap: 10,
          specialty_hours_gap: 0,
          rotations_gap: 0,
          dni: "campo que el adaptador debe ignorar",
          correo: "ignorar@example.com",
        },
      ],
      ready_to_request_students: [],
      accreditation_students: [],
      pressure: {
        open_offers: 0,
        finite_capacity: 0,
        selected: 0,
        remaining_places: 0,
        pending_applications: 0,
        pending_students: 0,
        pending_per_remaining_place: 0,
        high_pressure_offers: 0,
        offers: [],
      },
    });

    expect(parsed.nearCompletionStudents[0]).toEqual(
      expect.objectContaining({
        fullName: "Campos, Lucía",
        totalHours: 240,
        reasonCode: "total_hours_230_249",
      })
    );
    expect(JSON.stringify(parsed)).not.toMatch(/dni|correo|telefono|direccion/i);
  });

  it("mantiene coherentes los conteos del fixture de verificación", () => {
    const fixture = testingDirectorSnapshot(2026, "2026-07-18");

    expect(fixture.withoutPpsStudents).toHaveLength(fixture.studentSummary.withoutPps);
    expect(fixture.withoutPpsStudents.every((student) => student.applicationCount > 0)).toBe(true);
    expect(fixture.nearCompletionStudents).toHaveLength(fixture.studentSummary.nearCompletion);
    expect(fixture.readyToRequestStudents).toHaveLength(fixture.studentSummary.readyToRequest);
    expect(fixture.accreditationStudents).toHaveLength(fixture.studentSummary.inAccreditation);
  });
});
