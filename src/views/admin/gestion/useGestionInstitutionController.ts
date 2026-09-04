import { useCallback, useState } from "react";
import {
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_HISTORIAL_GESTION_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS,
} from "../../../constants";
import type { LanzamientoPPS } from "../../../types";
import {
  formatDate,
  getWhatsAppUrl,
  normalizeStringForComparison,
} from "../../../utils/formatters";
import { appendHistorial } from "./gestionHelpers";
import {
  STATE_META,
  STATE_TO_DB,
  type BandejaItem,
  type InstitutionVM,
  type UiState,
} from "./gestionTypes";

interface InstitutionPatch {
  telefono?: string;
  tutor?: string;
  direccion?: string;
  convenio_nuevo?: string;
}

interface UseGestionInstitutionControllerOptions {
  institutionsByKey: Map<string, InstitutionVM>;
  saveLaunch: (id: string, updates: Partial<LanzamientoPPS>) => Promise<boolean>;
  updateInstitution: (id: string, patch: InstitutionPatch) => Promise<boolean>;
  showToast: (message: string, icon?: string) => void;
}

export const useGestionInstitutionController = ({
  institutionsByKey,
  saveLaunch,
  updateInstitution,
  showToast,
}: UseGestionInstitutionControllerOptions) => {
  const [contactVm, setContactVm] = useState<InstitutionVM | null>(null);
  const [editVm, setEditVm] = useState<InstitutionVM | null>(null);
  const [reminderVm, setReminderVm] = useState<InstitutionVM | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    vm: InstitutionVM;
    newState: UiState;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const openContact = useCallback(
    (vmOrItem: InstitutionVM | BandejaItem) => {
      const key = "key" in vmOrItem ? vmOrItem.key : normalizeStringForComparison(vmOrItem.grupo);
      const vm = institutionsByKey.get(key);
      if (vm) setContactVm(vm);
    },
    [institutionsByKey]
  );

  const sendWhatsApp = useCallback(
    (vm: InstitutionVM, text: string) => {
      const url = getWhatsAppUrl(vm.phone, text);
      if (!url) {
        showToast("Este teléfono no es un WhatsApp válido", "info");
        return;
      }
      window.open(url, "_blank", "noopener");
      setContactVm(null);
      showToast("WhatsApp abierto · revisá y enviá manualmente", "chat");
    },
    [showToast]
  );

  const markWaiting = useCallback(
    async (vm: InstitutionVM) => {
      const latest = vm.launches[0];
      if (!latest) return;
      const ok = await saveLaunch(latest.id, {
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: STATE_TO_DB.esperandoRespuesta,
        [FIELD_HISTORIAL_GESTION_LANZAMIENTOS]: appendHistorial(
          latest[FIELD_HISTORIAL_GESTION_LANZAMIENTOS] as string | null,
          "Contactada · esperando respuesta"
        ),
      } as Partial<LanzamientoPPS>);
      setContactVm(null);
      if (ok) showToast("Marcada como “Esperando respuesta”", "schedule_send");
    },
    [saveLaunch, showToast]
  );

  const saveReminder = useCallback(
    async (iso: string) => {
      if (!reminderVm) return;
      const latest = reminderVm.launches[0];
      if (!latest) return;
      setSaving(true);
      const ok = await saveLaunch(latest.id, {
        [FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS]: iso,
      } as Partial<LanzamientoPPS>);
      setSaving(false);
      if (ok) {
        setReminderVm(null);
        showToast(`Recordatorio para el ${formatDate(iso)}`, "alarm");
      }
    },
    [reminderVm, saveLaunch, showToast]
  );

  const saveInstitution = useCallback(
    async (patch: InstitutionPatch) => {
      if (!editVm) return;
      if (editVm.id === editVm.key) {
        showToast("Esta institución no tiene ficha propia todavía", "info");
        setEditVm(null);
        return;
      }
      setSaving(true);
      const ok = await updateInstitution(editVm.id, patch);
      setSaving(false);
      if (ok) {
        setEditVm(null);
        showToast("Institución actualizada", "check_circle");
      }
    },
    [editVm, updateInstitution, showToast]
  );

  const confirmChange = useCallback(
    async (note: string) => {
      if (!pendingChange) return;
      const latest = pendingChange.vm.launches[0];
      if (!latest) return;
      setSaving(true);
      const updates: Partial<LanzamientoPPS> = {
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: STATE_TO_DB[pendingChange.newState],
      } as Partial<LanzamientoPPS>;
      if (note.trim()) {
        const previousNotes = (latest[FIELD_NOTAS_GESTION_LANZAMIENTOS] as string) || "";
        const stamp = new Date().toLocaleDateString("es", {
          day: "2-digit",
          month: "short",
        });
        updates[FIELD_NOTAS_GESTION_LANZAMIENTOS] =
          `${previousNotes ? `${previousNotes}\n` : ""}[${stamp}] ${note.trim()}`;
      }
      const historyText = `${STATE_META[pendingChange.newState].label}${note.trim() ? ` · ${note.trim()}` : ""}`;
      updates[FIELD_HISTORIAL_GESTION_LANZAMIENTOS] = appendHistorial(
        latest[FIELD_HISTORIAL_GESTION_LANZAMIENTOS] as string | null,
        historyText
      );
      const ok = await saveLaunch(latest.id, updates);
      setSaving(false);
      if (ok) {
        showToast(`${STATE_META[pendingChange.newState].label} · cambio registrado`, "flag");
        setPendingChange(null);
      }
    },
    [pendingChange, saveLaunch, showToast]
  );

  return {
    contactVm,
    setContactVm,
    editVm,
    setEditVm,
    reminderVm,
    setReminderVm,
    pendingChange,
    setPendingChange,
    saving,
    openContact,
    sendWhatsApp,
    markWaiting,
    saveReminder,
    saveInstitution,
    confirmChange,
  };
};
