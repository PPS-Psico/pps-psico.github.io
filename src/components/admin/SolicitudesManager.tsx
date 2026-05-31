import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FIELD_ESTADO_PPS,
  TABLE_PPS,
  TABLE_FINALIZACION,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTUDIANTE_FINALIZACION,
  FIELD_PLANILLA_HORAS_FINALIZACION,
  FIELD_INFORME_FINAL_FINALIZACION,
  FIELD_PLANILLA_ASISTENCIA_FINALIZACION,
  FIELD_SUGERENCIAS_MEJORAS_FINALIZACION,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  TABLE_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
} from "../../constants";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { mockDb } from "../../services/mockDb";
import type { SolicitudPPSFields, FinalizacionPPSFields } from "../../types";
import {
  buildInstitutionContactDraft,
  type EmailDraft,
  sendSmartEmail,
} from "../../utils/emailService";
import {
  normalizeStringForComparison,
  getWhatsAppUrl,
  isValidWhatsAppFormat,
  formatDate,
  safeGetId,
  cleanWhatsAppNumber,
} from "../../utils/formatters";
import ConfirmModal from "../ConfirmModal";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import { FilePreview } from "./preview";
import { fetchAllData } from "../../services/supabaseService";
import { mapFinalizacion, mapEstudiante } from "../../utils/mappers";
import {
  deleteFinalizationRequest,
  approveSolicitudModificacion,
  approveSolicitudNuevaPPS,
  fetchAllSolicitudesModificacion,
  fetchAllSolicitudesNuevaPPS,
  rejectSolicitudModificacion,
  rejectSolicitudNuevaPPS,
} from "../../services";
import { Attachment, getNormalizationState, getStoragePath } from "../../utils/attachmentUtils";
import { logger } from "../../utils/logger";
import type {
  StudentRelation,
  SolicitudPPSWithStudent,
  FinalizacionWithStudent,
  SolicitudModificacion,
  SolicitudNueva,
  TabType,
} from "./solicitudes/types";
import {
  normalizeAttachments,
  getInstitutionNameFromRequest,
  timeAgo,
} from "./solicitudes/helpers";
import {
  SubTabs,
  FilterTabs,
  SearchBar,
  DataItem,
  EmptyState,
  type SubTabItem,
  type FilterOption,
} from "./solicitudes/primitives";
import { RejectModal, BorradorModal } from "./solicitudes/modals";

// ─── Panel Hermes: Ingreso ──────────────────────────────────────────
const PanelHermesIngreso: React.FC<{
  sol: SolicitudPPSWithStudent;
  onVerGestion: () => void;
  gmailHilos: any[];
  whatsappMensajes: any[];
}> = ({ sol, onVerGestion, gmailHilos, whatsappMensajes }) => {
  const [ppsAnteriores, setPpsAnteriores] = useState<any[]>([]);
  const [loadingPps, setLoadingPps] = useState(false);

  const hasConvenio =
    sol.convenio_uflo?.toLowerCase() === "sí" || sol.convenio_uflo?.toLowerCase() === "si";
  const hasTutor =
    sol.tutor_disponible?.toLowerCase() === "sí" || sol.tutor_disponible?.toLowerCase() === "si";
  const isNoCatalogada =
    sol.convenio_uflo?.toLowerCase().includes("cat") ||
    sol.convenio_uflo?.toLowerCase() === "no catalogada";

  useEffect(() => {
    let active = true;
    const fetchPrevious = async () => {
      if (!sol.nombre_institucion) return;
      setLoadingPps(true);
      try {
        const { data, error } = await supabase
          .from("practicas")
          .select("estado, especialidad, fecha_inicio, fecha_finalizacion")
          .eq("nombre_institucion", sol.nombre_institucion)
          .limit(3);

        if (!error && data && active) {
          setPpsAnteriores(data);
        }
      } catch (e) {
        logger.error(e);
      } finally {
        if (active) setLoadingPps(false);
      }
    };
    fetchPrevious();
    return () => {
      active = false;
    };
  }, [sol.nombre_institucion]);

  // Generate dynamic recent history from Supabase threads and messages
  const recentHistory = useMemo(() => {
    const list: any[] = [];
    const { number: cleanPhone } = cleanWhatsAppNumber(sol.telefono_institucion);

    // Find matching WhatsApp messages
    if (cleanPhone) {
      const msgs = whatsappMensajes.filter((m) => {
        if (!m.chat_jid) return false;
        const { number: msgPhone } = cleanWhatsAppNumber(m.chat_jid.split("@")[0]);
        return msgPhone === cleanPhone;
      });
      msgs.forEach((m) => {
        list.push({
          canal: "whatsapp" as const,
          fromMe: m.from_me,
          snippet: m.texto || "Mensaje de WhatsApp",
          timestamp: new Date(m.timestamp),
          hace: timeAgo(m.timestamp),
          estado: null,
        });
      });
    }

    // Find matching Gmail threads
    if (sol.email_institucion) {
      const email = sol.email_institucion.toLowerCase().trim();
      const threads = gmailHilos.filter((t) => {
        const matchesEmail =
          t.participantes && JSON.stringify(t.participantes).toLowerCase().includes(email);
        const matchesDirect =
          t.email_institucion && t.email_institucion.toLowerCase().includes(email);
        return matchesEmail || matchesDirect;
      });

      threads.forEach((t) => {
        list.push({
          canal: "mail" as const,
          fromMe: t.ultimo_mensaje_de === "nos",
          snippet: t.asunto || "Correo sin asunto",
          timestamp: new Date(t.ultimo_mensaje_at || t.primer_mensaje_at || Date.now()),
          hace: timeAgo(t.ultimo_mensaje_at),
          estado: t.estado === "esperando_respuesta" ? ("esperando" as const) : null,
        });
      });
    }

    // Sort descending by date
    list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return list;
  }, [sol.email_institucion, sol.telefono_institucion, gmailHilos, whatsappMensajes]);

  // Generate dynamic recommendation based on recent history or convenio status
  const recommendation = useMemo(() => {
    if (recentHistory.length > 0) {
      const latest = recentHistory[0];
      const canalStr = latest.canal === "mail" ? "email" : "WhatsApp";
      const snippetStr =
        latest.snippet && latest.snippet.length > 60
          ? latest.snippet.substring(0, 57) + "..."
          : latest.snippet;

      if (latest.fromMe) {
        // Last message was from us
        return {
          sugerencia: `Le enviaste un ${canalStr} hace ${latest.hace} ("${snippetStr}"). Estamos esperando respuesta de ${sol.referente_institucion || "la institución"} para formalizar el convenio de prácticas.`,
          requiereDecision: false,
          motivoDecision: undefined,
        };
      } else {
        // Last message was from them (incoming)
        return {
          sugerencia: `La institución envió un ${canalStr} hace ${latest.hace}: "${snippetStr}". Está esperando tu respuesta. Hacé clic en ${latest.canal === "mail" ? "Enviar email" : "WhatsApp"} para contestar y avanzar.`,
          requiereDecision: true,
          motivoDecision: `Responder al referente institucional por ${canalStr}.`,
        };
      }
    }

    // No contact history yet
    if (hasConvenio) {
      if (hasTutor) {
        return {
          sugerencia: `Convenio formal vigente con "${sol.nombre_institucion}" y tutor disponible (${sol.contacto_tutor || "tutor"}). Podés proceder a aprobar la solicitud.`,
          requiereDecision: false,
          motivoDecision: undefined,
        };
      } else {
        return {
          sugerencia: `Existe convenio formal con "${sol.nombre_institucion}", pero falta registrar el psicólogo tutor matriculado para firmar el compromiso. Coordiná con la institución.`,
          requiereDecision: true,
          motivoDecision: "Falta tutor de psicología matriculado en la institución.",
        };
      }
    } else {
      if (isNoCatalogada) {
        return {
          sugerencia: `La institución "${sol.nombre_institucion}" no está en el catálogo. Verificá los datos e iniciá la firma del convenio formal si es viable.`,
          requiereDecision: true,
          motivoDecision: "Institución no catalogada. Requiere alta y convenio nuevo.",
        };
      } else {
        return {
          sugerencia: `Falta convenio formal con "${sol.nombre_institucion}" y no se ha iniciado contacto. Enviá la propuesta usando "Borrador con Hermes" o contactalos por WhatsApp.`,
          requiereDecision: true,
          motivoDecision: "Falta formalizar convenio de prácticas con la institución.",
        };
      }
    }
  }, [
    sol.convenio_uflo,
    sol.tutor_disponible,
    sol.nombre_institucion,
    sol.contacto_tutor,
    sol.referente_institucion,
    recentHistory,
    hasConvenio,
    hasTutor,
    isNoCatalogada,
  ]);

  const { sugerencia, requiereDecision, motivoDecision } = recommendation;

  return (
    <div
      style={{
        border: "1px solid #5A2D8626",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--paper)",
        marginTop: 14,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid var(--rule-2)",
          background: "var(--ai-soft)",
        }}
      >
        <span className="material-icons" style={{ fontSize: 16, color: "var(--ai)" }}>
          auto_awesome
        </span>
        <span className="label" style={{ color: "var(--ai)", letterSpacing: "0.08em" }}>
          Panel Hermes
        </span>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Sugiere */}
        <div>
          <div className="label" style={{ marginBottom: 8 }}>
            Hermes sugiere
          </div>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--ai-soft)",
              border: "1px solid #5A2D8622",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--ink-2)",
            }}
          >
            {sugerencia}
            {requiereDecision && (
              <div
                style={{
                  display: "flex",
                  gap: 7,
                  alignItems: "flex-start",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid #5A2D8622",
                }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: 15, color: "var(--ai)", flexShrink: 0, marginTop: 1 }}
                >
                  pan_tool
                </span>
                <span style={{ fontSize: 12, color: "var(--ai)", fontWeight: 600 }}>
                  Hermes detectó una decisión requerida:{" "}
                  <span style={{ fontWeight: 500, color: "var(--ink-2)" }}>{motivoDecision}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Historial reciente */}
        {recentHistory.length > 0 && (
          <div>
            <div
              className="label"
              style={{ marginBottom: 8, fontSize: 9.5, letterSpacing: "0.06em" }}
            >
              HISTORIAL RECIENTE · GMAIL + WHATSAPP
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentHistory.map((h, i) => {
                const color = h.canal === "mail" ? "var(--accent)" : "#2F8F43";
                const isIncoming = !h.fromMe;
                const isEsperando = h.estado === "esperando" || isIncoming;
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "18px 1fr auto",
                      gap: 9,
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: isEsperando
                        ? "var(--warn-soft)"
                        : h.fromMe
                          ? "var(--ok-soft)"
                          : "transparent",
                      border: isEsperando ? "1px solid #B4501E1A" : "1px solid transparent",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 15, color }}>
                      {h.canal === "mail" ? "mail" : "chat"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h.fromMe && (
                          <span style={{ color: "var(--ink-4)", fontWeight: 600 }}>→ </span>
                        )}
                        {h.snippet}
                      </div>
                      {isEsperando && (
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--warn)",
                            marginTop: 2,
                          }}
                        >
                          Esperando tu respuesta
                        </div>
                      )}
                    </div>
                    <span
                      className="mono meta"
                      style={{
                        fontSize: 11,
                        whiteSpace: "nowrap",
                        alignSelf: "start",
                        marginTop: 2,
                      }}
                    >
                      {h.hace}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PPS anteriores */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span className="label">PPS anteriores con esta institución</span>
            <button
              onClick={onVerGestion}
              className="btn btn-ghost btn-sm press"
              style={{ fontSize: 11, color: "var(--ai)", padding: 4 }}
            >
              Ver en Gestión
              <span className="material-icons" style={{ fontSize: 13, marginLeft: 3 }}>
                open_in_new
              </span>
            </button>
          </div>
          {loadingPps ? (
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>
              Buscando antecedente...
            </div>
          ) : ppsAnteriores.length > 0 ? (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {ppsAnteriores.map((p, i) => {
                const year = p.fecha_inicio ? new Date(p.fecha_inicio).getFullYear() : "—";
                const cohorte =
                  p.fecha_inicio && new Date(p.fecha_inicio).getMonth() > 5
                    ? `${year}-2`
                    : `${year}-1`;
                return (
                  <div
                    key={i}
                    style={{
                      flexShrink: 0,
                      width: 150,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--rule-2)",
                      background: "var(--paper-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        className="mono"
                        style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}
                      >
                        {cohorte}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: p.estado === "Finalizado" ? "var(--ok)" : "var(--warn)",
                        }}
                      >
                        {p.estado}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.4 }}>
                      {p.especialidad || "General"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic" }}>
              No se registran PPS previas con esta institución.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Componente Principal ───────────────────────────────────────────
const SolicitudesManager: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
  const queryClient = useQueryClient();
  const location = useLocation();

  // Navigation tabs
  const [tab, setTab] = useState<TabType>(() => {
    try {
      const p = new URLSearchParams(location.search);
      const urlTab = p.get("tab") as TabType;
      if (urlTab === "ingreso" || urlTab === "egreso" || urlTab === "correcciones") return urlTab;
      return (localStorage.getItem("sol-tab") as TabType) || "ingreso";
    } catch {
      return "ingreso";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sol-tab", tab);
    } catch {}
  }, [tab]);

  // States
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    // Deep-link desde el Inicio: ?focus=<id> abre y resalta esa solicitud.
    try {
      return new URLSearchParams(location.search).get("focus");
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [emailReview, setEmailReview] = useState<EmailDraft | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [borradorHermes, setBorradorHermes] = useState<any>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleCard = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Deep-link: si llegamos con ?focus=<id>, aseguramos el tab correcto y
  // hacemos scroll a la tarjeta resaltada una vez que la lista está montada.
  useEffect(() => {
    let focusId: string | null = null;
    try {
      focusId = new URLSearchParams(location.search).get("focus");
    } catch {
      focusId = null;
    }
    if (!focusId) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-solicitud-id="${focusId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(t);
  }, [location.search]);

  // Queries for Hermes Tracking
  const { data: whatsappContactos = [], refetch: refetchContacts } = useQuery<any[]>({
    queryKey: ["adminWhatsAppContactos", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        return await mockDb.getAll("whatsapp_contactos");
      }
      const { data, error } = await supabase.from("whatsapp_contactos").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: whatsappMensajes = [], refetch: refetchMessages } = useQuery<any[]>({
    queryKey: ["adminWhatsAppMensajes", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        return await mockDb.getAll("whatsapp_mensajes");
      }
      const { data, error } = await supabase
        .from("whatsapp_mensajes")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: gmailHilos = [], refetch: refetchGmail } = useQuery<any[]>({
    queryKey: ["adminGmailHilos", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        return await mockDb.getAll("gmail_hilos");
      }
      const { data, error } = await supabase
        .from("gmail_hilos")
        .select("*")
        .order("ultimo_mensaje_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // 1. QUERY INGRESO (solicitudes_pps)
  const { data: solicitudesIngreso = [], isLoading: loadingIngreso } = useQuery<
    SolicitudPPSWithStudent[]
  >({
    queryKey: ["adminSolicitudesPPS", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const mockRequests = await mockDb.getAll("solicitudes_pps");
        return mockRequests.map((req: any) => ({
          ...req,
          id: String(req.id),
          _studentName: req.nombre_alumno || "Estudiante Mock",
          _studentLegajo: req.legajo || "12345",
          _studentEmail: req.email,
          _daysSinceUpdate: 0,
        }));
      }

      const { data, error } = await supabase
        .from(TABLE_PPS)
        .select("*, estudiantes!fk_solicitud_estudiante(nombre, legajo, correo)")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return data.map((req: any) => {
        const studentData = req.estudiantes;
        const updatedAt = new Date(req.actualizacion || req.created_at || Date.now());
        return {
          ...req,
          id: String(req.id),
          _studentName: studentData?.nombre || req.nombre_alumno || "Estudiante",
          _studentLegajo: studentData?.legajo || req.legajo || "---",
          _studentEmail: studentData?.correo || req.email,
          _daysSinceUpdate: Math.floor(
            (new Date().getTime() - updatedAt.getTime()) / (1000 * 3600 * 24)
          ),
        };
      });
    },
  });

  // Sync phone numbers of active solicitudes into whatsapp_contactos list
  useEffect(() => {
    if (!solicitudesIngreso.length) return;
    const syncContacts = async () => {
      let updated = false;
      for (const sol of solicitudesIngreso) {
        if (!sol.telefono_institucion) continue;
        const { number: cleanPhone, isValid } = cleanWhatsAppNumber(sol.telefono_institucion);
        if (!isValid || !cleanPhone) continue;

        const exists = whatsappContactos.some((c: any) => {
          const { number: dbPhone } = cleanWhatsAppNumber(
            c.phone || (c.chat_jid ? c.chat_jid.split("@")[0] : "")
          );
          return dbPhone === cleanPhone;
        });

        if (!exists) {
          const chatJid = `${cleanPhone}@s.whatsapp.net`;
          const hasConvenio =
            sol.convenio_uflo?.toLowerCase() === "sí" || sol.convenio_uflo?.toLowerCase() === "si";
          const newContact = {
            chat_jid: chatJid,
            phone: cleanPhone,
            nombre_contacto: sol.nombre_institucion || "Institución de Solicitud",
            tipo: hasConvenio ? "institucion_con_convenio" : "sin_convenio",
            clasificado_por: "hermes",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (isTestingMode) {
            await mockDb.create("whatsapp_contactos", newContact);
          } else {
            await supabase.from("whatsapp_contactos").insert(newContact);
          }
          updated = true;
        }
      }
      if (updated) {
        refetchContacts();
      }
    };
    syncContacts();
  }, [solicitudesIngreso, whatsappContactos, isTestingMode]);

  // 2. QUERY EGRESO (finalizacion_pps)
  const { data: solicitudesEgreso = [], isLoading: loadingEgreso } = useQuery<
    FinalizacionWithStudent[]
  >({
    queryKey: ["adminFinalizacionPPS", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const mockRequests = await mockDb.getAll("finalizacion_pps");
        const students = await mockDb.getAll("estudiantes");
        const studentMap = new Map<string, any>(students.map((s: any) => [s.id, s]));

        return mockRequests.map((req: any) => {
          const sId = req[FIELD_ESTUDIANTE_FINALIZACION];
          const student = studentMap.get(sId);
          return {
            ...req,
            id: String(req.id),
            studentName: student?.[FIELD_NOMBRE_ESTUDIANTES] || "Desconocido",
            studentLegajo: student?.[FIELD_LEGAJO_ESTUDIANTES] || "---",
            studentEmail: student?.[FIELD_CORREO_ESTUDIANTES] || "",
            createdTime: req.created_at || new Date().toISOString(),
          };
        });
      }

      const { records: finalizationsRaw, error: finError } = await fetchAllData(
        TABLE_FINALIZACION,
        [
          FIELD_FECHA_SOLICITUD_FINALIZACION,
          FIELD_ESTADO_FINALIZACION,
          FIELD_ESTUDIANTE_FINALIZACION,
          FIELD_INFORME_FINAL_FINALIZACION,
          FIELD_PLANILLA_HORAS_FINALIZACION,
          FIELD_PLANILLA_ASISTENCIA_FINALIZACION,
          FIELD_SUGERENCIAS_MEJORAS_FINALIZACION,
        ]
      );

      if (finError)
        throw new Error(
          typeof finError.error === "string" ? finError.error : finError.error.message
        );

      const finalizations = finalizationsRaw.map(mapFinalizacion);
      const studentIds = [
        ...new Set(
          finalizations.map((r) => safeGetId(r[FIELD_ESTUDIANTE_FINALIZACION])).filter(Boolean)
        ),
      ];

      const { records: studentsRaw } = await fetchAllData(
        TABLE_ESTUDIANTES,
        [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_CORREO_ESTUDIANTES],
        { id: studentIds as string[] }
      );
      const students = studentsRaw.map(mapEstudiante);
      const studentMap = new Map(students.map((s) => [s.id, s]));

      return finalizations.map((req) => {
        const sId = safeGetId(req[FIELD_ESTUDIANTE_FINALIZACION]);
        const student = sId ? studentMap.get(sId) : null;
        return {
          ...req,
          id: String(req.id),
          studentName: student?.[FIELD_NOMBRE_ESTUDIANTES] || "Desconocido",
          studentLegajo: student?.[FIELD_LEGAJO_ESTUDIANTES] || "---",
          studentEmail: student?.[FIELD_CORREO_ESTUDIANTES] || "",
          createdTime: req.createdTime || req.created_at || new Date().toISOString(),
        };
      });
    },
  });

  // 3. MUTATIONS FOR INGRESO
  const updateIngresoMutation = useMutation({
    mutationFn: async ({ recordId, fields }: { recordId: string; fields: any }) => {
      if (isTestingMode) return await mockDb.update("solicitudes_pps", recordId, fields);
      const originalRecord = solicitudesIngreso.find((r) => r.id === recordId);

      if (
        originalRecord &&
        fields[FIELD_ESTADO_PPS] &&
        fields[FIELD_ESTADO_PPS] !== originalRecord[FIELD_ESTADO_PPS]
      ) {
        await sendSmartEmail("solicitud", {
          studentName: originalRecord._studentName ?? undefined,
          studentEmail: originalRecord._studentEmail ?? undefined,
          institution: originalRecord.nombre_institucion ?? undefined,
          newState: fields[FIELD_ESTADO_PPS],
          notes: fields.notas || originalRecord.notas || undefined,
        });
      }
      return db.solicitudes.update(recordId, fields);
    },
    onSuccess: () => {
      showToast("Solicitud actualizada.");
      queryClient.invalidateQueries({ queryKey: ["adminSolicitudesPPS", isTestingMode] });
    },
    onError: (err: any) => showToast(`Error: ${err.message}`, "error"),
  });

  const deleteIngresoMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isTestingMode) return await mockDb.delete("solicitudes_pps", id);
      await db.solicitudes.delete(id);
    },
    onSuccess: () => {
      showToast("Solicitud eliminada.");
      queryClient.invalidateQueries({ queryKey: ["adminSolicitudesPPS", isTestingMode] });
      setIdToDelete(null);
    },
    onError: (err: any) => {
      showToast(`Error: ${err.message}`, "error");
      setIdToDelete(null);
    },
  });

  // 4. MUTATIONS FOR EGRESO
  const updateEgresoMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const request = solicitudesEgreso.find((r) => r.id === id);
      if (!request) throw new Error("Solicitud no encontrada");

      if (isTestingMode) {
        await mockDb.update("finalizacion_pps", id, { [FIELD_ESTADO_FINALIZACION]: status });
        return { emailSuccess: true };
      }

      await db.finalizacion.update(id, { [FIELD_ESTADO_FINALIZACION]: status });
      let emailResult: { success: boolean; message?: string } = {
        success: true,
        message: "No se requiere email",
      };

      if (status === "Cargado") {
        const sId = safeGetId(request[FIELD_ESTUDIANTE_FINALIZACION]);
        if (sId) {
          await db.estudiantes.update(sId, {
            [FIELD_ESTADO_ESTUDIANTES]: "Finalizado",
            [FIELD_FECHA_FINALIZACION_ESTUDIANTES]: new Date().toISOString(),
          });
        }
        if (request.studentEmail) {
          emailResult = await sendSmartEmail("sac", {
            studentName: request.studentName,
            studentEmail: request.studentEmail,
            ppsName: "Práctica Profesional Supervisada",
          });
        }
      }
      return { emailSuccess: emailResult.success, emailMessage: emailResult.message };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminFinalizacionPPS", isTestingMode] });
      if (variables.status === "Cargado") {
        if (data.emailSuccess) {
          showToast("Acreditación confirmada y email enviado.");
        } else {
          showToast(`Cargado con éxito, pero falló el email: ${data.emailMessage}`, "warning");
        }
      } else {
        showToast("Estado actualizado correctamente.");
      }
    },
    onError: (err: any) => showToast(`Error al actualizar: ${err.message}`, "error"),
  });

  const deleteEgresoMutation = useMutation({
    mutationFn: async (record: any) => {
      const sId = safeGetId(record[FIELD_ESTUDIANTE_FINALIZACION]);
      if (sId) {
        const updateFields = {
          [FIELD_FECHA_FINALIZACION_ESTUDIANTES]: null,
          [FIELD_ESTADO_ESTUDIANTES]: "Activo",
        };
        if (isTestingMode) await mockDb.update("estudiantes", String(sId), updateFields);
        else await db.estudiantes.update(String(sId), updateFields);
      }
      if (isTestingMode) await mockDb.delete("finalizacion_pps", record.id);
      else {
        const { error } = await deleteFinalizationRequest(record.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      showToast("Solicitud eliminada y estado revertido.");
      queryClient.invalidateQueries({ queryKey: ["adminFinalizacionPPS", isTestingMode] });
      queryClient.invalidateQueries({ queryKey: ["student"] });
    },
  });

  // Dynamic values
  const counts = useMemo(() => {
    return {
      ingreso: solicitudesIngreso.filter(
        (s) =>
          !["Realizada", "No se pudo concretar", "Archivado"].includes(s.estado_seguimiento || "")
      ).length,
      egreso: solicitudesEgreso.filter((s) => s.estado !== "Cargado" && s.estado !== "Finalizada")
        .length,
      correcciones: 0, // calculated below in subcomponent or query
    };
  }, [solicitudesIngreso, solicitudesEgreso]);

  const handleOpenEmailReview = (req: SolicitudPPSWithStudent) => {
    const institutionName = getInstitutionNameFromRequest(req);
    if (!req.email_institucion) return;

    const draft = buildInstitutionContactDraft({
      studentName: req._studentName,
      institution: institutionName,
      institutionEmail: req.email_institucion,
    });

    // Explicitly cast to include the studentName context
    setEmailReview({
      ...draft,
      studentName: req._studentName,
    } as any);
  };

  const handleSendEmailToInstitution = async () => {
    if (!emailReview) return;
    setIsSendingEmail(true);
    try {
      const studentName = (emailReview as any).studentName || "Estudiante";
      const result = await sendSmartEmail("contacto_institucion", {
        studentName,
        studentEmail: emailReview.to,
        institution: emailReview.institution,
        institutionEmail: emailReview.to,
        customSubject: emailReview.subject,
        customBody: emailReview.body,
      });

      if (result.success) {
        setEmailReview(null);
        showToast("Email enviado a la institución.");
      } else {
        showToast(result.message || "Error al enviar email", "error");
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendBorrador = async (subject: string, body: string) => {
    if (!borradorHermes) return;
    try {
      const result = await sendSmartEmail("contacto_institucion", {
        studentName: borradorHermes.sol._studentName,
        studentEmail: borradorHermes.to,
        institution: borradorHermes.institution,
        institutionEmail: borradorHermes.to,
        customSubject: subject,
        customBody: body,
      });
      if (result.success) {
        // Register immediate sent event in gmail_hilos
        const newGmailThread = {
          thread_id: `sent_${Date.now()}`,
          asunto: subject,
          ultimo_mensaje_at: new Date().toISOString(),
          ultimo_mensaje_de: "nos",
          estado: "respondido_por_nos",
          email_institucion: borradorHermes.to,
          participantes: [borradorHermes.to, "luis.battaglia@uflouni.edu.ar"],
          ingested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          clasificacion: "contacto_institucion",
        };

        if (isTestingMode) {
          await mockDb.create("gmail_hilos", newGmailThread);
        } else {
          await supabase.from("gmail_hilos").insert(newGmailThread);
        }
        refetchGmail();

        setBorradorHermes(null);
        showToast("Borrador enviado.");
        if (borradorHermes.sol.estado_seguimiento === "Pendiente") {
          updateIngresoMutation.mutate({
            recordId: borradorHermes.sol.id,
            fields: { [FIELD_ESTADO_PPS]: "En conversaciones" },
          });
        }
      } else {
        showToast(result.message || "Error al enviar correo", "error");
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  const handleWhatsAppContact = async (sol: SolicitudPPSWithStudent) => {
    if (!sol.telefono_institucion) return;
    const { number: cleanPhone, isValid } = cleanWhatsAppNumber(sol.telefono_institucion);
    if (!isValid || !cleanPhone) return;

    const chatJid = `${cleanPhone}@s.whatsapp.net`;
    const messageText = `Contacto iniciado por WhatsApp con ${sol.nombre_institucion || "Institución"}`;
    const newMsg = {
      chat_jid: chatJid,
      from_me: true,
      texto: messageText,
      timestamp: new Date().toISOString(),
    };

    try {
      if (isTestingMode) {
        await mockDb.create("whatsapp_mensajes", newMsg);
      } else {
        await supabase.from("whatsapp_mensajes").insert({
          id: `msg_${Date.now()}`,
          chat_jid: chatJid,
          from_me: true,
          texto: messageText,
          timestamp: new Date().toISOString(),
        });
      }
      refetchMessages();

      const url = getWhatsAppUrl(
        sol.telefono_institucion,
        `Hola, buen día. Soy Coordinador de PPS de UFLO Psicología. Me contactó el estudiante ${sol._studentName} comentándome que estuvo conversando con ustedes sobre la posibilidad de realizar su PPS. Me pongo a disposición para coordinar la firma del convenio formal si están de acuerdo. ¡Muchas gracias!`
      );
      if (url) window.open(url, "_blank");
    } catch (e: any) {
      logger.error(e);
      showToast("Error al registrar contacto de WhatsApp", "error");
    }
  };

  // Switch views
  const renderTabContent = () => {
    if (tab === "ingreso") {
      return (
        <IngresoTabView
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          list={solicitudesIngreso}
          expandedId={expandedId}
          onToggle={handleToggleCard}
          onDelete={setIdToDelete}
          onUpdate={updateIngresoMutation.mutate}
          onToast={showToast}
          onContactMail={handleOpenEmailReview}
          gmailHilos={gmailHilos}
          whatsappMensajes={whatsappMensajes}
          whatsappContactos={whatsappContactos}
          onContactWhatsApp={handleWhatsAppContact}
          onOpenBorrador={(sol) => {
            const institutionName = getInstitutionNameFromRequest(sol);
            setBorradorHermes({
              generando: false,
              confidence: 0.92,
              requiereDecision: !sol.convenio_uflo || sol.convenio_uflo.toLowerCase() !== "sí",
              motivo: "Falta formalizar convenio con la institución.",
              to: sol.email_institucion || "—",
              institution: institutionName,
              subject: `Prácticas profesionales · ${sol._studentName} — UFLO Psicología`,
              body: `Hola, ${institutionName}:

Soy Coordinador de PPS de UFLO Psicología. Me contactó el estudiante ${sol._studentName} (legajo ${sol._studentLegajo}) comentándome su interés en realizar las prácticas profesionales supervisadas con ustedes.

Me pongo a disposición para coordinar los aspectos formales y académicos del convenio de prácticas.

Muchas gracias.
Coordinación de PPS
UFLO Universidad`,
              sol,
            });
          }}
        />
      );
    } else if (tab === "egreso") {
      return (
        <EgresoTabView
          search={search}
          setSearch={setSearch}
          list={solicitudesEgreso}
          expandedId={expandedId}
          onToggle={handleToggleCard}
          onUpdateStatus={(id, s) => updateEgresoMutation.mutate({ id, status: s })}
          onDelete={deleteEgresoMutation.mutate}
          onToast={showToast}
        />
      );
    } else if (tab === "correcciones") {
      return (
        <CorreccionesTabView
          filter={filter}
          setFilter={setFilter}
          expandedId={expandedId}
          onToggle={handleToggleCard}
          onToast={showToast}
          onReject={setRejecting}
          onUpdateCounts={(count) => {
            // Count can trigger React update if needed, handled inside
          }}
        />
      );
    }
    return null;
  };

  return (
    <div className="solicitudes-v3" style={{ minHeight: "100vh" }}>
      <style>{`
        .solicitudes-v3 .modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(20, 19, 16, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 24px;
          animation: sm-fadeIn .15s ease;
        }
        .solicitudes-v3 .modal-card {
          background: var(--paper);
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow: auto;
          border: 1px solid var(--rule-2);
          box-shadow: 0 24px 80px rgba(20, 19, 16, 0.2);
        }
        @keyframes sm-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 32px 80px" }}>
        {/* Page head */}
        <div
          className="sol-masthead"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "12px 0 20px",
            borderBottom: "1px solid var(--rule-2)",
            marginBottom: 22,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow">Panel académico · PPS</span>
            <h1
              style={{
                margin: "6px 0 0",
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 44,
                fontStyle: "normal",
                fontWeight: 400,
                lineHeight: 1.0,
                letterSpacing: "-0.015em",
                color: "var(--ink)",
              }}
            >
              Solicitudes
            </h1>
          </div>
          {/* Privacy Chip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 12px",
              borderRadius: 999,
              background: "var(--ai-soft)",
              color: "var(--ai)",
              fontSize: 11.5,
              fontWeight: 500,
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              shield_lock
            </span>
            <span>
              Hermes ve historial de Gmail + WhatsApp (lista PPS) para instituciones activas.
            </span>
          </div>
        </div>

        {/* Dynamic subtabs */}
        <SubTabs
          tabs={[
            { id: "ingreso", label: "Ingreso", icon: "login", count: counts.ingreso },
            { id: "egreso", label: "Egreso", icon: "logout", count: counts.egreso },
            {
              id: "correcciones",
              label: "Correcciones",
              icon: "edit_note",
              count: counts.correcciones,
            },
          ]}
          active={tab}
          onChange={(newTab) => {
            setTab(newTab);
            setSearch("");
            setFilter("all");
            setExpandedId(null);
          }}
        />

        <div style={{ marginTop: 20 }}>{renderTabContent()}</div>
      </main>

      {/* Reject Modal */}
      {rejecting && (
        <RejectModal
          sol={rejecting}
          onClose={() => setRejecting(null)}
          onConfirm={async (comentario) => {
            try {
              if (rejecting.tipo_solicitud === "modificacion") {
                await rejectSolicitudModificacion(rejecting.id, comentario);
              } else {
                await rejectSolicitudNuevaPPS(rejecting.id, comentario);
              }
              showToast("Solicitud rechazazada. Se notificó al alumno.");
              queryClient.invalidateQueries({ queryKey: ["solicitudes_modificacion"] });
              queryClient.invalidateQueries({ queryKey: ["solicitudes_nueva_pps"] });
              setRejecting(null);
            } catch (e: any) {
              showToast(e.message || "Error al rechazar", "error");
            }
          }}
        />
      )}

      {/* Confirm deletion of Ingreso */}
      {idToDelete && (
        <ConfirmModal
          isOpen={!!idToDelete}
          title="¿Eliminar solicitud de ingreso?"
          message="Esta acción es permanente y no se puede deshacer."
          confirmText="Eliminar"
          type="danger"
          onConfirm={() => deleteIngresoMutation.mutate(idToDelete)}
          onClose={() => setIdToDelete(null)}
        />
      )}

      {/* Email drafts panels */}
      {emailReview && (
        <EmailReviewModal
          draft={emailReview}
          isSending={isSendingEmail}
          onChange={setEmailReview}
          onClose={() => setEmailReview(null)}
          onSend={handleSendEmailToInstitution}
        />
      )}

      {borradorHermes && (
        <BorradorModal
          state={borradorHermes}
          onClose={() => setBorradorHermes(null)}
          onSend={handleSendBorrador}
        />
      )}

      {/* Live feedback toasts */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

// ─── Hermes Solicitude Tracking Editorial ────────────────────────────
const HermesSolicitudesEditorial: React.FC<{
  list: SolicitudPPSWithStudent[];
  gmailHilos: any[];
  whatsappMensajes: any[];
  whatsappContactos: any[];
}> = ({ list, gmailHilos, whatsappMensajes, whatsappContactos }) => {
  const activeSols = useMemo(() => {
    return list.filter(
      (s) =>
        !["Realizada", "No se pudo concretar", "Archivado"].includes(s.estado_seguimiento || "")
    );
  }, [list]);

  const underConv = useMemo(() => {
    return activeSols.filter(
      (s) =>
        s.estado_seguimiento === "En conversaciones" ||
        s.estado_seguimiento === "Realizando convenio"
    ).length;
  }, [activeSols]);

  const stagnantCount = useMemo(() => {
    return activeSols.filter((s) => s._daysSinceUpdate > 4).length;
  }, [activeSols]);

  const noConvenioCount = useMemo(() => {
    return activeSols.filter((s) => !s.convenio_uflo || s.convenio_uflo.toLowerCase() !== "sí")
      .length;
  }, [activeSols]);

  // Take the 3 most recent tracking logs across all active solicitudes
  const recentActions = useMemo(() => {
    const actions: any[] = [];

    activeSols.forEach((sol) => {
      const { number: cleanPhone } = cleanWhatsAppNumber(sol.telefono_institucion);

      // last whatsapp message
      if (cleanPhone) {
        const msgs = whatsappMensajes.filter((m) => {
          if (!m.chat_jid) return false;
          const { number: msgPhone } = cleanWhatsAppNumber(m.chat_jid.split("@")[0]);
          return msgPhone === cleanPhone;
        });
        if (msgs.length > 0) {
          const lastMsg = msgs[0];
          actions.push({
            institucion: sol.nombre_institucion || "Institución",
            alumno: sol._studentName,
            canal: "whatsapp",
            fromMe: lastMsg.from_me,
            texto: lastMsg.texto,
            timestamp: new Date(lastMsg.timestamp),
            hace: timeAgo(lastMsg.timestamp),
          });
        }
      }

      // last email thread
      if (sol.email_institucion) {
        const email = sol.email_institucion.toLowerCase().trim();
        const threads = gmailHilos.filter((t) => {
          const matchesEmail =
            t.participantes && JSON.stringify(t.participantes).toLowerCase().includes(email);
          const matchesDirect =
            t.email_institucion && t.email_institucion.toLowerCase().includes(email);
          return matchesEmail || matchesDirect;
        });
        if (threads.length > 0) {
          const lastThread = threads[0];
          actions.push({
            institucion: sol.nombre_institucion || "Institución",
            alumno: sol._studentName,
            canal: "mail",
            fromMe: lastThread.ultimo_mensaje_de === "nos",
            texto: lastThread.asunto,
            timestamp: new Date(
              lastThread.ultimo_mensaje_at || lastThread.primer_mensaje_at || Date.now()
            ),
            hace: timeAgo(lastThread.ultimo_mensaje_at),
          });
        }
      }
    });

    // Sort descending by timestamp and take top 3
    actions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return actions.slice(0, 3);
  }, [activeSols, gmailHilos, whatsappMensajes]);

  return (
    <div
      style={{
        border: "1px solid #5A2D8626",
        borderRadius: 20,
        overflow: "hidden",
        background: "var(--paper)",
        marginBottom: 20,
        boxShadow: "0 4px 20px rgba(90, 45, 134, 0.05)",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--rule-2)",
          background: "var(--ai-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="material-icons" style={{ fontSize: 16, color: "var(--ai)" }}>
            auto_awesome
          </span>
          <span className="label" style={{ color: "var(--ai)", letterSpacing: "0.08em" }}>
            Hermes · Resumen de Seguimiento
          </span>
        </div>
        <span className="meta" style={{ fontSize: 11, color: "var(--ai)", fontWeight: 600 }}>
          MONITOREO ACTIVO
        </span>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Lead Summary */}
        <div style={{ borderLeft: "2px solid var(--ai)", paddingLeft: 12 }}>
          <p
            className="serif"
            style={{
              margin: 0,
              fontSize: 17,
              fontStyle: "normal",
              fontWeight: 700,
              color: "var(--ink-2)",
              lineHeight: 1.4,
            }}
          >
            {activeSols.length === 0
              ? "No tenés solicitudes activas bajo gestión en este momento."
              : `Bajo gestión: ${activeSols.length} solicitudes de ingreso. Hay ${underConv} en conversaciones activas de convenio y ${stagnantCount} estancadas sin movimiento.`}
          </p>
        </div>

        {/* Metrics Row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 12,
              border: "1px solid var(--rule-2)",
              background: "var(--paper-2)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span className="material-icons" style={{ fontSize: 14, color: "var(--accent)" }}>
              chat
            </span>
            <span>{underConv} en conversaciones</span>
          </div>
          {stagnantCount > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 12,
                border: "1px solid #B4501E33",
                background: "var(--warn-soft)",
                color: "var(--warn)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                timer
              </span>
              <span>{stagnantCount} sin movimiento (+4d)</span>
            </div>
          )}
          {noConvenioCount > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 12,
                border: "1px solid #A6293A33",
                background: "var(--crit-soft)",
                color: "var(--crit)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                pending_actions
              </span>
              <span>{noConvenioCount} sin convenio</span>
            </div>
          )}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 12,
              border: "1px solid var(--rule-2)",
              background: "var(--paper-2)",
              fontSize: 12,
              fontWeight: 700,
              marginLeft: "auto",
            }}
          >
            <span className="material-icons" style={{ fontSize: 14, color: "var(--ai)" }}>
              contacts
            </span>
            <span>{whatsappContactos.length} contactos en lista PPS</span>
          </div>
        </div>

        {/* Recent Actions list */}
        {recentActions.length > 0 && (
          <div style={{ borderTop: "1px solid var(--rule-2)", paddingTop: 14 }}>
            <div className="label" style={{ marginBottom: 8, fontSize: 10 }}>
              ÚLTIMAS COMUNICACIONES REGISTRADAS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentActions.map((act, idx) => {
                const color = act.canal === "whatsapp" ? "#2F8F43" : "var(--accent)";
                const icon = act.canal === "whatsapp" ? "chat" : "mail";
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: "var(--paper-2)",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 15, color }}>
                      {icon}
                    </span>
                    <span style={{ fontWeight: 600 }}>{act.institucion}</span>
                    <span style={{ color: "var(--ink-3)" }}>({act.alumno})</span>
                    <span style={{ color: "var(--ink-4)", margin: "0 2px" }}>·</span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        color: "var(--ink-2)",
                      }}
                    >
                      {act.fromMe ? "→ " : ""}
                      {act.texto}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-3)",
                        marginLeft: "auto",
                        flexShrink: 0,
                      }}
                    >
                      {act.hace}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TABS CONTENT: INGRESO ──────────────────────────────────────────
interface IngresoTabViewProps {
  search: string;
  setSearch: (s: string) => void;
  filter: string;
  setFilter: (f: string) => void;
  list: SolicitudPPSWithStudent[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (params: { recordId: string; fields: any }) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onContactMail: (sol: SolicitudPPSWithStudent) => void;
  onOpenBorrador: (sol: SolicitudPPSWithStudent) => void;
  gmailHilos: any[];
  whatsappMensajes: any[];
  whatsappContactos: any[];
  onContactWhatsApp: (sol: SolicitudPPSWithStudent) => void;
}

const IngresoTabView: React.FC<IngresoTabViewProps> = ({
  search,
  setSearch,
  filter,
  setFilter,
  list,
  expandedId,
  onToggle,
  onDelete,
  onUpdate,
  onToast,
  onContactMail,
  onOpenBorrador,
  gmailHilos,
  whatsappMensajes,
  whatsappContactos,
  onContactWhatsApp,
}) => {
  const norm = (s: string) => (s || "").toLowerCase();

  const filtered = useMemo(() => {
    const q = norm(search);
    return list.filter((s) => {
      // 1. Search filter
      const matchesSearch =
        !q ||
        norm(s._studentName).includes(q) ||
        norm(s._studentLegajo).includes(q) ||
        norm(s.nombre_institucion || "").includes(q);

      if (!matchesSearch) return false;

      // 2. Tab filter
      if (filter === "all") return true;
      if (filter === "priorizo") {
        return !s.convenio_uflo || s.convenio_uflo.toLowerCase() !== "sí";
      }
      if (filter === "sin_mov") {
        return (
          s._daysSinceUpdate > 4 &&
          !["Realizada", "No se pudo concretar", "Archivado"].includes(s.estado_seguimiento || "")
        );
      }
      return s.estado_seguimiento === filter;
    });
  }, [list, search, filter]);

  const isHistory = (s: any) =>
    ["Realizada", "No se pudo concretar", "Archivado"].includes(s.estado_seguimiento || "");
  const pendingList = filtered.filter((s) => !isHistory(s));
  const historyList = filtered.filter(isHistory);

  const opts = [
    { value: "all", label: "Todas", count: list.length },
    {
      value: "priorizo",
      label: "Falta Convenio",
      icon: "auto_awesome",
      tone: "ai" as const,
      count: list.filter((s) => !s.convenio_uflo || s.convenio_uflo.toLowerCase() !== "sí").length,
    },
    {
      value: "sin_mov",
      label: "Sin movimiento +4d",
      icon: "timer",
      tone: "warn" as const,
      count: list.filter(
        (s) =>
          s._daysSinceUpdate > 4 &&
          !["Realizada", "No se pudo concretar", "Archivado"].includes(s.estado_seguimiento || "")
      ).length,
    },
    { value: "Pendiente", label: "Pendiente" },
    { value: "En conversaciones", label: "En conversaciones" },
    { value: "Realizando convenio", label: "Realizando convenio" },
    { value: "Realizada", label: "Realizada" },
  ];

  const goGestion = () => {
    try {
      localStorage.setItem("gestion-view-mode", "instituciones");
    } catch {}
    window.location.href = "#/admin/gestion?view=instituciones";
  };

  return (
    <div>
      {/* Editorial brief panel */}
      <HermesSolicitudesEditorial
        list={list}
        gmailHilos={gmailHilos}
        whatsappMensajes={whatsappMensajes}
        whatsappContactos={whatsappContactos}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por alumno, legajo o institución…"
        />
        <span className="meta">{filtered.length} solicitudes</span>
      </div>
      <div style={{ marginBottom: 20 }}>
        <FilterTabs options={opts} value={filter} onChange={setFilter} />
      </div>

      {pendingList.length === 0 && historyList.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Sin solicitudes"
          msg="No se encontraron registros con los filtros actuales."
        />
      ) : (
        <>
          {pendingList.length > 0 && (
            <>
              {/* Group header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: "4px 0 12px",
                  paddingLeft: 2,
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }}
                ></span>
                <span className="label">Pendientes de gestión ({pendingList.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingList.map((sol) => (
                  <IngresoCardItem
                    key={sol.id}
                    sol={sol}
                    expanded={expandedId === sol.id}
                    onToggle={() => onToggle(sol.id)}
                    onDelete={onDelete}
                    onUpdate={onUpdate}
                    onToast={onToast}
                    onVerGestion={goGestion}
                    onContactMail={onContactMail}
                    onOpenBorrador={onOpenBorrador}
                    gmailHilos={gmailHilos}
                    whatsappMensajes={whatsappMensajes}
                    onContactWhatsApp={onContactWhatsApp}
                  />
                ))}
              </div>
            </>
          )}

          {historyList.length > 0 && (
            <CollapsibleHistory count={historyList.length}>
              {historyList.map((sol) => (
                <IngresoCardItem
                  key={sol.id}
                  sol={sol}
                  expanded={expandedId === sol.id}
                  onToggle={() => onToggle(sol.id)}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  onToast={onToast}
                  onVerGestion={goGestion}
                  onContactMail={onContactMail}
                  onOpenBorrador={onOpenBorrador}
                  gmailHilos={gmailHilos}
                  whatsappMensajes={whatsappMensajes}
                  onContactWhatsApp={onContactWhatsApp}
                />
              ))}
            </CollapsibleHistory>
          )}
        </>
      )}
    </div>
  );
};

// ─── INGRESO CARD ITEM ──────────────────────────────────────────────
interface IngresoCardItemProps {
  sol: SolicitudPPSWithStudent;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onUpdate: (params: { recordId: string; fields: any }) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onVerGestion: () => void;
  onContactMail: (sol: SolicitudPPSWithStudent) => void;
  onOpenBorrador: (sol: SolicitudPPSWithStudent) => void;
  gmailHilos: any[];
  whatsappMensajes: any[];
  onContactWhatsApp: (sol: SolicitudPPSWithStudent) => void;
}

const IngresoCardItem: React.FC<IngresoCardItemProps> = ({
  sol,
  expanded,
  onToggle,
  onDelete,
  onUpdate,
  onToast,
  onVerGestion,
  onContactMail,
  onOpenBorrador,
  gmailHilos,
  whatsappMensajes,
  onContactWhatsApp,
}) => {
  const [estado, setEstado] = useState(sol.estado_seguimiento || "Pendiente");
  const [notas, setNotas] = useState(sol.notas || "");

  const hasConvenio =
    sol.convenio_uflo?.toLowerCase() === "sí" || sol.convenio_uflo?.toLowerCase() === "si";
  const hasTutor =
    sol.tutor_disponible?.toLowerCase() === "sí" || sol.tutor_disponible?.toLowerCase() === "si";
  const isNoCatalogada =
    sol.convenio_uflo?.toLowerCase().includes("cat") ||
    sol.convenio_uflo?.toLowerCase() === "no catalogada";

  const isStagnant =
    sol._daysSinceUpdate > 4 &&
    !["Realizada", "No se pudo concretar", "Archivado"].includes(sol.estado_seguimiento || "");

  const dirty = estado !== (sol.estado_seguimiento || "Pendiente") || notas !== (sol.notas || "");

  // Tone color mapper
  const getTone = (est: string) => {
    const e = (est || "").toLowerCase();
    if (e === "pendiente") return { c: "var(--warn)", s: "var(--warn-soft)" };
    if (e === "en conversaciones") return { c: "var(--accent)", s: "var(--accent-soft)" };
    if (e === "realizando convenio") return { c: "var(--ai)", s: "var(--ai-soft)" };
    if (e === "realizada") return { c: "var(--ok)", s: "var(--ok-soft)" };
    return { c: "var(--ink-3)", s: "var(--paper-2)" };
  };
  const tone = getTone(estado);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({
      recordId: sol.id,
      fields: {
        [FIELD_ESTADO_PPS]: estado,
        notas,
      },
    });
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContactWhatsApp(sol);
  };

  return (
    <div
      data-solicitud-id={sol.id}
      style={{
        border: `1px solid ${expanded ? "var(--ink)" : isStagnant ? "#B4501E44" : "var(--rule-2)"}`,
        borderRadius: 14,
        background: isStagnant && !expanded ? "var(--warn-soft)" : "var(--paper)",
        overflow: "hidden",
        position: "relative",
        transition: "all .12s ease",
      }}
    >
      {/* accent rail */}
      <div
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tone.c }}
      ></div>

      {/* Collapsed header */}
      <div
        onClick={onToggle}
        style={{
          padding: "15px 18px 15px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              flexShrink: 0,
              background: expanded ? "var(--ink)" : "var(--paper-2)",
              color: expanded ? "var(--paper)" : "var(--ink-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {sol._studentName.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--ink)",
                  letterSpacing: "-0.01em",
                }}
              >
                {sol.nombre_institucion || "Institución propuesta"}
              </h4>
              {/* Convenio badge */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px 2px 6px",
                  borderRadius: 999,
                  background: hasConvenio
                    ? "var(--ok-soft)"
                    : isNoCatalogada
                      ? "var(--crit-soft)"
                      : "var(--warn-soft)",
                  color: hasConvenio ? "var(--ok)" : isNoCatalogada ? "var(--crit)" : "var(--warn)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                <span className="material-icons" style={{ fontSize: 12 }}>
                  {hasConvenio ? "verified" : isNoCatalogada ? "help" : "pending"}
                </span>
                {hasConvenio ? "Con convenio" : isNoCatalogada ? "No catalogada" : "Sin convenio"}
              </span>

              {isStagnant && (
                <span
                  className="dot-live"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--warn-soft)",
                    color: "var(--warn)",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 11 }}>
                    timer
                  </span>
                  {sol._daysSinceUpdate} d sin novedad
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <span
                className="meta"
                style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}
              >
                {sol._studentName}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--paper-2)",
                  color: "var(--ink-3)",
                }}
              >
                {sol._studentLegajo}
              </span>
              {!hasConvenio && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "2px 8px 2px 6px",
                    borderRadius: 999,
                    background: "var(--ai-soft)",
                    color: "var(--ai)",
                    fontSize: 10.5,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 12 }}>
                    auto_awesome
                  </span>
                  Prioridad Hermes
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              background: tone.s,
              color: tone.c,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
            }}
          >
            {estado}
          </span>
          <span
            className="material-icons"
            style={{
              fontSize: 20,
              color: "var(--ink-4)",
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform .2s ease",
            }}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--rule-2)",
            padding: 18,
            background: "var(--paper-2)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {isNoCatalogada && (
            <div
              style={{
                border: "1px solid var(--crit)",
                borderRadius: 12,
                overflow: "hidden",
                background: "var(--crit-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 16 }}>
                <span
                  className="material-icons"
                  style={{ fontSize: 18, color: "var(--crit)", flexShrink: 0, marginTop: 1 }}
                >
                  error
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                    Esta institución no está en el catálogo
                  </div>
                  <div className="meta" style={{ fontSize: 12, marginTop: 3 }}>
                    El estudiante ingresó la institución de forma manual. Podés agregarla desde el
                    administrador de catálogos.
                  </div>
                </div>
                <button
                  onClick={onVerGestion}
                  className="btn btn-mail btn-sm press"
                  style={{ flexShrink: 0 }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    add_business
                  </span>
                  Ir al catálogo
                </button>
              </div>
            </div>
          )}

          {/* Grids */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--rule-2)",
                }}
              >
                <span className="material-icons" style={{ fontSize: 15, color: "var(--ink-4)" }}>
                  business
                </span>
                <span className="label">Datos institucionales</span>
              </div>
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}
              >
                <DataItem label="Localidad" value={sol.localidad} icon="location_on" />
                <DataItem label="Referente" value={sol.referente_institucion} icon="person" />
                <DataItem label="Email" value={sol.email_institucion} icon="mail" />
                <DataItem label="Teléfono" value={sol.telefono_institucion} icon="phone" />
                <DataItem label="Dirección" value={sol.direccion_completa} icon="map" full />
                <DataItem
                  label="Tutor de Psicología"
                  value={sol.contacto_tutor}
                  icon="psychology"
                  full
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--rule-2)",
                }}
              >
                <span className="material-icons" style={{ fontSize: 15, color: "var(--ink-4)" }}>
                  description
                </span>
                <span className="label">Detalles de la práctica</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 10 }}>
                <DataItem label="Modalidad" value={sol.tipo_practica} icon="group_work" />
                <DataItem
                  label="Descripción de actividades"
                  value={sol.descripcion_institucion}
                  icon="article"
                  full
                />
              </div>
            </div>
          </div>

          {/* Hermes AI criteria panel */}
          <PanelHermesIngreso
            sol={sol}
            onVerGestion={onVerGestion}
            gmailHilos={gmailHilos}
            whatsappMensajes={whatsappMensajes}
          />

          {/* Internal management */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                paddingBottom: 8,
                borderBottom: "1px solid var(--rule-2)",
              }}
            >
              <span className="material-icons" style={{ fontSize: 15, color: "var(--ink-4)" }}>
                tune
              </span>
              <span className="label">Gestión interna</span>
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, marginTop: 10 }}
            >
              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="field"
                  style={{ fontSize: 13, cursor: "pointer" }}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En conversaciones">En conversaciones</option>
                  <option value="Realizando convenio">Realizando convenio</option>
                  <option value="Realizada">Realizada</option>
                  <option value="No se pudo concretar">No se pudo concretar</option>
                  <option value="Archivado">Archivado</option>
                </select>
              </div>
              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Notas internas{" "}
                  <span
                    style={{
                      textTransform: "none",
                      letterSpacing: 0,
                      color: "var(--ink-4)",
                      fontWeight: 400,
                    }}
                  >
                    (visible al alumno si falla)
                  </span>
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  className="field"
                  style={{ fontSize: 13, minHeight: 0 }}
                  placeholder="Bitácora de gestión interna…"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Card footer actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              paddingTop: 4,
            }}
          >
            <button onClick={() => onOpenBorrador(sol)} className="btn btn-ai btn-sm press">
              <span className="material-icons" style={{ fontSize: 15 }}>
                auto_awesome
              </span>
              Borrador con Hermes
            </button>
            {sol.email_institucion && (
              <button onClick={() => onContactMail(sol)} className="btn btn-mail btn-sm press">
                <span className="material-icons" style={{ fontSize: 15 }}>
                  send
                </span>
                Enviar email
              </button>
            )}
            {sol.telefono_institucion && (
              <button
                onClick={handleWhatsApp}
                className="btn btn-sm press"
                style={{ background: "#2F8F4314", color: "#2f8f43", borderColor: "transparent" }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  chat
                </span>
                WhatsApp
              </button>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={onToggle} className="btn btn-ghost btn-sm press">
                Cerrar
              </button>
              <button
                onClick={() => onDelete(sol.id)}
                className="btn btn-ghost btn-sm press text-rose-500"
                style={{ color: "var(--crit)" }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  delete
                </span>
              </button>
              <button
                disabled={!dirty}
                onClick={handleSave}
                className="btn btn-primary btn-sm press"
                style={{ opacity: dirty ? 1 : 0.5 }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  save
                </span>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Collapsible History Group ──────────────────────────────────────
const CollapsibleHistory: React.FC<{ count: number; children: React.ReactNode }> = ({
  count,
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          width: "100%",
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid var(--rule-2)",
          background: "var(--paper)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span className="material-icons" style={{ fontSize: 17, color: "var(--ink-4)" }}>
          history
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Historial</span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            padding: "1px 7px",
            borderRadius: 999,
            background: "var(--paper-2)",
            color: "var(--ink-3)",
          }}
        >
          {count}
        </span>
        <span
          className="material-icons"
          style={{
            fontSize: 18,
            color: "var(--ink-4)",
            marginLeft: "auto",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .2s ease",
          }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ─── TABS CONTENT: EGRESO ───────────────────────────────────────────
interface EgresoTabViewProps {
  search: string;
  setSearch: (s: string) => void;
  list: FinalizacionWithStudent[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onUpdateStatus: (id: string, s: string) => void;
  onDelete: (record: any) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
}

const EgresoTabView: React.FC<EgresoTabViewProps> = ({
  search,
  setSearch,
  list,
  expandedId,
  onToggle,
  onUpdateStatus,
  onDelete,
  onToast,
}) => {
  const norm = (s: string) => (s || "").toLowerCase();

  const filtered = useMemo(() => {
    const q = norm(search);
    return list.filter((s) => {
      return !q || norm(s.studentName).includes(q) || norm(s.studentLegajo).includes(q);
    });
  }, [list, search]);

  const active = filtered.filter((s) => s.estado !== "Cargado" && s.estado !== "Finalizada");
  const history = filtered.filter((s) => s.estado === "Cargado" || s.estado === "Finalizada");

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por estudiante o legajo…"
        />
        <span className="meta">{filtered.length} finalizaciones</span>
      </div>

      {active.length === 0 && history.length === 0 ? (
        <EmptyState
          icon="task_alt"
          title="Sin solicitudes"
          msg="No hay solicitudes de finalización con los filtros actuales."
        />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: "4px 0 12px",
                  paddingLeft: 2,
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: 999, background: "var(--warn)" }}
                ></span>
                <span className="label">Pendientes ({active.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {active.map((sol) => (
                  <EgresoCardItem
                    key={sol.id}
                    sol={sol}
                    expanded={expandedId === sol.id}
                    onToggle={() => onToggle(sol.id)}
                    onUpdateStatus={onUpdateStatus}
                    onDelete={onDelete}
                    onToast={onToast}
                  />
                ))}
              </div>
            </>
          )}

          {history.length > 0 && (
            <CollapsibleHistory count={history.length}>
              {history.map((sol) => (
                <EgresoCardItem
                  key={sol.id}
                  sol={sol}
                  expanded={expandedId === sol.id}
                  onToggle={() => onToggle(sol.id)}
                  onUpdateStatus={onUpdateStatus}
                  onDelete={onDelete}
                  onToast={onToast}
                />
              ))}
            </CollapsibleHistory>
          )}
        </>
      )}
    </div>
  );
};

// ─── EGRESO CARD ITEM ───────────────────────────────────────────────
interface EgresoCardItemProps {
  sol: FinalizacionWithStudent;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, s: string) => void;
  onDelete: (record: any) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
}

const EgresoCardItem: React.FC<EgresoCardItemProps> = ({
  sol,
  expanded,
  onToggle,
  onUpdateStatus,
  onDelete,
  onToast,
}) => {
  const [practice, setPractice] = useState<any>(null);
  const [loadingPrac, setLoadingPrac] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Attachment[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const planillaFiles = useMemo(
    () => normalizeAttachments(sol.planilla_horas_url),
    [sol.planilla_horas_url]
  );
  const informeFiles = useMemo(
    () => normalizeAttachments(sol.informe_final_url),
    [sol.informe_final_url]
  );
  const asistenciaFiles = useMemo(
    () => normalizeAttachments(sol.planilla_asistencia_url),
    [sol.planilla_asistencia_url]
  );
  const allFiles = useMemo(
    () => [...planillaFiles, ...informeFiles, ...asistenciaFiles],
    [planillaFiles, informeFiles, asistenciaFiles]
  );

  const docCount = allFiles.length;

  useEffect(() => {
    let active = true;
    const fetchPractice = async () => {
      const sId = safeGetId(sol[FIELD_ESTUDIANTE_FINALIZACION]);
      if (!sId || !expanded) return;
      setLoadingPrac(true);
      try {
        const { data, error } = await supabase
          .from("practicas")
          .select("*, lanzamientos_pps(nombre_pps, horas_acreditadas, orientacion)")
          .eq("estudiante_id", sId)
          .maybeSingle();

        if (!error && data && active) {
          setPractice(data);
        }
      } catch (e) {
        logger.error(e);
      } finally {
        if (active) setLoadingPrac(false);
      }
    };
    fetchPractice();
    return () => {
      active = false;
    };
  }, [sol, expanded]);

  const isFinalizado =
    sol.estado?.toLowerCase() === "cargado" || sol.estado?.toLowerCase() === "finalizada";
  const isEnProceso = sol.estado?.toLowerCase() === "en proceso";

  let visualStatus = "Pendiente";
  let statusColor = "var(--warn)";
  let statusBg = "var(--warn-soft)";
  if (isFinalizado) {
    visualStatus = "Finalizada";
    statusColor = "var(--ok)";
    statusBg = "var(--ok-soft)";
  } else if (isEnProceso) {
    visualStatus = "En Proceso SAC";
    statusColor = "var(--accent)";
    statusBg = "var(--accent-soft)";
  }

  // Verification checks for Hermes
  const { hermesEstado, checks, issues } = useMemo(() => {
    const checksList: { label: string }[] = [];
    const issuesList: {
      sev: "crit" | "warn";
      label: string;
      cita?: string;
      ref?: string;
    }[] = [];

    // Planilla
    if (planillaFiles.length > 0) {
      checksList.push({ label: "Planilla de horas firmada y adjunta." });
    } else {
      issuesList.push({ sev: "crit" as const, label: "Falta planilla de horas del alumno." });
    }

    // Informe
    if (informeFiles.length > 0) {
      checksList.push({ label: "Informe final cargado y legible." });
      if (sol.sugerencias_mejoras && sol.sugerencias_mejoras.length < 50) {
        issuesList.push({
          sev: "warn" as const,
          label: "Sugerencias de mejora del alumno demasiado breves.",
          cita: `"${sol.sugerencias_mejoras}"`,
          ref: "Conviene indagar opinión del alumno sobre la institución.",
        });
      }
    } else {
      issuesList.push({ sev: "crit" as const, label: "Falta informe final de la práctica." });
    }

    // Asistencia
    if (asistenciaFiles.length > 0) {
      checksList.push({ label: "Constancia de asistencias y firma del tutor confirmada." });
    } else {
      issuesList.push({
        sev: "crit" as const,
        label: "Falta planilla de asistencia institucional.",
      });
    }

    // Hours match
    if (practice) {
      const horasRealizadas = practice.horas_realizadas || 40;
      const horasLanz = practice.lanzamientos_pps?.horas_acreditadas || 40;
      if (horasRealizadas === horasLanz) {
        checksList.push({ label: `Horas totales coinciden con el lanzamiento (${horasLanz}h).` });
      } else {
        issuesList.push({
          sev: "warn" as const,
          label: `Las horas de la práctica (${horasRealizadas}h) no coinciden con el lanzamiento (${horasLanz}h).`,
          ref: `Práctica: ${practice.lanzamientos_pps?.nombre_pps || "Convocatoria"}.`,
        });
      }
    }

    const state: "critico" | "atencion" | "aprobado" = issuesList.some((i) => i.sev === "crit")
      ? "critico"
      : issuesList.some((i) => i.sev === "warn")
        ? "atencion"
        : "aprobado";

    return { hermesEstado: state, checks: checksList, issues: issuesList };
  }, [planillaFiles, informeFiles, asistenciaFiles, sol.sugerencias_mejoras, practice]);

  const hMeta = {
    aprobado: {
      icon: "verified",
      c: "var(--ok)",
      s: "var(--ok-soft)",
      lbl: "Verificado por Hermes",
    },
    atencion: {
      icon: "warning",
      c: "var(--warn)",
      s: "var(--warn-soft)",
      lbl: "Hermes detectó observaciones",
    },
    critico: {
      icon: "error",
      c: "var(--crit)",
      s: "var(--crit-soft)",
      lbl: "Faltan documentos indispensables",
    },
  }[hermesEstado];

  const handleCopyExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dateStr = new Date(sol.createdTime).toLocaleDateString("es-AR");
    const legajo = sol.studentLegajo;
    const name = sol.studentName;
    const text = `${dateStr}\t${legajo}\t${name}`;
    navigator.clipboard.writeText(text);
    onToast("Copiado fila Excel (Fecha, Legajo, Nombre).");
  };

  const handlePreview = async (files: Attachment[], index: number = 0) => {
    const filesWithSigned = await Promise.all(
      files.map(async (f) => {
        const path = getStoragePath(f.url);
        if (!path) return f;
        try {
          const { data, error } = await supabase.storage
            .from("documentos_finalizacion")
            .createSignedUrl(path, 3600);
          if (!error && data) return { ...f, signedUrl: data.signedUrl };
          return f;
        } catch {
          return f;
        }
      })
    );
    setPreviewFiles(filesWithSigned);
    setPreviewIndex(index);
    setIsPreviewOpen(true);
  };

  return (
    <div
      data-solicitud-id={sol.id}
      style={{
        border: `1px solid ${expanded ? "var(--ink)" : "var(--rule-2)"}`,
        borderRadius: 14,
        background: "var(--paper)",
        overflow: "hidden",
        position: "relative",
        transition: "all .12s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: statusColor,
        }}
      ></div>

      {/* Collapsed view */}
      <div
        onClick={onToggle}
        style={{
          padding: "15px 18px 15px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              flexShrink: 0,
              background: expanded ? "var(--ink)" : "var(--paper-2)",
              color: expanded ? "var(--paper)" : "var(--ink-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {sol.studentName.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* verification state dot */}
              <span
                title={hMeta.lbl}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: hMeta.s,
                  color: hMeta.c,
                  flexShrink: 0,
                }}
              >
                <span className="material-icons" style={{ fontSize: 13 }}>
                  {hMeta.icon}
                </span>
              </span>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                {sol.studentName}
              </h4>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--paper-2)",
                  color: "var(--ink-3)",
                }}
              >
                {sol.studentLegajo}
              </span>
              {practice && (
                <span className="meta" style={{ fontSize: 11.5 }}>
                  {practice.nombre_institucion || "Institución"}
                </span>
              )}
              <span className="meta" style={{ fontSize: 11 }}>
                · {formatDate(sol.createdTime)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--ink-3)",
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              attach_file
            </span>
            {docCount}
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              background: statusBg,
              color: statusColor,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
            }}
          >
            {visualStatus}
          </span>
          <span
            className="material-icons"
            style={{
              fontSize: 20,
              color: "var(--ink-4)",
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform .2s ease",
            }}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--rule-2)",
            padding: 18,
            background: "var(--paper-2)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Hermes Verification Panel */}
          <div
            style={{
              border: `1px solid ${hMeta.c}33`,
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--paper)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: hMeta.s,
              }}
            >
              <span className="material-icons" style={{ fontSize: 18, color: hMeta.c }}>
                {hMeta.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  {hMeta.lbl}
                </div>
              </div>
              <span className="label" style={{ color: hMeta.c, fontSize: 9 }}>
                Hermes
              </span>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span
                    className="material-icons"
                    style={{ fontSize: 16, color: "var(--ok)", flexShrink: 0, marginTop: 1 }}
                  >
                    check_circle
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
                    {c.label}
                  </span>
                </div>
              ))}
              {issues.map((iss, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 10,
                    background: iss.sev === "crit" ? "var(--crit-soft)" : "var(--warn-soft)",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span
                      className="material-icons"
                      style={{
                        fontSize: 16,
                        color: iss.sev === "crit" ? "var(--crit)" : "var(--warn)",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {iss.sev === "crit" ? "cancel" : "warning"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                        {iss.label}
                      </div>
                      {iss.ref && (
                        <div
                          style={{
                            marginTop: 4,
                            display: "flex",
                            gap: 7,
                            padding: "6px 8px",
                            borderRadius: 6,
                            background: "var(--paper)",
                            border: "1px solid var(--rule-2)",
                            fontSize: 11.5,
                            color: "var(--ink-3)",
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 12, marginTop: 2 }}>
                            link
                          </span>
                          <span>{iss.ref}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Files grid */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Documentos del alumno
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              {[
                { l: "Planilla de Horas", files: planillaFiles, i: "table_view" },
                { l: "Informe Final", files: informeFiles, i: "description" },
                { l: "Asistencias firmadas", files: asistenciaFiles, i: "fact_check" },
              ].map((sec, idx) => (
                <div key={idx}>
                  <div className="label" style={{ fontSize: 9.5, marginBottom: 6 }}>
                    {sec.l}
                  </div>
                  {sec.files.length > 0 ? (
                    sec.files.map((f, fi) => (
                      <button
                        key={fi}
                        onClick={() => handlePreview(allFiles, allFiles.indexOf(f))}
                        className="press"
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--rule-2)",
                          background: "var(--paper)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: 16, color: "var(--ink-4)" }}
                        >
                          {sec.i}
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "var(--ink-2)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {f.filename}
                        </span>
                      </button>
                    ))
                  ) : (
                    <span className="meta" style={{ fontSize: 11, fontStyle: "italic" }}>
                      No cargado
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sugerencias del alumno */}
          {sol.sugerencias_mejoras && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--paper)",
                border: "1px solid var(--rule-2)",
              }}
            >
              <div className="label" style={{ fontSize: 9.5, marginBottom: 4 }}>
                Comentarios / Sugerencias del alumno
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-2)",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                "{sol.sugerencias_mejoras}"
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              paddingTop: 4,
            }}
          >
            <button onClick={handleCopyExcel} className="btn btn-sm press">
              <span className="material-icons" style={{ fontSize: 15 }}>
                content_copy
              </span>
              Copiar fila Excel
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {!isFinalizado && (
                <>
                  <button
                    onClick={() => onUpdateStatus(sol.id, "En Proceso")}
                    disabled={isEnProceso}
                    className="btn btn-sm press"
                    style={{ opacity: isEnProceso ? 0.5 : 1 }}
                  >
                    En Proceso SAC
                  </button>
                  <button
                    onClick={() => onUpdateStatus(sol.id, "Cargado")}
                    className="btn btn-sm press"
                    style={{
                      background: "var(--ok)",
                      color: "var(--paper)",
                      borderColor: "var(--ok)",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 15 }}>
                      check_circle
                    </span>
                    Confirmar SAC
                  </button>
                </>
              )}
              <button
                onClick={() => onDelete(sol)}
                className="btn btn-ghost btn-sm press text-rose-500"
                style={{ color: "var(--crit)" }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  delete
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF / File Preview container */}
      {isPreviewOpen && (
        <FilePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          files={previewFiles}
          initialIndex={previewIndex}
        />
      )}
    </div>
  );
};

// ─── TABS CONTENT: CORRECCIONES ─────────────────────────────────────
interface CorreccionesTabViewProps {
  filter: string;
  setFilter: (f: string) => void;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onReject: (sol: any) => void;
  onUpdateCounts: (counts: number) => void;
}

const CorreccionesTabView: React.FC<CorreccionesTabViewProps> = ({
  filter,
  setFilter,
  expandedId,
  onToggle,
  onToast,
  onReject,
  onUpdateCounts,
}) => {
  const [subtab, setSubtab] = useState<"modificaciones" | "nuevas">("modificaciones");

  const queryClient = useQueryClient();

  // Fetch modificaciones
  const { data: solicitudesModificacion = [], isLoading: loadingMod } = useQuery<any[]>({
    queryKey: ["solicitudes_modificacion", filter],
    queryFn: () => fetchAllSolicitudesModificacion(filter === "all" ? undefined : filter),
  });

  // Fetch nuevas pps
  const { data: solicitudesNuevas = [], isLoading: loadingNuevas } = useQuery<any[]>({
    queryKey: ["solicitudes_nueva_pps", filter],
    queryFn: () => fetchAllSolicitudesNuevaPPS(filter === "all" ? undefined : filter),
  });

  const allList = useMemo(() => {
    const mods = solicitudesModificacion.map((s) => ({
      ...s,
      tipo_solicitud: "modificacion" as const,
    }));
    const news = solicitudesNuevas.map((s) => ({ ...s, tipo_solicitud: "nueva" as const }));
    const combined = subtab === "modificaciones" ? mods : news;
    return combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [solicitudesModificacion, solicitudesNuevas, subtab]);

  // Update count bubble in parent tabs
  useEffect(() => {
    const pendingTotal =
      solicitudesModificacion.filter((s) => s.estado === "pendiente").length +
      solicitudesNuevas.filter((s) => s.estado === "pendiente").length;

    onUpdateCounts(pendingTotal);
  }, [solicitudesModificacion, solicitudesNuevas, onUpdateCounts]);

  const approveModMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      approveSolicitudModificacion(id, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_modificacion"] });
      onToast("Solicitud de modificación aprobada.");
    },
    onError: (e: any) => onToast(e.message || "Error al aprobar", "error"),
  });

  const approveNuevaMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      approveSolicitudNuevaPPS(id, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_nueva_pps"] });
      queryClient.invalidateQueries({ queryKey: ["practicas"] });
      onToast("Nueva PPS aprobada. Práctica creada exitosamente.");
    },
    onError: (e: any) => onToast(e.message || "Error al aprobar", "error"),
  });

  const opts = [
    { value: "all", label: "Todas", count: allList.length },
    {
      value: "pendiente",
      label: "Pendiente",
      count: allList.filter((s) => s.estado === "pendiente").length,
    },
    {
      value: "aprobada",
      label: "Aprobada",
      count: allList.filter((s) => s.estado === "aprobada").length,
    },
    {
      value: "rechazada",
      label: "Rechazada",
      count: allList.filter((s) => s.estado === "rechazada").length,
    },
  ];

  if (loadingMod || loadingNuevas) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Loader />
      </div>
    );
  }

  return (
    <div>
      {/* inner subtabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "modificaciones" as const, lbl: "Modificaciones", ic: "edit" },
          { id: "nuevas" as const, lbl: "Nuevas PPS", ic: "add_circle" },
        ].map((item) => {
          const on = subtab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setSubtab(item.id);
                setFilter("all");
              }}
              className="press"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 9,
                border: `1px solid ${on ? "var(--ink)" : "var(--rule-2)"}`,
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--paper)" : "var(--ink-2)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span className="material-icons" style={{ fontSize: 15 }}>
                {item.ic}
              </span>
              {item.lbl}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <FilterTabs options={opts} value={filter} onChange={setFilter} />
      </div>

      {allList.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Sin solicitudes"
          msg="No hay solicitudes con los filtros aplicados."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {allList.map((sol) => (
            <CorreccionCardItem
              key={sol.id}
              sol={sol}
              expanded={expandedId === sol.id}
              onToggle={() => onToggle(sol.id)}
              onToast={onToast}
              onReject={onReject}
              onApprove={async (id, notas) => {
                if (sol.tipo_solicitud === "modificacion") {
                  approveModMutation.mutate({ id, notas });
                } else {
                  approveNuevaMutation.mutate({ id, notas });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CORRECCION CARD ITEM ───────────────────────────────────────────
interface CorreccionCardItemProps {
  sol: any;
  expanded: boolean;
  onToggle: () => void;
  onToast: (msg: string) => void;
  onReject: (sol: any) => void;
  onApprove: (id: string, notas?: string) => Promise<void>;
}

const CorreccionCardItem: React.FC<CorreccionCardItemProps> = ({
  sol,
  expanded,
  onToggle,
  onToast,
  onReject,
  onApprove,
}) => {
  const isMod = sol.tipo_solicitud === "modificacion";
  const [adminNotes, setAdminNotes] = useState(sol.notas_admin || "");
  const [loading, setLoading] = useState(false);

  const getVisuals = (est: string) => {
    const e = (est || "").toLowerCase();
    if (e === "aprobada") return { label: "Aprobada", c: "var(--ok)", s: "var(--ok-soft)" };
    if (e === "rechazada") return { label: "Rechazada", c: "var(--crit)", s: "var(--crit-soft)" };
    return { label: "Pendiente", c: "var(--warn)", s: "var(--warn-soft)" };
  };

  const est = getVisuals(sol.estado);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(sol.id, adminNotes);
    } finally {
      setLoading(false);
    }
  };

  const getTipoModTitle = () => {
    if (!isMod) return "Nueva PPS";
    const mapping: Record<string, string> = {
      horas: "Horas de la práctica",
      fechas: "Período y cronograma",
      institucion: "Reasignación institucional",
    };
    return `Modificación · ${mapping[sol.tipo_modificacion] || "Práctica"}`;
  };

  const docsList = useMemo(
    () => normalizeAttachments(sol.planilla_asistencia_url || sol.informe_final_url),
    [sol.planilla_asistencia_url, sol.informe_final_url]
  );

  return (
    <div
      data-solicitud-id={sol.id}
      style={{
        border: `1px solid ${expanded ? "var(--ink)" : "var(--rule-2)"}`,
        borderRadius: 14,
        background: "var(--paper)",
        overflow: "hidden",
        position: "relative",
        transition: "all .14s ease",
      }}
    >
      <div
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: est.c }}
      ></div>

      {/* Header collapsed */}
      <div
        onClick={onToggle}
        style={{
          padding: "15px 18px 15px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              flexShrink: 0,
              background: "var(--paper-2)",
              color: "var(--ink-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-icons" style={{ fontSize: 19 }}>
              {isMod
                ? sol.tipo_modificacion === "horas"
                  ? "schedule"
                  : sol.tipo_modificacion === "fechas"
                    ? "event"
                    : "business"
                : "note_add"}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>
                {sol.estudiante?.nombre || "Estudiante"}
              </h4>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "var(--paper-2)",
                  color: "var(--ink-2)",
                }}
              >
                {getTipoModTitle()}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--paper-2)",
                  color: "var(--ink-3)",
                }}
              >
                {sol.estudiante?.legajo || "—"}
              </span>
              <span className="meta" style={{ fontSize: 11.5 }}>
                {isMod
                  ? sol.practica?.nombre_institucion
                  : sol.institucion?.nombre || sol.nombre_institucion_manual}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              background: est.s,
              color: est.c,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {est.label}
          </span>
          <span
            className="material-icons"
            style={{
              fontSize: 20,
              color: "var(--ink-4)",
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform .2s ease",
            }}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--rule-2)",
            padding: 18,
            background: "var(--paper-2)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Info grid */}
          <div>
            <div className="label" style={{ marginBottom: 10 }}>
              {isMod ? "PPS a modificar" : "PPS propuesta"}
            </div>
            {isMod ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <DataItem label="Institución" value={sol.practica?.nombre_institucion} />
                  <DataItem
                    label="Horas realizadas"
                    value={`${sol.practica?.horas_realizadas || 0} hs`}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--paper)",
                    border: "1px solid var(--rule-2)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      className="label"
                      style={{ fontSize: 9.5, display: "block", marginBottom: 4 }}
                    >
                      Cambio propuesto en horas
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 14,
                          color: "var(--ink-3)",
                          textDecoration: "line-through",
                        }}
                      >
                        {sol.practica?.horas_realizadas || 0} hs
                      </span>
                      <span
                        className="material-icons"
                        style={{ fontSize: 16, color: "var(--ink-4)" }}
                      >
                        arrow_forward
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {sol.horas_nuevas} hs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <DataItem
                  label="Institución propuesta"
                  value={sol.nombre_institucion_manual || sol.institucion?.nombre}
                />
                <DataItem label="Orientación" value={sol.orientacion} />
                <DataItem label="Horas estimadas" value={`${sol.horas_estimadas} hs`} />
                <DataItem
                  label="Período"
                  value={
                    sol.fecha_inicio && sol.fecha_finalizacion
                      ? `${new Date(sol.fecha_inicio).toLocaleDateString("es-AR")} al ${new Date(sol.fecha_finalizacion).toLocaleDateString("es-AR")}`
                      : "—"
                  }
                />
              </div>
            )}
          </div>

          {/* Attached docs */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Documentos de respaldo adjuntos
            </div>
            {docsList.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {docsList.map((d, i) => (
                  <a
                    key={i}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 11px",
                      borderRadius: 8,
                      border: "1px solid var(--rule-2)",
                      background: "var(--paper)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      className="material-icons"
                      style={{ fontSize: 15, color: "var(--ink-4)" }}
                    >
                      description
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{d.filename}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--crit-soft)",
                  color: "var(--crit)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  error
                </span>
                El alumno no adjuntó documentación de respaldo en esta corrección.
              </div>
            )}
          </div>

          {/* Rejection comments */}
          {sol.estado === "rechazada" && sol.comentario_rechazo && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--crit-soft)",
                border: "1px solid var(--crit)",
              }}
            >
              <div
                className="label"
                style={{ fontSize: 9.5, color: "var(--crit)", marginBottom: 4 }}
              >
                Motivo de rechazo
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {sol.comentario_rechazo}
              </div>
            </div>
          )}

          {sol.notas_admin && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--paper)",
                border: "1px solid var(--rule-2)",
              }}
            >
              <div className="label" style={{ fontSize: 9.5, marginBottom: 4 }}>
                Notas del administrador
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {sol.notas_admin}
              </div>
            </div>
          )}

          {/* Actions - pending only */}
          {sol.estado === "pendiente" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Notas del administrador (Privadas)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Observaciones de la corrección..."
                  rows={2}
                  className="field"
                  style={{ fontSize: 13, minHeight: 0 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => onReject(sol)}
                  className="btn btn-sm press"
                  style={{ color: "var(--crit)", borderColor: "#B23A4833" }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    close
                  </span>
                  Rechazar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="btn btn-sm press"
                  style={{
                    background: "var(--ok)",
                    color: "var(--paper)",
                    borderColor: "var(--ok)",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    check_circle
                  </span>
                  {isMod ? "Aprobar cambio" : "Aprobar y crear PPS"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Modal Email Review ────────────────────────────────────────────
interface EmailReviewModalProps {
  draft: EmailDraft;
  isSending: boolean;
  onChange: (d: EmailDraft) => void;
  onClose: () => void;
  onSend: (e: React.MouseEvent) => void;
}

const EmailReviewModal: React.FC<EmailReviewModalProps> = ({
  draft,
  isSending,
  onChange,
  onClose,
  onSend,
}) => {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 20px",
            borderBottom: "1px solid var(--rule-2)",
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              Contacto Institucional
            </span>
            <h3 className="serif" style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 700 }}>
              Revisar correo electrónico
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="btn btn-ghost btn-sm press"
            style={{ padding: 4 }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "block" }}>
              <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
                Para
              </span>
              <input
                value={draft.to}
                onChange={(e) => onChange({ ...draft, to: e.target.value })}
                className="field"
                style={{ fontSize: 13 }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
                Institución
              </span>
              <input
                value={draft.institution}
                onChange={(e) => onChange({ ...draft, institution: e.target.value })}
                className="field"
                style={{ fontSize: 13 }}
              />
            </label>
          </div>
          <label style={{ display: "block" }}>
            <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
              Asunto
            </span>
            <input
              value={draft.subject}
              onChange={(e) => onChange({ ...draft, subject: e.target.value })}
              className="field"
              style={{ fontSize: 13 }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
              Mensaje
            </span>
            <textarea
              value={draft.body}
              onChange={(e) => onChange({ ...draft, body: e.target.value })}
              rows={11}
              className="field"
              style={{ fontSize: 13, lineHeight: 1.55 }}
            ></textarea>
          </label>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "14px 20px",
            borderTop: "1px solid var(--rule-2)",
            background: "var(--paper-2)",
          }}
        >
          <button onClick={onClose} disabled={isSending} className="btn btn-sm press">
            Cancelar
          </button>
          <button
            onClick={onSend}
            disabled={isSending || !draft.to.trim()}
            className="btn btn-mail btn-sm press"
            style={{ opacity: isSending || !draft.to.trim() ? 0.5 : 1 }}
          >
            {isSending ? (
              <div className="loader-sm" />
            ) : (
              <span className="material-icons" style={{ fontSize: 15 }}>
                send
              </span>
            )}
            {isSending ? "Enviando..." : "Enviar correo"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolicitudesManager;
