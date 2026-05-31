import { useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";
import {
  TABLE_NAME_PPS,
  FIELD_ESTADO_PPS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
} from "../constants";

export const useCycleReset = () => {
  const [isCheckingReset, setIsCheckingReset] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const checkCycleReset = useCallback((pendingRequests: any[], endingLaunches: any[]) => {
    // Logic to detect if reset is needed.
    // For example, if we are in late 2025 or early 2026 and there are still active things from early 2025.
    // For simplicity, let's say if we have > 0 pending requests or confirmed launches, we prompt ONCE per session.

    const hasLegacyData =
      pendingRequests.length > 0 ||
      endingLaunches.some((l: any) => l.gestionStatus === "Relanzamiento Confirmado");

    if (hasLegacyData) {
      const hasSeenPrompt = sessionStorage.getItem("cycle_reset_prompted");
      if (!hasSeenPrompt) {
        setShowResetConfirm(true);
        sessionStorage.setItem("cycle_reset_prompted", "true");
      }
    }
  }, []);

  const handleReset = async () => {
    setIsCheckingReset(true);
    try {
      // 1. Archive Requests
      // Cast to any to allow dynamic update object
      await (supabase as any)
        .from(TABLE_NAME_PPS)
        .update({ [FIELD_ESTADO_PPS]: "Archivado" })
        .neq(FIELD_ESTADO_PPS, "Archivado");

      // 2. Reset Launches
      await (supabase as any)
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .update({
          [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Pendiente de Gestión",
          [FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS]: null,
          [FIELD_NOTAS_GESTION_LANZAMIENTOS]: null,
        })
        .neq(FIELD_ESTADO_GESTION_LANZAMIENTOS, "Pendiente de Gestión");
    } catch (error) {
      logger.error("Error resetting cycle:", error);
    } finally {
      setIsCheckingReset(false);
      setShowResetConfirm(false);
    }
  };

  return {
    checkCycleReset,
    handleReset,
    isCheckingReset,
    showResetConfirm,
    setShowResetConfirm,
  };
};
