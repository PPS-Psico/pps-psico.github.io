import type { MoodleGradeSnapshot } from "../../../contexts/MoodleGradeSyncContext";
import type { GuidedDelivery } from "../deliveryGuide";
import { getDeliveryBucket, deliveryPresentation } from "../deliveryEvidence";
const delivery = {
  recordedGrade: "9",
  gradedDirectly: true,
  task: { nota: "9", informeSubido: true },
  statusLabel: "Estado no sincronizado",
  statusDetail: "Sin lectura",
  statusTone: "neutral",
} as GuidedDelivery;
const snapshot = {
  task_status: "not_submitted",
  submitted: false,
  grade_value: null,
  grade_max: null,
  grade_display: null,
  academicGrade: "9",
  reviewedAllocation: false,
} as MoodleGradeSnapshot;
it("no convierte notas ni marcas manuales en entregas o notas de Campus", () => {
  for (const grade of ["9", "6", "5", "Aprobado"]) {
    const d = { ...delivery, recordedGrade: grade };
    expect(getDeliveryBucket(d, snapshot)).toBe("pending");
    expect(getDeliveryBucket(d)).toBe("pending");
    expect(deliveryPresentation(d, { ...snapshot, academicGrade: grade }).hasGrade).toBe(false);
  }
});
it("muestra la nota real aunque el expediente tenga otra manual", () => {
  const real = {
    ...snapshot,
    task_status: "graded",
    submitted: true,
    grade_value: 8,
    grade_max: 10,
    grade_conversion_mode: "direct_10" as const,
  };
  expect(getDeliveryBucket(delivery, real)).toBe("delivered");
  expect(deliveryPresentation(delivery, real)).toMatchObject({ compact: "8", hasGrade: true });
});
it("conserva una asignación cualitativa revisada por coordinación", () => {
  const reviewed = { ...snapshot, reviewedAllocation: true, academicGrade: "Aprobado" };
  expect(getDeliveryBucket(delivery, reviewed)).toBe("delivered");
  expect(deliveryPresentation(delivery, reviewed)).toMatchObject({
    compact: "Aprobado",
    hasGrade: true,
  });
});

it.each(["not_submitted", "no_access", "parse_error"])(
  "no expone diagnósticos de %s como estado del estudiante",
  (task_status) => {
    expect(deliveryPresentation(delivery, { ...snapshot, task_status })).toMatchObject({
      label: "Pendiente de entrega",
      compact: "Pendiente de entrega",
      detail: "",
      tone: "neutral",
    });
  }
);
it("entrega compartida sin nota atribuida permanece en corrección", () => {
  expect(
    deliveryPresentation(delivery, {
      ...snapshot,
      submitted: true,
      inheritedFromSharedTask: true,
    })
  ).toMatchObject({ label: "En corrección", detail: "", hasGrade: false });
});
it("conserva la nota confirmada sin exponer avisos de revisión", () => {
  expect(
    deliveryPresentation(delivery, {
      ...snapshot,
      reviewedAllocation: true,
      reviewRequired: true,
      academicGrade: "9",
    })
  ).toMatchObject({ label: "9", compact: "9", detail: "", tone: "ok" });
});
