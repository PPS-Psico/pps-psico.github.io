import type { MoodleGradeSnapshot } from "../../contexts/MoodleGradeSyncContext";
import {
  presentMoodleGrade,
  type MoodleGradePresentation,
} from "../../utils/moodleGradePresentation";
import type { GuidedDelivery } from "./deliveryGuide";
type DeliveryBucket = "pending" | "delivered" | "upcoming" | "unknown";

export function isDelivered(_delivery: GuidedDelivery, snapshot?: MoodleGradeSnapshot): boolean {
  return Boolean(
    snapshot &&
    (snapshot.reviewedAllocation ||
      snapshot.submitted ||
      snapshot.task_status === "submitted" ||
      snapshot.task_status === "graded")
  );
}

export function getDeliveryBucket(
  delivery: GuidedDelivery,
  snapshot?: MoodleGradeSnapshot
): DeliveryBucket {
  if (isDelivered(delivery, snapshot)) return "delivered";
  if (delivery.statusLabel === "Todavía en cursada") return "upcoming";
  if (snapshot?.task_status === "not_submitted") return "pending";

  return "unknown";
}

export function deliveryPresentation(
  delivery: GuidedDelivery,
  snapshot?: MoodleGradeSnapshot
): MoodleGradePresentation {
  return (
    presentMoodleGrade(
      snapshot && !snapshot.reviewedAllocation ? { ...snapshot, academicGrade: null } : snapshot
    ) ?? {
      label: delivery.statusLabel,
      detail: delivery.statusDetail,
      compact: delivery.statusLabel,
      tone: delivery.statusTone,
      hasGrade: false,
    }
  );
}
