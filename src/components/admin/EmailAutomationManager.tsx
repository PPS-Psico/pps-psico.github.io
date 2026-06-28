/**
 * EmailAutomationManager — Rediseño v1 (Paper & Ink editorial)
 *
 * Solo cambia la capa visual. La lógica se preserva intacta:
 *   · Plantillas de mail (3 escenarios) y push (2 escenarios) en email_templates.
 *   · Activar/desactivar por escenario (toggleActiveMutation).
 *   · Editar asunto/cuerpo con inserción de variables.
 *   · Envío de prueba de mail (send-email) y de push (send-fcm-notification).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { generateHtmlTemplate, stripGreeting } from "../../utils/emailService";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { injectPremiumMotion } from "./premiumMotion";
import { logger } from "../../utils/logger";

interface AutomationScenario {
  id: string;
  label: string;
  description: string;
  icon: string;
  variables: string[];
  defaultSubject: string;
  defaultBody: string;
}

const EMAIL_SCENARIOS: AutomationScenario[] = [
  {
    id: "seleccion",
    label: "Alumno Seleccionado",
    description: 'Se env?a cuando marcas a un estudiante como "Seleccionado" en una convocatoria.',
    icon: "how_to_reg",
    variables: [
      "{{nombre_alumno}}",
      "{{nombre_pps}}",
      "{{encuentro_inicial}}",
      "{{horario}}",
      "{{panel_url}}",
    ],
    defaultSubject: "Confirmaci?n de Asignaci?n PPS: {{nombre_pps}}",
    defaultBody: `Hola {{nombre_alumno}},

Nos complace informarte que has sido seleccionado/a para realizar tu Pr?ctica Profesional Supervisada en:

Instituci?n: {{nombre_pps}}
{{encuentro_inicial}}
{{horario}}

**Acci?n requerida** Ingres? a Mi Panel, revis? el acta de compromiso y registr? tu aceptaci?n digital para reservar tu vacante antes del inicio de la PPS.
[[button|Ingresar a Mi Panel|{{panel_url}}]]

Si ten?s dudas o surge alguna dificultad, comunicate con la Coordinaci?n lo antes posible.

Te deseamos un excelente comienzo.

Saludos,

Blas
Coordinador de Pr?cticas Profesionales Supervisadas
Licenciatura en Psicolog?a
UFLO`,
  },
  {
    id: "solicitud",
    label: "Avance de Solicitud (Autogestión)",
    description:
      'Se envía cuando actualizas el estado de una solicitud de PPS (ej: a "En conversaciones").',
    icon: "assignment_turned_in",
    variables: ["{{nombre_alumno}}", "{{estado_nuevo}}", "{{institucion}}", "{{notas}}"],
    defaultSubject: "Actualización de tu Solicitud de PPS - UFLO",
    defaultBody: `Hola {{nombre_alumno}},

Hay novedades sobre tu solicitud de PPS en "{{institucion}}".

Nuevo Estado: {{estado_nuevo}}

Comentarios:
{{notas}}

Seguimos gestionando tu solicitud.`,
  },
  {
    id: "sac",
    label: "Carga en SAC / Finalización",
    description: "Se envía cuando se confirma la carga de horas en el sistema académico.",
    icon: "school",
    variables: ["{{nombre_alumno}}", "{{nombre_pps}}"],
    defaultSubject: "Acreditación de Prácticas en SAC ✅",
    defaultBody: `Hola {{nombre_alumno}},

Queremos avisarte que tus horas de la PPS "{{nombre_pps}}" fueron acreditadas correctamente y ya podés visualizarlas en el sistema SAC.

¡Felicitaciones por la finalización de esta etapa!

Saludos,

Blas
Coordinador de Prácticas Profesionales Supervisadas
Licenciatura en Psicología
UFLO`,
  },
];

const PUSH_SCENARIOS: AutomationScenario[] = [
  {
    id: "seleccion_push",
    label: "Alumno Seleccionado (Push)",
    description: "Notificación push cuando un estudiante es seleccionado en una convocatoria.",
    icon: "notifications_active",
    variables: ["{{nombre_alumno}}", "{{nombre_pps}}"],
    defaultSubject: "¡Fuiste seleccionado! 🎉",
    defaultBody:
      "Hola {{nombre_alumno}}, has sido seleccionado para la PPS: {{nombre_pps}}. Revisá tu correo para más detalles.",
  },
  {
    id: "compromiso_push",
    label: "Recordatorio Consentimiento Digital (Push)",
    description:
      "Notificación push que recuerda al estudiante aceptar el compromiso digital apenas queda seleccionado.",
    icon: "draw",
    variables: ["{{nombre_alumno}}", "{{nombre_pps}}"],
    defaultSubject: "Falta tu consentimiento digital ✍️",
    defaultBody:
      "Hola {{nombre_alumno}}, para confirmar tu lugar en {{nombre_pps}} tenés que aceptar el compromiso digital desde Mi Panel. ¡No te quedes afuera!",
  },
  {
    id: "nueva_convocatoria_push",
    label: "Nueva Convocatoria (Push)",
    description: "Notificación push a todos los estudiantes cuando se abre una nueva convocatoria.",
    icon: "campaign",
    variables: ["{{nombre_pps}}"],
    defaultSubject: "¡Nueva Convocatoria PPS! 📢",
    defaultBody: "Se abrió una nueva convocatoria: {{nombre_pps}}. Entrá a la app para postularte.",
  },
];

// ─── CSS scoped (Paper & Ink editorial) ───────────────────────────────────────

const CSS = `
.aut {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .aut {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
}
.aut .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.aut .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; }
.aut .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

.aut-head{ margin-bottom:20px; }
.aut-head h2{ font-family:'Instrument Serif', serif; font-size:26px; font-weight:700; letter-spacing:-0.025em; margin:5px 0 0; }
.aut-head p{ font-size:13.5px; color:var(--ink-3); margin:5px 0 0; max-width:560px; }

/* Tabs canal */
.aut-tabs{ display:inline-flex; gap:4px; padding:4px; border:1px solid var(--rule-2); border-radius:11px; background:var(--paper-2); margin-bottom:22px; }
.aut-tab{ display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; border:none; background:transparent; color:var(--ink-3); transition:all .12s; }
.aut-tab[data-on="1"]{ background:var(--paper); color:var(--ink); box-shadow:0 1px 2px rgba(20,19,16,0.06); }
.aut-tab .material-icons{ font-size:16px; }

/* Caja de prueba */
.aut-test{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); padding:18px 20px; margin-bottom:26px; }
.aut-test-grid{ display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-top:14px; }
.aut-label{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--ink-3); margin-bottom:6px; }
.aut-field{ width:100%; padding:9px 12px; border:1px solid var(--rule-3); border-radius:9px; background:var(--paper-2); color:var(--ink); font-size:13.5px; font-family:inherit; outline:none; box-sizing:border-box; }
.aut-field:focus{ border-color:var(--accent); }

/* Botones */
.aut-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:9px 15px; border-radius:9px; border:1px solid var(--rule-3); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; transition:background .12s; white-space:nowrap; }
.aut-btn:hover{ background:var(--paper-2); }
.aut-btn:disabled{ opacity:.5; cursor:not-allowed; }
.aut-btn-primary{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.aut-btn-primary:hover{ opacity:.9; background:var(--ink); }
.aut-btn .material-icons{ font-size:16px; }

/* Tarjeta de escenario */
.aut-card{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); overflow:hidden; transition:border-color .12s; }
.aut-card + .aut-card{ margin-top:12px; }
.aut-card[data-on="1"]{ border-left:3px solid var(--ok); }
.aut-card-top{ display:flex; align-items:center; gap:14px; padding:16px 18px; }
.aut-card-ico{ width:40px; height:40px; flex-shrink:0; border-radius:10px; display:flex; align-items:center; justify-content:center; background:var(--paper-3); color:var(--ink-3); }
.aut-card[data-on="1"] .aut-card-ico{ background:var(--ok-s); color:var(--ok); }
.aut-card-ico .material-icons{ font-size:21px; }
.aut-card-body{ flex:1; min-width:0; }
.aut-card-title{ font-size:15px; font-weight:600; color:var(--ink); }
.aut-card-desc{ font-size:12.5px; color:var(--ink-3); margin-top:2px; line-height:1.45; }
.aut-card-ctrls{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
.aut-state{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
.aut-state[data-on="1"]{ color:var(--ok); }
.aut-state[data-on="0"]{ color:var(--ink-4); }

/* Toggle */
.aut-switch{ position:relative; width:42px; height:23px; border-radius:999px; border:none; cursor:pointer; transition:background .15s; background:var(--rule-3); }
.aut-switch[data-on="1"]{ background:var(--ok); }
.aut-switch span{ position:absolute; top:2.5px; left:2.5px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .15s; }
.aut-switch[data-on="1"] span{ transform:translateX(19px); }
.aut-edit-btn{ width:34px; height:34px; border-radius:8px; border:1px solid var(--rule-3); background:transparent; color:var(--ink-2); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .12s; }
.aut-edit-btn:hover{ background:var(--paper-2); }
.aut-edit-btn[data-on="1"]{ background:var(--accent-s); color:var(--accent); border-color:transparent; }
.aut-edit-btn .material-icons{ font-size:18px; }

/* Editor */
.aut-editor{ border-top:1px solid var(--rule-2); background:var(--paper-2); padding:18px 20px; }
.aut-var{ font-size:10.5px; font-family:'JetBrains Mono', monospace; background:var(--paper-3); color:var(--ink-2); border:1px solid var(--rule-2); padding:2px 7px; border-radius:6px; cursor:pointer; transition:all .1s; }
.aut-var:hover{ background:var(--accent); color:#fff; border-color:var(--accent); }
.aut-textarea{ width:100%; border:1px solid var(--rule-3); border-radius:10px; background:var(--paper); color:var(--ink); padding:12px; font-size:13px; font-family:'JetBrains Mono', monospace; line-height:1.6; outline:none; resize:vertical; box-sizing:border-box; }
.aut-textarea:focus{ border-color:var(--accent); }
.aut-tip{ display:flex; align-items:flex-start; gap:7px; font-size:11.5px; color:var(--ink-3); line-height:1.5; margin-top:8px; }
.aut-tip .material-icons{ font-size:13px; color:var(--accent); flex-shrink:0; margin-top:1px; }
@keyframes aut-spin{ to{ transform:rotate(360deg); } }
.aut-spin{ width:15px; height:15px; border:2px solid var(--rule-3); border-top-color:currentColor; border-radius:999px; animation:aut-spin .8s linear infinite; }
.aut-section-title{ font-family:'Instrument Serif', serif; font-size:19px; font-weight:700; letter-spacing:-0.02em; margin:0 0 14px; }
`;

injectScopedStyles("aut-styles", CSS);
injectPremiumMotion();

const EmailAutomationManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"emails" | "push">("emails");
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // Email test state
  const [testEmail, setTestEmail] = useState("");
  const [testScenarioId, setTestScenarioId] = useState<string>("seleccion");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [currentSubject, setCurrentSubject] = useState("");
  const [currentBody, setCurrentBody] = useState("");

  // Push test state
  const [isSendingCustomPush, setIsSendingCustomPush] = useState(false);

  // Fetch Templates from DB
  const { data: dbTemplates = [], isLoading } = useQuery({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("*");
      if (error) throw error;
      return data;
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      subject: string;
      body: string;
      is_active?: boolean;
    }) => {
      const { error } = await supabase.from("email_templates").upsert({
        id: vars.id,
        subject: vars.subject,
        body: vars.body,
        is_active: vars.is_active,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
      setToastInfo({ message: "Plantilla guardada correctamente.", type: "success" });
      setEditingScenarioId(null);
    },
    onError: (err: any) => {
      setToastInfo({ message: `Error guardando: ${err.message}`, type: "error" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (vars: { id: string; is_active: boolean; subject: string; body: string }) => {
      const { error } = await supabase.from("email_templates").upsert({
        id: vars.id,
        is_active: vars.is_active,
        subject: vars.subject,
        body: vars.body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
    },
    onError: (err: any) =>
      setToastInfo({ message: `Error cambiando estado: ${err.message}`, type: "error" }),
  });

  const getTemplateData = (scenarioId: string) => {
    const dbTmpl = dbTemplates.find((t) => t.id === scenarioId);
    const allScenarios = [...EMAIL_SCENARIOS, ...PUSH_SCENARIOS];
    const scenario = allScenarios.find((s) => s.id === scenarioId);
    return {
      subject: dbTmpl?.subject || scenario?.defaultSubject || "",
      body: dbTmpl?.body || scenario?.defaultBody || "",
      isActive: dbTmpl ? dbTmpl.is_active : false,
    };
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      setToastInfo({ message: "Ingresa un correo para la prueba.", type: "error" });
      return;
    }

    setIsSendingTest(true);
    try {
      const scenario = EMAIL_SCENARIOS.find((s) => s.id === testScenarioId) || EMAIL_SCENARIOS[0];
      const { subject, body } = getTemplateData(scenario.id);

      const studentName = "Estudiante de Prueba";
      let rawTextBody = body.replace("{{nombre_alumno}}", studentName);
      let finalSubject = subject;

      if (scenario.id === "seleccion") {
        const mockEncuentro = "Encuentro Inicial: Próximo Lunes 10:00 hs";
        const mockPPS = "Clínica Demo UFLO";
        const mockHorario = "Lunes de 16:00 a 19:00 hs";

        // Subject handling
        finalSubject = finalSubject.replace("{{nombre_pps}}", "Clínica Demo");

        // Body handling: first handle the encounter injection logic
        if (!rawTextBody.includes("{{encuentro_inicial}}")) {
          // If placeholder missing, simulate auto-injection after PPS name or at end
          if (rawTextBody.includes("{{nombre_pps}}")) {
            rawTextBody = rawTextBody.replace("{{nombre_pps}}", `{{nombre_pps}}\n${mockEncuentro}`);
          } else {
            rawTextBody += `\n${mockEncuentro}`;
          }
        }

        // Final placeholders replacement
        rawTextBody = rawTextBody
          .replace("{{nombre_pps}}", mockPPS)
          .replace("{{horario}}", mockHorario)
          .replace("{{encuentro_inicial}}", mockEncuentro);
      } else if (scenario.id === "solicitud") {
        rawTextBody = rawTextBody
          .replace("{{institucion}}", "Hospital Modelo")
          .replace("{{estado_nuevo}}", "En conversaciones")
          .replace("{{notas}}", "Hemos contactado a la institución y esperamos respuesta.");
        finalSubject = finalSubject.replace("{{institucion}}", "Hospital Modelo");
      } else if (scenario.id === "sac") {
        rawTextBody = rawTextBody.replace("{{nombre_pps}}", "Práctica Profesional Supervisada");
      }

      const firstName = studentName.split(" ")[0];
      const htmlTitle = `Hola, <span style="color: #2563eb;">${firstName}</span>`;
      const htmlBody = generateHtmlTemplate(rawTextBody, htmlTitle);
      const cleanTextBody = stripGreeting(rawTextBody);

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: `[PRUEBA] ${finalSubject}`,
          text: cleanTextBody,
          html: htmlBody,
          name: studentName,
        },
      });

      if (error) throw error;

      setToastInfo({ message: `Prueba de "${scenario.label}" enviada.`, type: "success" });
    } catch (error: any) {
      logger.error("Error sending test:", error);
      setToastInfo({
        message: `Fallo el envío: ${error.message || "Error desconocido"}`,
        type: "error",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsSendingCustomPush(true);
    logger.info("[FCM Test] Starting test notification...");
    try {
      logger.info("[FCM Test] Invoking send-fcm-notification function...");
      const { data, error } = await supabase.functions.invoke("send-fcm-notification", {
        body: {
          title: "🧪 Prueba de Notificación",
          body: "Esta es una notificación de prueba para verificar que todo funciona correctamente.",
          type: "message",
          send_to_all: true,
        },
      });

      logger.info("[FCM Test] Response:", { data, error });

      if (data?.error) {
        logger.error("[FCM Test] Server returned error:", data.error);
        throw new Error(data.error);
      }
      if (error) {
        logger.error("[FCM Test] Supabase function error:", error);
        throw error;
      }

      if (data?.sent === 0) {
        setToastInfo({
          message:
            "No hay suscriptores activos. Los usuarios deben activar las notificaciones primero.",
          type: "warning",
        });
      } else {
        setToastInfo({
          message: `Notificación enviada a ${data?.sent || 0} suscriptor(es)${data?.failed > 0 ? ` (${data.failed} fallidos)` : ""}`,
          type: "success",
        });
      }
    } catch (error: any) {
      logger.error("[FCM Test] Error:", error);
      setToastInfo({ message: error.message || "Error al enviar notificación", type: "error" });
    } finally {
      setIsSendingCustomPush(false);
    }
  };

  const handleEditClick = (scenario: AutomationScenario) => {
    setEditingScenarioId(scenario.id);
    const data = getTemplateData(scenario.id);
    setCurrentSubject(data.subject);
    setCurrentBody(data.body);
  };

  const handleSaveScenario = (scenario: AutomationScenario) => {
    const data = getTemplateData(scenario.id);
    updateTemplateMutation.mutate({
      id: scenario.id,
      subject: currentSubject,
      body: currentBody,
      is_active: data.isActive ?? undefined,
    });
  };

  const toggleActive = (scenario: AutomationScenario) => {
    const data = getTemplateData(scenario.id);
    toggleActiveMutation.mutate({
      id: scenario.id,
      is_active: !data.isActive,
      subject: data.subject,
      body: data.body,
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("body-editor") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = currentBody;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setCurrentBody(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      }, 0);
    } else {
      setCurrentBody((prev) => prev + variable);
    }
  };

  // ─── Tarjeta de escenario (mail o push) ──────────────────────────────────────
  const ScenarioCard: React.FC<{ scenario: AutomationScenario; channel: "email" | "push" }> = ({
    scenario,
    channel,
  }) => {
    const isEditing = editingScenarioId === scenario.id;
    const { isActive } = getTemplateData(scenario.id);
    const isMail = channel === "email";

    return (
      <div className="aut-card" data-on={isActive ? "1" : "0"}>
        <div className="aut-card-top">
          <span className="aut-card-ico">
            <span className="material-icons">{scenario.icon}</span>
          </span>
          <div className="aut-card-body">
            <div className="aut-card-title">{scenario.label}</div>
            <div className="aut-card-desc">{scenario.description}</div>
          </div>
          <div className="aut-card-ctrls">
            <span className="aut-state" data-on={isActive ? "1" : "0"}>
              {isActive ? "Activado" : "Desactivado"}
            </span>
            <button
              className="aut-switch"
              data-on={isActive ? "1" : "0"}
              onClick={() => toggleActive(scenario)}
              disabled={toggleActiveMutation.isPending}
              aria-label={isActive ? "Desactivar" : "Activar"}
            >
              <span />
            </button>
            <button
              className="aut-edit-btn"
              data-on={isEditing ? "1" : "0"}
              onClick={() => (isEditing ? setEditingScenarioId(null) : handleEditClick(scenario))}
              aria-label={isEditing ? "Cerrar editor" : "Editar"}
            >
              <span className="material-icons">{isEditing ? "expand_less" : "edit"}</span>
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="aut-editor">
            <div style={{ marginBottom: 14 }}>
              <label className="aut-label">
                {isMail ? "Asunto del correo" : "Título de la notificación"}
              </label>
              <input
                className="aut-field"
                value={currentSubject}
                onChange={(e) => setCurrentSubject(e.target.value)}
                placeholder={isMail ? "Asunto…" : "Título…"}
              />
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <label className="aut-label" style={{ margin: 0 }}>
                  {isMail ? "Cuerpo del mensaje" : "Mensaje"}
                </label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {scenario.variables.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="aut-var"
                      title="Insertar variable"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {isMail && (
                <div className="aut-tip">
                  <span className="material-icons">tips_and_updates</span>
                  <span>
                    Usá <strong>**Título:**</strong> para cajas de alerta. No incluyas el saludo
                    inicial; el sistema lo agrega solo.
                  </span>
                </div>
              )}
              <textarea
                id="body-editor"
                className="aut-textarea"
                value={currentBody}
                onChange={(e) => setCurrentBody(e.target.value)}
                rows={isMail ? 14 : 6}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button className="aut-btn" onClick={() => setEditingScenarioId(null)}>
                Cancelar
              </button>
              <button
                className="aut-btn aut-btn-primary"
                onClick={() => handleSaveScenario(scenario)}
                disabled={updateTemplateMutation.isPending}
              >
                {updateTemplateMutation.isPending ? (
                  <span className="aut-spin" style={{ borderTopColor: "var(--paper)" }} />
                ) : (
                  <span className="material-icons">save</span>
                )}
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return <Loader />;

  return (
    <div className="aut">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <div className="aut-head">
        <span className="eyebrow">Sistema · comunicación</span>
        <h2 className="serif">Automatizaciones</h2>
        <p>
          Editá las plantillas de mail y push, activá los escenarios que querés que se disparen
          solos, y probá un envío antes de confiarlo.
        </p>
      </div>

      <div className="aut-tabs">
        <button
          className="aut-tab"
          data-on={activeTab === "emails" ? "1" : "0"}
          onClick={() => setActiveTab("emails")}
        >
          <span className="material-icons">mark_email_read</span>
          Correos
        </button>
        <button
          className="aut-tab"
          data-on={activeTab === "push" ? "1" : "0"}
          onClick={() => setActiveTab("push")}
        >
          <span className="material-icons">notifications_active</span>
          Push
        </button>
      </div>

      {activeTab === "emails" ? (
        <>
          {/* Caja de prueba mail */}
          <div className="aut-test">
            <span className="eyebrow">Diagnóstico y pruebas</span>
            <div className="aut-test-grid">
              <div style={{ flex: "1 1 200px" }}>
                <label className="aut-label">Plantilla a probar</label>
                <select
                  className="aut-field"
                  value={testScenarioId}
                  onChange={(e) => setTestScenarioId(e.target.value)}
                >
                  {EMAIL_SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label className="aut-label">Enviar a</label>
                <input
                  className="aut-field"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="tu_correo@ejemplo.com"
                />
              </div>
              <button
                className="aut-btn aut-btn-primary"
                onClick={handleSendTest}
                disabled={isSendingTest}
              >
                {isSendingTest ? (
                  <span className="aut-spin" style={{ borderTopColor: "var(--paper)" }} />
                ) : (
                  <span className="material-icons">send</span>
                )}
                Probar
              </button>
            </div>
          </div>

          {/* Escenarios mail */}
          <h3 className="aut-section-title">Plantillas de correo</h3>
          <div>
            {EMAIL_SCENARIOS.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} channel="email" />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Caja de prueba push */}
          <div className="aut-test">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div>
                <span className="eyebrow">Mensaje de prueba</span>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "4px 0 0" }}>
                  Enviar una notificación de prueba a todos los suscriptores activos.
                </p>
              </div>
              <button
                className="aut-btn aut-btn-primary"
                onClick={handleSendTestPush}
                disabled={isSendingCustomPush}
              >
                {isSendingCustomPush ? (
                  <span className="aut-spin" style={{ borderTopColor: "var(--paper)" }} />
                ) : (
                  <span className="material-icons">send</span>
                )}
                Enviar prueba
              </button>
            </div>
          </div>

          {/* Escenarios push */}
          <h3 className="aut-section-title">Notificaciones automáticas</h3>
          <div>
            {PUSH_SCENARIOS.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} channel="push" />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default EmailAutomationManager;
