export const JEFE_MOODLE_BATCH_SIZE = 4;

/**
 * Moodle renders a complete grading table for every requested activity.
 * Keeping the batches small prevents one slow task from exhausting the bridge
 * timeout, while preserving the complete annual scope of the orientation.
 */
export function buildJefeMoodleBatches(
  cmids: readonly number[],
  batchSize = JEFE_MOODLE_BATCH_SIZE
): number[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  const uniqueCmids = [...new Set(cmids.filter((cmid) => Number.isInteger(cmid) && cmid > 0))];
  const batches: number[][] = [];

  for (let index = 0; index < uniqueCmids.length; index += batchSize) {
    batches.push(uniqueCmids.slice(index, index + batchSize));
  }

  return batches;
}
