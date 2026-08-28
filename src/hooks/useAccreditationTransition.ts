import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccreditationTransitionEvent } from "../domain/finalizacion/accreditationTransition";
import { supabase } from "../lib/supabaseClient";

export const accreditationTransitionQueryKey = (studentId: string | null) =>
  ["accreditationTransition", studentId] as const;

export const useAccreditationTransition = (studentId: string | null, enabled = true) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: accreditationTransitionQueryKey(studentId),
    queryFn: async (): Promise<AccreditationTransitionEvent | null> => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("accreditation_transition_events")
        .select("*")
        .eq("estudiante_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: enabled && Boolean(studentId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const acknowledge = useMutation({
    mutationFn: async (eventId: string) => {
      const acknowledgedAt = new Date().toISOString();
      const { error } = await supabase
        .from("accreditation_transition_events")
        .update({ acknowledged_at: acknowledgedAt })
        .eq("id", eventId);
      if (error) throw error;
      return acknowledgedAt;
    },
    onSuccess: (acknowledgedAt) => {
      queryClient.setQueryData<AccreditationTransitionEvent | null>(
        accreditationTransitionQueryKey(studentId),
        (current) => (current ? { ...current, acknowledged_at: acknowledgedAt } : current)
      );
    },
  });

  return {
    transitionEvent: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    acknowledge,
    refetch: query.refetch,
  };
};
