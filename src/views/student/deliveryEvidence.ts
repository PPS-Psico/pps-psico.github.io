import type { MoodleGradeSnapshot } from "../../contexts/MoodleGradeSyncContext";
import {
  presentStudentMoodleGrade,
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
  return "pending";
}

export function deliveryPresentation(
  _delivery: GuidedDelivery,
  snapshot?: MoodleGradeSnapshot
): MoodleGradePresentation {
  return presentStudentMoodleGrade(snapshot);
}
