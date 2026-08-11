import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
} from "../../constants";
import type { MoodleTaskLink } from "../../hooks/useMoodleTaskLinks";
import type { Practica } from "../../types";
import { buildPendingMoodleAssignments } from "../moodleTaskResolution";

const links: MoodleTaskLink[] = [
  {
    launchId: "launch-graded",
    orientationKey: "clinica",
    moodleId: "946366",
    name: "Tarea calificada",
    area: "clinica",
    academicYear: 2026,
  },
  {
    launchId: "launch-submitted",
    orientationKey: "educacional",
    moodleId: "946365",
    name: "Tarea pendiente",
    area: "educacional",
    academicYear: 2026,
  },
];

const practices = [
  {
    id: "practice-graded",
    [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-graded",
    [FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
  },
  {
    id: "practice-submitted",
    [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-submitted",
    [FIELD_ESPECIALIDAD_PRACTICAS]: "Educacional",
  },
] as Practica[];

describe("buildPendingMoodleAssignments", () => {
  it("deja de escanear una tarea calificada y conserva las pendientes", () => {
    const snapshots = new Map([
      [
        "practice-graded",
        {
          task_status: "graded",
          submitted: true,
          grade_value: 8,
          grade_max: 10,
          grade_display: "8 / 10",
          observed_at: "2026-08-11T12:00:00.000Z",
        },
      ],
      [
        "practice-submitted",
        {
          task_status: "submitted",
          submitted: true,
          grade_value: null,
          grade_max: 100,
          grade_display: null,
          observed_at: "2026-08-11T12:00:00.000Z",
        },
      ],
    ]);

    expect(buildPendingMoodleAssignments(practices, links, snapshots)).toEqual(
      new Map([["946365", ["practice-submitted"]]])
    );
  });

  it("mantiene en el escaneo una tarea con error para poder recuperarla", () => {
    const snapshots = new Map([
      [
        "practice-graded",
        {
          task_status: "parse_error",
          submitted: false,
          grade_value: null,
          grade_max: null,
          grade_display: null,
          observed_at: "2026-08-11T12:00:00.000Z",
        },
      ],
    ]);

    expect(buildPendingMoodleAssignments([practices[0]], links, snapshots).has("946366")).toBe(
      true
    );
  });
});
