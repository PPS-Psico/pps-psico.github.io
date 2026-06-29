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
import {
  buildInstitutionContactDraft,
  type EmailDraft,
  sendSmartEmail,
} from "../../utils/emailService";
import { getWhatsAppUrl, safeGetId, cleanWhatsAppNumber } from "../../utils/formatters";
import ConfirmModal from "../ConfirmModal";
import Toast from "../ui/Toast";
import { fetchAllData } from "../../services/supabaseService";
import { mapFinalizacion, mapEstudiante } from "../../utils/mappers";
import {
  deleteFinalizationRequest,
  rejectSolicitudModificacion,
  rejectSolicitudNuevaPPS,
} from "../../services";
import { logger } from "../../utils/logger";
import type {
  SolicitudPPSWithStudent,
  FinalizacionWithStudent,
  TabType,
} from "./solicitudes/types";
import { getInstitutionNameFromRequest } from "./solicitudes/helpers";
import { SubTabs } from "./solicitudes/primitives";
import { RejectModal, BorradorModal } from "./solicitudes/modals";
import type { BorradorModalProps } from "./solicitudes/modals";
import EmailReviewModal from "./solicitudes/EmailReviewModal";
import CorreccionesTabView from "./solicitudes/CorreccionesTab";
import EgresoTabView from "./solicitudes/EgresoTab";
import IngresoTabView from "./solicitudes/IngresoTab";
import { getErrorMessage } from "../../utils/getErrorMessage";

type RejectingState = (Record<string, unknown> & { id: string; tipo_solicitud?: string }) | null;
type BorradorState = BorradorModalProps["state"] & { sol: SolicitudPPSWithStudent };
type EmailDraftWithStudent = EmailDraft & { studentName?: string };

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
  const [rejecting, setRejecting] = useState<RejectingState>(null);
  const [emailReview, setEmailReview] = useState<EmailDraftWithStudent | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [borradorHermes, setBorradorHermes] = useState<BorradorState | null>(null);
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
  const { data: whatsappContactos = [], refetch: refetchContacts } = useQuery<
    Record<string, unknown>[]
  >({
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

  const { data: whatsappMensajes = [], refetch: refetchMessages } = useQuery<
    Record<string, unknown>[]
  >({
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

  const { data: gmailHilos = [], refetch: refetchGmail } = useQuery<Record<string, unknown>[]>({
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
        const mockRequests = (await mockDb.getAll("solicitudes_pps")) as Record<string, unknown>[];
        return mockRequests.map(
          (req) =>
            ({
              ...req,
              id: String(req.id),
              _studentName: (req.nombre_alumno as string) || "Estudiante Mock",
              _studentLegajo: (req.legajo as string) || "12345",
              _studentEmail: req.email as string,
              _daysSinceUpdate: 0,
            }) as SolicitudPPSWithStudent
        );
      }

      const { data, error } = await supabase
        .from(TABLE_PPS)
        .select("*, estudiantes!fk_solicitud_estudiante(nombre, legajo, correo)")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return data.map((req) => {
        const studentData = req.estudiantes as
          | { nombre?: string; legajo?: string; correo?: string }
          | null
          | undefined;
        const reqRec = req as Record<string, unknown>;
        const updatedAt = new Date(
          (reqRec.actualizacion as string) || (reqRec.created_at as string) || Date.now()
        );
        return {
          ...req,
          id: String(reqRec.id),
          _studentName: studentData?.nombre || (reqRec.nombre_alumno as string) || "Estudiante",
          _studentLegajo: studentData?.legajo || (reqRec.legajo as string) || "---",
          _studentEmail: studentData?.correo || (reqRec.email as string),
          _daysSinceUpdate: Math.floor(
            (new Date().getTime() - updatedAt.getTime()) / (1000 * 3600 * 24)
          ),
        } as SolicitudPPSWithStudent;
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

        const exists = whatsappContactos.some((c) => {
          const { number: dbPhone } = cleanWhatsAppNumber(
            (c.phone as string) || (c.chat_jid ? (c.chat_jid as string).split("@")[0] : "")
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
  }, [solicitudesIngreso, whatsappContactos, isTestingMode, refetchContacts]);

  // 2. QUERY EGRESO (finalizacion_pps)
  const { data: solicitudesEgreso = [], isLoading: loadingEgreso } = useQuery<
    FinalizacionWithStudent[]
  >({
    queryKey: ["adminFinalizacionPPS", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const mockRequests = (await mockDb.getAll("finalizacion_pps")) as Record<string, unknown>[];
        const students = (await mockDb.getAll("estudiantes")) as Record<string, unknown>[];
        const studentMap = new Map<string, Record<string, unknown>>(
          students.map((s) => [s.id as string, s])
        );

        return mockRequests.map((req) => {
          const sId = req[FIELD_ESTUDIANTE_FINALIZACION] as string;
          const student = studentMap.get(sId);
          return {
            ...req,
            id: String(req.id),
            studentName: (student?.[FIELD_NOMBRE_ESTUDIANTES] as string) || "Desconocido",
            studentLegajo: (student?.[FIELD_LEGAJO_ESTUDIANTES] as string) || "---",
            studentEmail: (student?.[FIELD_CORREO_ESTUDIANTES] as string) || "",
            createdTime: (req.created_at as string) || new Date().toISOString(),
          } as FinalizacionWithStudent;
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
    mutationFn: async ({
      recordId,
      fields,
    }: {
      recordId: string;
      fields: Record<string, unknown>;
    }) => {
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
          newState: fields[FIELD_ESTADO_PPS] as string,
          notes: (fields.notas as string) || originalRecord.notas || undefined,
        });
      }
      return db.solicitudes.update(recordId, fields as Parameters<typeof db.solicitudes.update>[1]);
    },
    onSuccess: () => {
      showToast("Solicitud actualizada.");
      queryClient.invalidateQueries({ queryKey: ["adminSolicitudesPPS", isTestingMode] });
    },
    onError: (err) => showToast(`Error: ${getErrorMessage(err)}`, "error"),
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
    onError: (err) => {
      showToast(`Error: ${getErrorMessage(err)}`, "error");
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
    onError: (err) => showToast(`Error al actualizar: ${getErrorMessage(err)}`, "error"),
  });

  const deleteEgresoMutation = useMutation({
    mutationFn: async (record: FinalizacionWithStudent) => {
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
    });
  };

  const handleSendEmailToInstitution = async () => {
    if (!emailReview) return;
    setIsSendingEmail(true);
    try {
      const studentName = emailReview.studentName || "Estudiante";
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
    } catch (err) {
      showToast(`Error: ${getErrorMessage(err)}`, "error");
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
    } catch (e) {
      showToast(`Error: ${getErrorMessage(e)}`, "error");
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
    } catch (e) {
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
            } catch (e) {
              showToast(getErrorMessage(e, "Error al rechazar"), "error");
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

export default SolicitudesManager;
