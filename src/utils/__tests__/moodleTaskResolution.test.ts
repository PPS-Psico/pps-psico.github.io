import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
} from "../../constants";
import type { MoodleTaskLink } from "../../hooks/useMoodleTaskLinks";
import type { MoodleGradeLike } from "../moodleGradePresentation";
import type { Practica } from "../../types";
import {
  buildPendingMoodleAssignments,
  selectCurrentMoodleSnapshots,
} from "../moodleTaskResolution";

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

  it("vuelve a escanear una calificación cuya revisión fue reabierta", () => {
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
          scan_closed: false,
        },
      ],
    ]);

    expect(buildPendingMoodleAssignments([practices[0]], links, snapshots).has("946366")).toBe(
      true
    );
  });

  it("hereda la entrega entre dos PPS de la misma tarea, pero nunca la nota", () => {
    // Caso real (Juan Emilio Serrano, Fundación Tiempo): Adultos y Niños son
    // dos prácticas distintas que entregan en un único espacio de Moodle. La
    // nota queda registrada contra una sola y la otra aparecía como "Pend.".
    //
    // Heredar la entrega es correcto -el informe efectivamente entró-, pero
    // heredar el número no: en estas tareas Moodle tiene un solo campo de nota
    // y la cátedra reparte las notas reales en el comentario, que suelen
    // diferir (Ariel Nahuelcheo: Adultos 8, Niños 9, con 90/100 en el número).
    // Antes el panel mostraba el mismo valor en las dos filas.
    const sharedLinks: MoodleTaskLink[] = [
      {
        launchId: "launch-adultos",
        orientationKey: "clinica",
        moodleId: "1085731",
        name: "Fundación Tiempo",
        area: "clinica",
        academicYear: 2026,
      },
      {
        launchId: "launch-ninos",
        orientationKey: "clinica",
        moodleId: "1085731",
        name: "Fundación Tiempo",
        area: "clinica",
        academicYear: 2026,
      },
    ];
    const sharedPractices = [
      {
        id: "practica-adultos",
        [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-adultos",
        [FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
      },
      {
        id: "practica-ninos",
        [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-ninos",
        [FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
      },
    ] as unknown as Practica[];
    const snapshots: (MoodleGradeLike & { practica_id: string; cmid: number })[] = [
      {
        practica_id: "practica-adultos",
        cmid: 1085731,
        task_status: "graded",
        submitted: true,
        grade_value: 90,
        grade_max: 100,
        grade_display: "90,00 / 100,00",
        observed_at: "2026-08-10T12:00:00.000Z",
        scan_closed: true,
      },
    ];

    const resolved = selectCurrentMoodleSnapshots(sharedPractices, sharedLinks, snapshots);

    // La que tiene la observación propia conserva todo.
    expect(resolved.get("practica-adultos")?.grade_value).toBe(90);
    expect(resolved.get("practica-adultos")?.inheritedFromSharedTask).toBeUndefined();

    // La hermana sabe que se entregó, pero no se le atribuye ninguna nota.
    const ninos = resolved.get("practica-ninos");
    expect(ninos?.submitted).toBe(true);
    expect(ninos?.task_status).toBe("graded");
    expect(ninos?.grade_value).toBeNull();
    expect(ninos?.grade_display).toBeNull();
    expect(ninos?.inheritedFromSharedTask).toBe(true);
  });

  it("no toma prestado el snapshot de una práctica ajena a la lista", () => {
    const otherStudentSnapshots = [
      {
        practica_id: "practica-de-otro-alumno",
        cmid: 946366,
        task_status: "graded",
        submitted: true,
        grade_value: 100,
        grade_max: 100,
        grade_display: "100,00 / 100,00",
        observed_at: "2026-08-10T12:00:00.000Z",
        scan_closed: true,
      },
    ];

    expect(
      selectCurrentMoodleSnapshots([practices[0]], links, otherStudentSnapshots).get(
        "practice-graded"
      )
    ).toBeUndefined();
  });

  it("ignora el snapshot terminal de una tarea anterior después de un remapeo", () => {
    const remappedLinks = links.map((link) =>
      link.launchId === "launch-graded" ? { ...link, moodleId: "999001" } : link
    );
    const snapshots = [
      {
        practica_id: "practice-graded",
        cmid: 946366,
        task_status: "graded",
        submitted: true,
        grade_value: 9,
        grade_max: 10,
        grade_display: "9 / 10",
        observed_at: "2026-08-10T12:00:00.000Z",
        scan_closed: true,
      },
      {
        practica_id: "practice-graded",
        cmid: 999001,
        task_status: "submitted",
        submitted: true,
        grade_value: null,
        grade_max: 100,
        grade_display: null,
        observed_at: "2026-08-12T12:00:00.000Z",
        scan_closed: false,
      },
    ];

    expect(
      selectCurrentMoodleSnapshots([practices[0]], remappedLinks, snapshots).get("practice-graded")
        ?.cmid
    ).toBe(999001);
  });
});
