type JefeMoodleSyncOutcomeInput = {
  failedTasks: number;
  ambiguous: number;
  invalid: number;
};

export const hasJefeMoodleSyncProblems = ({
  failedTasks,
  ambiguous,
  invalid,
}: JefeMoodleSyncOutcomeInput): boolean => failedTasks > 0 || ambiguous > 0 || invalid > 0;
