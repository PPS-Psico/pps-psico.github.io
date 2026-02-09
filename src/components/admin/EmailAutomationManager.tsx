import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Toast from "../ui/Toast";
import Button from "../ui/Button";
import { supabase } from "../../lib/supabaseClient";
import Loader from "../Loader";
import { generateHtmlTemplate, stripGreeting } from "../../utils/emailService";
import Select from "../ui/Select";
import { OneSignalDiagnosticsPanel } from "../OneSignalDiagnosticsPanel";

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
    description: 'Se envía cuando marcas a un estudiante como "Seleccionado" en una convocatoria.',
    icon: "how_to_reg",
    variables: ["{{nombre_alumno}}", "{{nombre_pps}}", "{{horario}}"],
    defaultSubject: "Confirmación de Asignación PPS: {{nombre_pps}} 🎓",
    defaultBody: `Hola {{nombre_alumno}},

Espero que estés muy bien.

Nos complace informarte que has sido seleccionado/a para realizar tu Práctica Profesional Supervisada en:

Institución: {{nombre_pps}}
Horario/Comisión asignada: {{horario}}

💡 Recomendaciones para tu Práctica

**Puntualidad y Asistencia:** La puntualidad es la primera señal de compromiso profesional. Si surge un imprevisto de fuerza mayor, avisá con la mayor antelación posible tanto a la institución como a la Universidad. Recordá que faltar sin previo aviso es motivo suficiente de suspensión de la PPS.

**Ética y Confidencialidad:** Vas a trabajar con personas y, en muchos casos, con información sensible. El secreto profesional y el respeto por la privacidad son fundamentales desde el primer momento.

**Rol Activo:** No te quedes solo con "observar". Preguntá, mostrá interés, llevá cuaderno para anotar y participá de los espacios de supervisión. La PPS te devuelve lo que vos le pongas de energía.

**Documentación Final:** No te olvides de terminar la PPS con tu planilla de asistencia firmada y conservarla (exceptuando las Online que no se firma). Recordá que tenés 30 días para la entrega del informe final una vez finalizada la PPS.

Por favor, respondenos a este correo confirmando que recibiste la información y que aceptás la vacante asignada.

¡Te deseamos un excelente comienzo!

Saludos,

Blas
Coordinador de Prácticas Profesionales Supervisadas
Licenciatura en Psicología
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
    id: "nueva_convocatoria_push",
    label: "Nueva Convocatoria (Push)",
    description: "Notificación push a todos los estudiantes cuando se abre una nueva convocatoria.",
    icon: "campaign",
    variables: ["{{nombre_pps}}"],
    defaultSubject: "¡Nueva Convocatoria PPS! 📢",
    defaultBody: "Se abrió una nueva convocatoria: {{nombre_pps}}. Entrá a la app para postularte.",
  },
];

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
        rawTextBody = rawTextBody
          .replace("{{nombre_pps}}", "Clínica Demo UFLO")
          .replace("{{horario}}", "Lunes 14hs");
        finalSubject = finalSubject.replace("{{nombre_pps}}", "Clínica Demo");
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
      console.error("Error sending test:", error);
      setToastInfo({
        message: `Fallo el envío: ${error.message || "Error desconocido"}`,
        type: "error",
      });
    } finally {
      setIsSendingTest(false);
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
      is_active: data.isActive,
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

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("emails")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === "emails"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <span className="material-icons">mark_email_read</span>
            Correos Automáticos
          </button>
          <button
            onClick={() => setActiveTab("push")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === "push"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <span className="material-icons">notifications_active</span>
            Notificaciones Push
          </button>
        </div>
      </div>

      {activeTab === "emails" ? (
        <>
          {/* Email Configuration Header */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                <span className="material-icons !text-2xl">mark_email_read</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  Gestor de Correos Automatizados
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Configura el contenido y activa/desactiva los envíos automáticos de correos
                  electrónicos.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                Diagnóstico y Pruebas
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Plantilla a probar:
                  </label>
                  <Select
                    value={testScenarioId}
                    onChange={(e) => setTestScenarioId(e.target.value)}
                    className="w-full text-sm"
                  >
                    {EMAIL_SCENARIOS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex gap-2 w-full">
                  <div className="flex-grow">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Enviar a:
                    </label>
                    <Input
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="tu_correo@ejemplo.com"
                      className="text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleSendTest}
                    disabled={isSendingTest}
                    size="md"
                    icon="send"
                    variant="secondary"
                  >
                    {isSendingTest ? "..." : "Probar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Email Scenarios */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
              Plantillas de Correo
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {EMAIL_SCENARIOS.map((scenario) => {
                const isEditing = editingScenarioId === scenario.id;
                const { isActive } = getTemplateData(scenario.id);

                return (
                  <div
                    key={scenario.id}
                    className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm transition-all ${isActive ? "border-blue-200 dark:border-blue-800" : "border-slate-200 dark:border-slate-700 opacity-90"}`}
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-3 rounded-full ${isActive ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}
                        >
                          <span className="material-icons !text-2xl">{scenario.icon}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                            {scenario.label}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                            {scenario.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`}
                          >
                            {isActive ? "ACTIVADO" : "DESACTIVADO"}
                          </span>
                          <button
                            onClick={() => toggleActive(scenario)}
                            disabled={toggleActiveMutation.isPending}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`}
                            />
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            isEditing ? setEditingScenarioId(null) : handleEditClick(scenario)
                          }
                          className={`p-2 rounded-lg border transition-colors ${isEditing ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300"}`}
                        >
                          <span className="material-icons !text-xl">
                            {isEditing ? "expand_less" : "edit"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50/50 dark:bg-slate-900/30 animate-fade-in">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Asunto del Correo
                            </label>
                            <Input
                              value={currentSubject}
                              onChange={(e) => setCurrentSubject(e.target.value)}
                              placeholder="Asunto..."
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="block text-xs font-bold text-slate-500 uppercase">
                                Cuerpo del Mensaje (Soporta **negrita** para títulos)
                              </label>
                              <div className="flex gap-1">
                                {scenario.variables.map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => insertVariable(v)}
                                    className="text-[10px] bg-slate-200 dark:bg-slate-700 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/50 dark:hover:text-blue-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                    title="Insertar variable"
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="text-xs text-slate-400 mb-2 px-2 border-l-2 border-blue-200">
                              Tip: Usa <strong>**Título:**</strong> para crear cajas de alerta
                              visuales con íconos.
                              <br />
                              Nota: No incluyas el saludo inicial ("Hola..."), el sistema lo agrega
                              automáticamente.
                            </div>
                            <textarea
                              id="body-editor"
                              value={currentBody}
                              onChange={(e) => setCurrentBody(e.target.value)}
                              rows={16}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono leading-relaxed"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingScenarioId(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSaveScenario(scenario)}
                              isLoading={updateTemplateMutation.isPending}
                              icon="save"
                            >
                              Guardar Cambios
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Push Configuration Header */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                <span className="material-icons !text-2xl">notifications_active</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  Gestor de Notificaciones Push
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Configura notificaciones push automáticas y envía mensajes personalizados a todos
                  los suscriptores.
                </p>
              </div>
            </div>

            {/* Botón de Prueba */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                    🧪 Mensaje de Prueba
                  </h4>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Enviar notificación de prueba a todos los suscriptores
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    setIsSendingCustomPush(true);
                    console.log("[FCM Test] Starting test notification...");
                    try {
                      console.log("[FCM Test] Invoking send-fcm-notification function...");
                      const { data, error } = await supabase.functions.invoke(
                        "send-fcm-notification",
                        {
                          body: {
                            title: "🧪 Prueba de Notificación",
                            body: "Esta es una notificación de prueba para verificar que todo funciona correctamente.",
                            send_to_all: true,
                          },
                        }
                      );

                      console.log("[FCM Test] Response:", { data, error });

                      // Check if response has error message
                      if (data?.error) {
                        console.error("[FCM Test] Server returned error:", data.error);
                        throw new Error(data.error);
                      }
                      if (error) {
                        console.error("[FCM Test] Supabase function error:", error);
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
                      console.error("[FCM Test] Error:", error);
                      setToastInfo({
                        message: error.message || "Error al enviar notificación",
                        type: "error",
                      });
                    } finally {
                      setIsSendingCustomPush(false);
                    }
                  }}
                  disabled={isSendingCustomPush}
                  isLoading={isSendingCustomPush}
                  icon="send"
                  variant="primary"
                >
                  Enviar Prueba
                </Button>
              </div>
            </div>
          </div>

          {/* Push Scenarios */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
              Notificaciones Automáticas
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {PUSH_SCENARIOS.map((scenario) => {
                const isEditing = editingScenarioId === scenario.id;
                const { isActive } = getTemplateData(scenario.id);

                return (
                  <div
                    key={scenario.id}
                    className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm transition-all ${isActive ? "border-emerald-200 dark:border-emerald-800" : "border-slate-200 dark:border-slate-700 opacity-90"}`}
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-3 rounded-full ${isActive ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}
                        >
                          <span className="material-icons !text-2xl">{scenario.icon}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                            {scenario.label}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                            {scenario.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}
                          >
                            {isActive ? "ACTIVADO" : "DESACTIVADO"}
                          </span>
                          <button
                            onClick={() => toggleActive(scenario)}
                            disabled={toggleActiveMutation.isPending}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`}
                            />
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            isEditing ? setEditingScenarioId(null) : handleEditClick(scenario)
                          }
                          className={`p-2 rounded-lg border transition-colors ${isEditing ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300"}`}
                        >
                          <span className="material-icons !text-xl">
                            {isEditing ? "expand_less" : "edit"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50/50 dark:bg-slate-900/30 animate-fade-in">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Título de la Notificación
                            </label>
                            <Input
                              value={currentSubject}
                              onChange={(e) => setCurrentSubject(e.target.value)}
                              placeholder="Título..."
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="block text-xs font-bold text-slate-500 uppercase">
                                Mensaje
                              </label>
                              <div className="flex gap-1">
                                {scenario.variables.map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => insertVariable(v)}
                                    className="text-[10px] bg-slate-200 dark:bg-slate-700 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                    title="Insertar variable"
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <textarea
                              id="body-editor"
                              value={currentBody}
                              onChange={(e) => setCurrentBody(e.target.value)}
                              rows={6}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono leading-relaxed"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingScenarioId(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSaveScenario(scenario)}
                              isLoading={updateTemplateMutation.isPending}
                              icon="save"
                            >
                              Guardar Cambios
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diagnóstico OneSignal */}
          <div className="mt-8">
            <OneSignalDiagnosticsPanel />
          </div>
        </>
      )}
    </div>
  );
};

export default EmailAutomationManager;
