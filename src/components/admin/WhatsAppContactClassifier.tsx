import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/db";
import Toast from "../ui/Toast";

interface SuggestionPayload {
  chat_jid: string;
  phone: string;
  nombre_contacto: string;
  tipo:
    | "autoridad_uflo"
    | "institucion_con_convenio"
    | "sin_convenio"
    | "coordinador_externo"
    | "otro";
  institucion_id: string | null;
  confidence: number;
  justificacion: string;
  resumen_patron?: string;
  evidence_message_ids?: string[];
}

interface PendingSuggestion {
  id: string;
  tipo: string;
  estado: string;
  payload: SuggestionPayload;
  contexto?: any;
  institucion_id?: string | null;
  created_at: string;
}

interface MessageContext {
  id: string;
  texto: string;
  timestamp: string;
  from_me: boolean;
}

const classificationTypes = [
  {
    id: "autoridad_uflo",
    label: "Autoridad UFLO",
    icon: "school",
    color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20",
  },
  {
    id: "institucion_con_convenio",
    label: "Institución con Convenio",
    icon: "handshake",
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  },
  {
    id: "sin_convenio",
    label: "Institución sin Convenio (Prospección)",
    icon: "work_outline",
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  },
  {
    id: "coordinador_externo",
    label: "Coordinador / Referente Externo",
    icon: "person_outline",
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
  },
  {
    id: "otro",
    label: "Otro / Personal / Spam",
    icon: "block",
    color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800",
  },
];

export const WhatsAppContactClassifier: React.FC = () => {
  const { authenticatedUser } = useAuth();
  const queryClient = useQueryClient();

  const [selectedSuggestion, setSelectedSuggestion] = useState<PendingSuggestion | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Edit fields state
  const [editedName, setEditedName] = useState("");
  const [editedTipo, setEditedTipo] = useState<string>("");
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [editedNotes, setEditedNotes] = useState("");
  const [instSearchQuery, setInstSearchQuery] = useState("");

  // 1. Fetch pending suggestions
  const { data: suggestions = [], isLoading: isLoadingSuggestions } = useQuery<PendingSuggestion[]>(
    {
      queryKey: ["pendingContactClassifications"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("agent_suggestions")
          .select("*")
          .eq("tipo", "clasificacion")
          .eq("estado", "pending")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as unknown as PendingSuggestion[];
      },
    }
  );

  // 2. Fetch institutions
  const { data: institutions = [] } = useQuery({
    queryKey: ["instituciones-all-classifier"],
    queryFn: () => db.instituciones.getAll(),
  });

  // 3. Fetch recent messages for context of selected JID
  const selectedJid = selectedSuggestion?.payload?.chat_jid || null;
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<MessageContext[]>({
    queryKey: ["whatsapp-messages-context", selectedJid],
    queryFn: async () => {
      if (!selectedJid) return [];
      const { data, error } = await supabase
        .from("whatsapp_mensajes")
        .select("id, texto, timestamp, from_me")
        .eq("chat_jid", selectedJid)
        .order("timestamp", { ascending: true }) // Ascending for conversational flow
        .limit(15);
      if (error) throw error;
      return (data || []) as MessageContext[];
    },
    enabled: !!selectedJid,
  });

  // Initialize edit form when selected suggestion changes
  useEffect(() => {
    if (selectedSuggestion) {
      const payload = selectedSuggestion.payload;
      setEditedName(payload.nombre_contacto || "");
      setEditedTipo(payload.tipo || "otro");
      setSelectedInstId(payload.institucion_id || "");
      setEditedNotes("");
      setInstSearchQuery("");
    } else {
      setEditedName("");
      setEditedTipo("");
      setSelectedInstId("");
      setEditedNotes("");
      setInstSearchQuery("");
    }
  }, [selectedSuggestion]);

  // Select first item by default if nothing is selected
  useEffect(() => {
    if (suggestions.length > 0 && !selectedSuggestion) {
      setSelectedSuggestion(suggestions[0]);
    } else if (suggestions.length === 0) {
      setSelectedSuggestion(null);
    }
  }, [suggestions, selectedSuggestion]);

  // Filtered institutions for search dropdown
  const filteredInstitutions = useMemo(() => {
    if (!instSearchQuery) return institutions;
    const query = instSearchQuery.toLowerCase();
    return institutions.filter(
      (inst: any) =>
        String(inst.nombre || "")
          .toLowerCase()
          .includes(query) ||
        String(inst.tutor || "")
          .toLowerCase()
          .includes(query)
    );
  }, [institutions, instSearchQuery]);

  // 4. Mutation to validate/approve classification
  const approveMutation = useMutation({
    mutationFn: async ({
      suggestionId,
      payload,
    }: {
      suggestionId: string;
      payload: {
        chat_jid: string;
        phone: string;
        nombre_contacto: string;
        tipo: string;
        institucion_id: string | null;
        confidence: number;
        notas: string;
      };
    }) => {
      const validadoPor = authenticatedUser?.id || null;
      const validadoAt = new Date().toISOString();

      // a. Insert/Upsert into whatsapp_contactos
      const { error: upsertError } = await supabase.from("whatsapp_contactos").upsert({
        chat_jid: payload.chat_jid,
        phone: payload.phone,
        nombre_contacto: payload.nombre_contacto,
        tipo: payload.tipo,
        institucion_id: payload.institucion_id,
        confidence: payload.confidence,
        clasificado_por: "hermes",
        validado_por: validadoPor,
        validado_at: validadoAt,
        notas: payload.notas,
        updated_at: validadoAt,
      });

      if (upsertError) throw upsertError;

      // b. Update suggestion state
      const { error: updateError } = await supabase
        .from("agent_suggestions")
        .update({
          estado: "approved",
          resolved_at: validadoAt,
          resolved_by: validadoPor,
          edited_payload: {
            nombre_contacto: payload.nombre_contacto,
            tipo: payload.tipo,
            institucion_id: payload.institucion_id,
            notas: payload.notas,
          },
        })
        .eq("id", suggestionId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setToast({ message: "Contacto clasificado y guardado correctamente.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["pendingContactClassifications"] });
      // Clear selected selection to trigger auto-select of next
      setSelectedSuggestion(null);
    },
    onError: (err: any) => {
      setToast({ message: `Error al validar: ${err.message}`, type: "error" });
    },
  });

  // 5. Mutation to discard classification suggestion
  const discardMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const validadoPor = authenticatedUser?.id || null;
      const { error } = await supabase
        .from("agent_suggestions")
        .update({
          estado: "discarded",
          resolved_at: new Date().toISOString(),
          resolved_by: validadoPor,
        })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      setToast({ message: "Sugerencia descartada.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["pendingContactClassifications"] });
      setSelectedSuggestion(null);
    },
    onError: (err: any) => {
      setToast({ message: `Error al descartar: ${err.message}`, type: "error" });
    },
  });

  const handleSave = () => {
    if (!selectedSuggestion) return;
    const payload = selectedSuggestion.payload;
    const needsInst =
      editedTipo === "institucion_con_convenio" || editedTipo === "coordinador_externo";

    if (needsInst && !selectedInstId) {
      setToast({
        message: "Debes seleccionar una institución para esta clasificación.",
        type: "error",
      });
      return;
    }

    approveMutation.mutate({
      suggestionId: selectedSuggestion.id,
      payload: {
        chat_jid: payload.chat_jid,
        phone: payload.phone || null,
        nombre_contacto: editedName.trim(),
        tipo: editedTipo,
        institucion_id: needsInst ? selectedInstId : null,
        confidence: payload.confidence,
        notas: editedNotes.trim(),
      },
    });
  };

  const handleDiscard = () => {
    if (!selectedSuggestion) return;
    if (window.confirm("¿Estás seguro de que quieres descartar esta propuesta de clasificación?")) {
      discardMutation.mutate(selectedSuggestion.id);
    }
  };

  const selectedTypeConfig = useMemo(() => {
    return classificationTypes.find((c) => c.id === editedTipo) || null;
  }, [editedTipo]);

  const activeInstitutionName = useMemo(() => {
    if (!selectedInstId) return "";
    const inst = institutions.find((i: any) => i.id === selectedInstId);
    return inst ? inst.nombre : "";
  }, [selectedInstId, institutions]);

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Column: Proposals List */}
        <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-4 flex flex-col shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-icons text-blue-600 dark:text-blue-400">contact_mail</span>
              Propuestas de Clasificación
              {suggestions.length > 0 && (
                <span className="ml-auto bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-black px-2.5 py-0.5 rounded-full">
                  {suggestions.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Contactos recientes identificados por el agente.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] lg:max-h-[650px] space-y-2 pr-1 no-scrollbar">
            {isLoadingSuggestions ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <span className="material-icons animate-spin text-3xl mb-3">progress_activity</span>
                <span className="text-sm">Buscando propuestas...</span>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <span className="material-icons">task_alt</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bandeja al día</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                  No hay nuevos contactos pendientes de clasificación. Hermes-PPS te avisará en la
                  mañana al sincronizar.
                </p>
              </div>
            ) : (
              suggestions.map((suggestion) => {
                const payload = suggestion.payload;
                const typeConfig = classificationTypes.find((c) => c.id === payload.tipo);
                const isSelected = selectedSuggestion?.id === suggestion.id;
                const confidencePct = Math.round(payload.confidence * 100);

                return (
                  <button
                    key={suggestion.id}
                    onClick={() => setSelectedSuggestion(suggestion)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 relative ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/40 dark:bg-blue-900/10 dark:border-blue-600 shadow-sm"
                        : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-200 dark:hover:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-950/20"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${typeConfig?.color || "text-slate-500 bg-slate-100"}`}
                    >
                      <span className="material-icons !text-lg">
                        {typeConfig?.icon || "person"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {payload.nombre_contacto || "Contacto sin Nombre"}
                        </h4>
                        <span
                          className={`text-[10px] font-black shrink-0 ${
                            payload.confidence >= 0.8
                              ? "text-emerald-600 dark:text-emerald-400"
                              : payload.confidence >= 0.5
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {confidencePct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {payload.phone || payload.chat_jid.split("@")[0]}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider">
                          {typeConfig?.label || "Sin tipo"}
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">
                          {new Date(suggestion.created_at).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Editor & Conversation Preview */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedSuggestion ? (
            <>
              {/* Proposal Details Editor */}
              <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Propuesta de Hermes-PPS
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                      Validar clasificación de contacto
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      JID: {selectedSuggestion.payload.chat_jid}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDiscard}
                      disabled={approveMutation.isPending || discardMutation.isPending}
                      className="px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-xl transition-colors disabled:opacity-50"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={approveMutation.isPending || discardMutation.isPending}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {approveMutation.isPending ? (
                        <>
                          <span className="material-icons animate-spin !text-sm">
                            progress_activity
                          </span>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <span className="material-icons !text-sm">check_circle</span>
                          Aprobar y Registrar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    {/* Contact Name */}
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide"
                      >
                        Nombre del Contacto
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Fundación Sol Mapu, Agostina Directora"
                      />
                    </div>

                    {/* Contact Type Classification */}
                    <div>
                      <label
                        htmlFor="classification-type"
                        className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide"
                      >
                        Clasificación / Rol
                      </label>
                      <select
                        id="classification-type"
                        value={editedTipo}
                        onChange={(e) => setEditedTipo(e.target.value)}
                        className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {classificationTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Institution mapping: shown if type requires a reference */}
                    {(editedTipo === "institucion_con_convenio" ||
                      editedTipo === "coordinador_externo") && (
                      <div className="relative">
                        <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Vincular con Institución
                        </label>

                        {/* Searchable input */}
                        <div className="mt-1.5 relative">
                          <input
                            type="text"
                            value={instSearchQuery}
                            onChange={(e) => setInstSearchQuery(e.target.value)}
                            onFocus={() => {
                              if (!instSearchQuery && activeInstitutionName)
                                setInstSearchQuery(activeInstitutionName);
                            }}
                            className="w-full px-3 py-2.5 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Buscar institución..."
                          />
                          <span className="material-icons absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 !text-lg">
                            search
                          </span>
                        </div>

                        {/* Search Results list overlay */}
                        <div className="absolute z-20 w-full mt-1.5 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg no-scrollbar">
                          {filteredInstitutions.length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                              No se encontraron instituciones.
                            </div>
                          ) : (
                            filteredInstitutions.map((inst: any) => {
                              const isSelected = inst.id === selectedInstId;
                              return (
                                <button
                                  key={inst.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedInstId(inst.id);
                                    setInstSearchQuery(inst.nombre);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${
                                    isSelected
                                      ? "bg-blue-50/50 dark:bg-blue-900/10 font-bold text-blue-600 dark:text-blue-400"
                                      : ""
                                  }`}
                                >
                                  <span>{inst.nombre}</span>
                                  {inst.tutor && (
                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                      Tutor: {inst.tutor}
                                    </span>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>

                        {selectedInstId && (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg flex items-center gap-1.5">
                            <span className="material-icons text-emerald-500 !text-sm">link</span>
                            <span>
                              Vinculado a: <strong>{activeInstitutionName}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Operational Notes */}
                    <div>
                      <label
                        htmlFor="operational-notes"
                        className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide"
                      >
                        Notas Internas / Bitácora
                      </label>
                      <textarea
                        id="operational-notes"
                        rows={2}
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        className="w-full mt-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Primer contacto para coordinar vacantes. Esperar propuesta formal."
                      />
                    </div>
                  </div>
                </div>

                {/* Justification & LLM reasoning */}
                <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Justificación del Agente
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed italic">
                      "{selectedSuggestion.payload.justificacion}"
                    </p>
                    {selectedSuggestion.payload.resumen_patron && (
                      <div className="mt-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Resumen del Patrón Detectado
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                          {selectedSuggestion.payload.resumen_patron}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="md:w-36 flex flex-row md:flex-col items-center justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-200/50 dark:border-slate-800 pt-3 md:pt-0 md:pl-4 gap-2">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          className="text-slate-200 dark:text-slate-800"
                          strokeWidth="4"
                          fill="transparent"
                          stroke="currentColor"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          className={
                            selectedSuggestion.payload.confidence >= 0.8
                              ? "text-emerald-500"
                              : selectedSuggestion.payload.confidence >= 0.5
                                ? "text-amber-500"
                                : "text-rose-500"
                          }
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 28}
                          strokeDashoffset={
                            2 * Math.PI * 28 * (1 - selectedSuggestion.payload.confidence)
                          }
                          stroke="currentColor"
                        />
                      </svg>
                      <span className="absolute text-xs font-black text-slate-700 dark:text-slate-300">
                        {Math.round(selectedSuggestion.payload.confidence * 100)}%
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">
                      Confianza de Clasificación
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat context area */}
              <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-icons text-blue-600 dark:text-blue-400 !text-lg">
                      forum
                    </span>
                    Contexto de Conversación Reciente
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-2">
                      (últimos 15 mensajes en whatsapp_mensajes)
                    </span>
                  </h3>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-xl p-4 max-h-[300px] overflow-y-auto no-scrollbar flex flex-col gap-3 min-h-[150px] justify-end">
                  {isLoadingMessages ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 w-full h-full">
                      <span className="material-icons animate-spin text-2xl mb-2">
                        progress_activity
                      </span>
                      <span className="text-xs">Cargando mensajes del historial...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                      No se encontraron mensajes de este contacto en la base de datos local.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const msgDate = new Date(msg.timestamp);
                      const timeStr = msgDate.toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const dateStr = msgDate.toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      });

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] ${
                            msg.from_me ? "self-end items-end" : "self-start items-start"
                          }`}
                        >
                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                              msg.from_me
                                ? "bg-blue-600 text-white rounded-tr-none"
                                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800"
                            }`}
                          >
                            <p className="whitespace-pre-line leading-relaxed">{msg.texto}</p>
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                            {dateStr} {timeStr}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900/50">
              <span className="material-icons text-slate-300 dark:text-slate-700 text-5xl mb-4">
                chat_bubble_outline
              </span>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Selecciona una propuesta
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                Haz clic en una propuesta de clasificación de la lista izquierda para editarla,
                revisar el historial de mensajes y guardarla.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppContactClassifier;
