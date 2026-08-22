/**
 * useLaunchManager — Toda la lógica de estado, queries y mutaciones del
 * Lanzador de convocatorias. Extraído de LanzadorConvocatorias para que el
 * componente quede como capa de presentación. La conducta es idéntica a la
 * implementación previa.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS,
  FIELD_ACTIVIDADES_LANZAMIENTOS,
  FIELD_ARCHIVO_DESCARGABLE_NOMBRE,
  FIELD_ARCHIVO_DESCARGABLE_URL,
  FIELD_CODIGO_CAMPUS_INSTITUCIONES,
  FIELD_CODIGO_CAMPUS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_DIRECCION_INSTITUCIONES,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FINALIZACION_POR_HORAS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_PUBLICACION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_INSTITUCION_LINK_PRACTICAS,
  FIELD_LOGO_INVERT_DARK_INSTITUCIONES,
  FIELD_LOGO_URL_INSTITUCIONES,
  FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
  FIELD_MODALIDAD_CUPO_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
  FIELD_REQ_CV_LANZAMIENTOS,
  FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  FIELD_TUTOR_INSTITUCIONES,
} from "../../../constants";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../constants/configConstants";
import { useConfirm } from "../../../hooks/useConfirm";
import { db } from "../../../lib/db";
import { supabase } from "../../../lib/supabaseClient";
import { runMutation } from "../../../lib/dbQuery";
import { getDbErrorMessage } from "../../../lib/dbError";
import { uploadInstitutionLogo } from "../../../services";
import { crearConvenio } from "../../../services/conveniosService";
import { generateWithGemini } from "../../../services/geminiService";
import type {
  AirtableRecord,
  InstitucionFields,
  LanzamientoPPS,
  LanzamientoPPSFields,
} from "../../../types";
import { ALL_ORIENTACIONES } from "../../../types";
import { formatDate, normalizeStringForComparison } from "../../../utils/formatters";
import { logger } from "../../../utils/logger";
import {
  initialState,
  mockInstitutions,
  mockLastLanzamiento,
  type FormData,
  type LaunchOptionDraft,
  type ScheduleEntry,
} from "./launchForm.types";
import {
  buildAIExtractionPrompt,
  buildWhatsappMessage,
  cleanGeminiJson,
  normalizeDetectedOrientations,
} from "./launchWhatsapp";
import type { NewInstitutionData } from "./NewInstitutionModalV3";

export interface ToastInfo {
  message: string;
  type: "success" | "error";
}

function normalizeScheduledDateToUtc(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error("La fecha de publicación programada es obligatoria.");
  }

  const scheduledDate = new Date(String(value));
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("La fecha de publicación programada no es válida.");
  }
  if (scheduledDate.getTime() <= Date.now()) {
    throw new Error("La fecha de publicación programada debe ser posterior al momento actual.");
  }

  return scheduledDate.toISOString();
}

export function useLaunchManager(isTestingMode: boolean, forcedTab?: "new" | "history") {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [internalTab, setInternalTab] = useState<"new" | "history">("new");
  const activeTab = forcedTab || internalTab;

  const [formData, setFormData] = useState<FormData>(initialState);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([
    { time: "", orientacion: "", obligatorio: false },
  ]);
  const [actividades, setActividades] = useState<string[]>([]);

  const [rawActivityText, setRawActivityText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [toastInfo, setToastInfo] = useState<ToastInfo | null>(null);
  const [instiSearch, setInstiSearch] = useState("");
  const [selectedInstitution, setSelectedInstitution] =
    useState<AirtableRecord<InstitucionFields> | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isNewInstitutionModalOpen, setIsNewInstitutionModalOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingLaunch, setEditingLaunch] = useState<LanzamientoPPS | null>(null);
  const [copiedLaunchId, setCopiedLaunchId] = useState<string | null>(null);

  // Confirmación con la UI del panel. El consumidor debe renderizar
  // `confirmDialog` (ver LanzadorConvocatorias).
  const { confirm, confirmDialog } = useConfirm();

  const isMultiOrientation = useMemo(() => {
    const orientations = Array.isArray(formData.orientacion) ? formData.orientacion : [];
    const unique = new Set(orientations.map((o) => normalizeStringForComparison(o)));
    return unique.size >= 2;
  }, [formData.orientacion]);

  const safeOrientacion = useMemo(
    () => (Array.isArray(formData.orientacion) ? formData.orientacion : []),
    [formData.orientacion]
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: institutions = [] } = useQuery<AirtableRecord<InstitucionFields>[]>({
    queryKey: ["allInstitutionsForLauncher", isTestingMode],
    queryFn: () => {
      if (isTestingMode) {
        return Promise.resolve(mockInstitutions as unknown as AirtableRecord<InstitucionFields>[]);
      }
      return db.instituciones.getAll({
        fields: [
          FIELD_NOMBRE_INSTITUCIONES,
          FIELD_CODIGO_CAMPUS_INSTITUCIONES,
          FIELD_DIRECCION_INSTITUCIONES,
          FIELD_TELEFONO_INSTITUCIONES,
          FIELD_TUTOR_INSTITUCIONES,
          FIELD_LOGO_URL_INSTITUCIONES,
          FIELD_LOGO_INVERT_DARK_INSTITUCIONES,
        ],
      });
    },
  });

  const { data: lastLanzamiento } = useQuery({
    queryKey: ["lastLanzamiento", selectedInstitution?.id, isTestingMode],
    queryFn: async () => {
      if (!selectedInstitution) return null;
      if (isTestingMode) {
        if (mockInstitutions.some((i) => i.id === selectedInstitution.id)) {
          return mockLastLanzamiento as unknown as AirtableRecord<LanzamientoPPSFields>;
        }
        return null;
      }

      let records = await db.lanzamientos.get({
        filters: { institucion_id: selectedInstitution.id },
        sort: [{ field: "fecha_inicio", direction: "desc" }],
        maxRecords: 1,
      });

      if (records.length === 0) {
        records = await db.lanzamientos.get({
          filters: {
            [FIELD_NOMBRE_PPS_LANZAMIENTOS]: `%${selectedInstitution[FIELD_NOMBRE_INSTITUCIONES]}%`,
          },
          sort: [{ field: "fecha_inicio", direction: "desc" }],
          maxRecords: 1,
        });
      }

      return records[0] || null;
    },
    enabled: !!selectedInstitution,
  });

  const { data: launchHistory = [] } = useQuery({
    queryKey: ["launchHistory", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) return [];
      const launches = await db.lanzamientos.getAll({
        sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }],
      });
      if (launches.length === 0) return launches;

      const { data: options, error } = await supabase
        .from("lanzamiento_opciones")
        .select("*, franjas:lanzamiento_opcion_horarios(*)")
        .in(
          "lanzamiento_id",
          launches.map((launch) => launch.id)
        )
        .eq("activa", true)
        .order("orden", { ascending: true });
      if (error) throw error;

      const optionsByLaunch = new Map<string, NonNullable<typeof options>>();
      for (const option of options || []) {
        option.franjas?.sort((a, b) => a.orden - b.orden);
        const current = optionsByLaunch.get(option.lanzamiento_id) || [];
        current.push(option);
        optionsByLaunch.set(option.lanzamiento_id, current);
      }

      return launches.map((launch) => ({
        ...launch,
        opciones: optionsByLaunch.get(launch.id) || [],
      }));
    },
    enabled: true,
  });

  const { visibleHistory, hiddenHistory, scheduledHistory } = useMemo(() => {
    const sorted = [...launchHistory].sort((a, b) => {
      const statusA = normalizeStringForComparison(a[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      const statusB = normalizeStringForComparison(b[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      const isOpenA = statusA === "abierta" || statusA === "abierto";
      const isOpenB = statusB === "abierta" || statusB === "abierto";
      if (isOpenA && !isOpenB) return -1;
      if (!isOpenA && isOpenB) return 1;
      const dateA = new Date(a[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();
      const dateB = new Date(b[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();
      return dateB - dateA;
    });

    const visible: LanzamientoPPS[] = [];
    const hidden: LanzamientoPPS[] = [];
    const scheduled: LanzamientoPPS[] = [];

    sorted.forEach((launch) => {
      const status = normalizeStringForComparison(launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      if (status === "programada" || status === "programado") scheduled.push(launch);
      else if (status === "oculto") hidden.push(launch);
      else visible.push(launch);
    });

    return { visibleHistory: visible, hiddenHistory: hidden, scheduledHistory: scheduled };
  }, [launchHistory]);

  const filteredInstitutions = useMemo(() => {
    if (!instiSearch) return [];
    const normalizedSearch = normalizeStringForComparison(instiSearch);
    return institutions
      .filter((inst) =>
        normalizeStringForComparison(inst[FIELD_NOMBRE_INSTITUCIONES]).includes(normalizedSearch)
      )
      .slice(0, 7);
  }, [instiSearch, institutions]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createInstitutionMutation = useMutation({
    mutationFn: async (data: NewInstitutionData) => {
      if (isTestingMode) {
        return {
          id: "new-mock",
          ...data,
          [FIELD_NOMBRE_INSTITUCIONES]: data.nombre,
        } as unknown as AirtableRecord<InstitucionFields>;
      }
      let logoUrl = "";
      if (data.logoFile) {
        try {
          logoUrl = await uploadInstitutionLogo(data.logoFile, data.nombre);
        } catch (error) {
          logger.error("Failed to upload logo:", error);
          throw error;
        }
      }
      const newInst = await db.instituciones.create({
        [FIELD_NOMBRE_INSTITUCIONES]: data.nombre,
        [FIELD_DIRECCION_INSTITUCIONES]: data.direccion,
        [FIELD_TELEFONO_INSTITUCIONES]: data.telefono,
        [FIELD_TUTOR_INSTITUCIONES]: data.tutor,
        [FIELD_LOGO_URL_INSTITUCIONES]: logoUrl || undefined,
        [FIELD_LOGO_INVERT_DARK_INSTITUCIONES]: data.invertLogo,
      } as never);
      // Nueva institución → primer convenio (no renovación). El trigger de la DB
      // sincroniza instituciones.convenio_nuevo = año del primer convenio.
      try {
        await crearConvenio({
          institucionId: String((newInst as any).id),
          fechaFirma: new Date().toISOString().slice(0, 10),
          tipo: "marco",
          esRenovacion: false,
        });
      } catch (e) {
        logger.error("No se pudo registrar el convenio inicial de la institución:", e);
      }
      return newInst;
    },
    onSuccess: (newInst: AirtableRecord<InstitucionFields>, variables: NewInstitutionData) => {
      setToastInfo({ message: "Institución registrada con éxito.", type: "success" });
      setSelectedInstitution(newInst);
      setInstiSearch(newInst[FIELD_NOMBRE_INSTITUCIONES] as string);
      setFormData((prev) => ({
        ...prev,
        nombrePPS: newInst[FIELD_NOMBRE_INSTITUCIONES] as string,
        orientacion: variables.orientacionSugerida
          ? [variables.orientacionSugerida]
          : prev.orientacion,
        direccion: (newInst[FIELD_DIRECCION_INSTITUCIONES] as string) || prev.direccion,
      }));
      setIsNewInstitutionModalOpen(false);
      if (!isTestingMode)
        queryClient.invalidateQueries({ queryKey: ["allInstitutionsForLauncher"] });
    },
    onError: (err: Error) => setToastInfo({ message: `Error: ${err.message}`, type: "error" }),
  });

  const createLaunchMutation = useMutation({
    mutationFn: async (newLaunchData: Record<string, unknown>) => {
      if (isTestingMode) {
        logger.info("TEST MODE: Simulating launch creation with data:", newLaunchData);
        return new Promise((resolve) => setTimeout(() => resolve(null), 1000));
      }
      const options = Array.isArray(formData.opciones) ? formData.opciones : [];
      const desiredState = newLaunchData[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS];
      const createPayload =
        options.length > 0
          ? {
              ...newLaunchData,
              [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto",
            }
          : newLaunchData;
      const launch = await db.lanzamientos.create(createPayload as LanzamientoPPS);
      if (options.length > 0) {
        const toList = (value: string) =>
          value
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean);
        const optionRows = options.map((option, index) => ({
          lanzamiento_id: launch.id,
          nombre: option.nombre.trim(),
          orientacion: option.orientacion.trim(),
          cupos: option.horarios.reduce(
            (total, schedule) => total + Math.max(0, Number(schedule.cupos) || 0),
            0
          ),
          horarios: option.horarios.map((schedule) => schedule.horario.trim()).filter(Boolean),
          actividades: toList(option.actividades),
          requisitos: toList(option.requisitos),
          ubicacion: option.ubicacion.trim() || null,
          orden: index + 1,
        }));
        const { data: createdOptions, error: optionsError } = await supabase
          .from("lanzamiento_opciones")
          .insert(optionRows)
          .select("id, orden");
        if (optionsError || !createdOptions) {
          await db.lanzamientos.delete(launch.id).catch(() => false);
          throw optionsError || new Error("No se pudieron crear los dispositivos.");
        }

        const optionIdByOrder = new Map(createdOptions.map((option) => [option.orden, option.id]));
        const scheduleRows = options.flatMap((option, optionIndex) => {
          const optionId = optionIdByOrder.get(optionIndex + 1);
          if (!optionId) return [];
          return option.horarios.map((schedule, scheduleIndex) => ({
            opcion_id: optionId,
            horario: schedule.horario.trim(),
            cupos: Number(schedule.cupos),
            orden: scheduleIndex + 1,
          }));
        });
        const { error: schedulesError } = await supabase
          .from("lanzamiento_opcion_horarios")
          .insert(scheduleRows);
        if (schedulesError) {
          await db.lanzamientos.delete(launch.id).catch(() => false);
          throw schedulesError;
        }
        if (desiredState && desiredState !== "Oculto") {
          await db.lanzamientos.update(launch.id, {
            [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: String(desiredState),
          });
        }
      }
      return launch;
    },
    onSuccess: (_data: unknown, variables: Record<string, unknown>) => {
      setToastInfo({ message: "Convocatoria procesada con éxito.", type: "success" });

      // Renovación de convenio: si el usuario tildó la opción, registramos un
      // convenio es_renovacion=true (reinicia el reloj de vencimiento a +2 años).
      if (!isTestingMode && formData.convenioRenovado && selectedInstitution?.id) {
        crearConvenio({
          institucionId: String(selectedInstitution.id),
          fechaFirma: (formData.fechaInicio as string) || new Date().toISOString().slice(0, 10),
          tipo: "especifico",
          esRenovacion: true,
        })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["conveniosPorVencer"] });
            queryClient.invalidateQueries({ queryKey: ["conveniosKpis"] });
            queryClient.invalidateQueries({ queryKey: ["metricsKPIs"] });
          })
          .catch((e) => logger.error("[Lanzador] No se pudo registrar la renovación:", e));
      }

      if (variables[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === "Abierta") {
        supabase.functions
          .invoke("send-fcm-notification", {
            body: {
              title: "🎉 Nueva Convocatoria PPS",
              body: `Se abrió la convocatoria: ${variables[FIELD_NOMBRE_PPS_LANZAMIENTOS]}`,
              type: "announcement",
              send_to_all: true,
            },
          })
          .catch((err) => logger.error("[Lanzador] Error triggering FCM notification:", err));
      }

      setFormData(initialState);
      setSchedules([{ time: "", orientacion: "", obligatorio: false }]);
      setActividades([]);
      setInstiSearch("");
      setSelectedInstitution(null);
      setInternalTab("history");
      setShowPreviewModal(false);

      if (!isTestingMode) {
        queryClient.invalidateQueries({ queryKey: ["allLanzamientos"] });
        queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
        queryClient.invalidateQueries({ queryKey: ["conveniosData"] });
      }
    },
    onError: (error: unknown) => {
      const e = error as { error?: { message?: string }; message?: string };
      const msg = e?.error?.message || e?.message || JSON.stringify(error);
      setToastInfo({ message: `Error al lanzar: ${msg}`, type: "error" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      db.lanzamientos.update(id, updates),
    onSuccess: (_: unknown, variables: { id: string; updates: Record<string, unknown> }) => {
      const newStatus = variables.updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS];
      setToastInfo({ message: `Estado actualizado a "${newStatus}".`, type: "success" });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (error: Error) =>
      setToastInfo({ message: `Error al actualizar estado: ${error.message}`, type: "error" }),
  });

  const deleteLaunchMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isTestingMode) return null;

      // Las FK de `convocatorias` y `practicas` hacia `lanzamientos_pps` son
      // NO ACTION: Postgres ya impide que queden filas huerfanas, porque
      // rechaza el borrado del lanzamiento si todavia hay hijos. Lo que faltaba
      // era cortar aca. Antes cada fallo era un `logger.warn` y se seguia igual,
      // asi que el admin terminaba viendo una violacion de clave foranea --
      // sintoma -- en vez del motivo real, por ejemplo RLS negando el borrado.
      await runMutation(supabase.from("convocatorias").delete().eq("lanzamiento_id", id), {
        table: "convocatorias",
        operation: "borrarInscripcionesDelLanzamiento",
      });
      await runMutation(supabase.from("practicas").delete().eq("lanzamiento_id", id), {
        table: "practicas",
        operation: "borrarPracticasDelLanzamiento",
      });
      return db.lanzamientos.delete(id);
    },
    onSuccess: () => {
      setToastInfo({ message: "Lanzamiento y datos vinculados eliminados.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
      queryClient.invalidateQueries({ queryKey: ["allConvocatorias"] });
      queryClient.invalidateQueries({ queryKey: ["allPracticas"] });
    },
    onError: (error: Error) => {
      // El detalle tecnico va al log; al admin se le muestra el mensaje del
      // contrato, que ya distingue permisos de red o de datos relacionados.
      logger.error("[Lanzador] Falló el borrado del lanzamiento:", error);
      setToastInfo({ message: `Error al eliminar: ${getDbErrorMessage(error)}`, type: "error" });
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Record<string, unknown> }) => {
      const normalizedFields = { ...fields };
      const resultingStatus = normalizeStringForComparison(
        String(
          normalizedFields[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] ??
            editingLaunch?.[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] ??
            ""
        )
      );

      if (resultingStatus === "programada" || resultingStatus === "programado") {
        normalizedFields[FIELD_FECHA_PUBLICACION_LANZAMIENTOS] = normalizeScheduledDateToUtc(
          normalizedFields[FIELD_FECHA_PUBLICACION_LANZAMIENTOS]
        );
      }

      return db.lanzamientos.update(id, normalizedFields);
    },
    onSuccess: () => {
      setToastInfo({ message: "Lanzamiento actualizado.", type: "success" });
      setEditingLaunch(null);
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (error: Error) =>
      setToastInfo({ message: `Error al guardar cambios: ${error.message}`, type: "error" }),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy text: ", err);
      setToastInfo({ message: "Error al copiar al portapapeles", type: "error" });
    }
  }, []);

  const runAIExtraction = useCallback(async () => {
    if (!rawActivityText.trim()) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setToastInfo({ message: "⚠️ Configuración de Supabase no detectada", type: "error" });
      return;
    }

    setIsGenerating(true);
    setToastInfo({ message: "Generando contenido con IA...", type: "success" });

    try {
      const text = await generateWithGemini(buildAIExtractionPrompt(rawActivityText));
      const parsed = JSON.parse(cleanGeminiJson(text));

      if (parsed) {
        const detectedOrientations = normalizeDetectedOrientations(
          parsed.orientaciones,
          ALL_ORIENTACIONES
        );
        const detectedOptions: LaunchOptionDraft[] = Array.isArray(parsed.dispositivos)
          ? parsed.dispositivos
              .map(
                (
                  option: {
                    nombre?: string;
                    orientacion?: string;
                    ubicacion?: string;
                    actividades?: unknown;
                    requisitos?: unknown;
                    franjas?: unknown;
                  },
                  optionIndex: number
                ) => {
                  const orientation = normalizeDetectedOrientations(
                    [option.orientacion],
                    ALL_ORIENTACIONES
                  )[0];
                  const schedules = Array.isArray(option.franjas)
                    ? option.franjas
                        .map(
                          (
                            schedule: { horario?: unknown; cupos?: unknown },
                            scheduleIndex: number
                          ) => ({
                            clientId: `ai-${optionIndex}-${scheduleIndex}-${Date.now()}`,
                            horario:
                              typeof schedule.horario === "string" ? schedule.horario.trim() : "",
                            cupos: Number(schedule.cupos),
                          })
                        )
                        .filter((schedule) => schedule.horario && schedule.cupos > 0)
                    : [];
                  if (!option.nombre?.trim() || !orientation || schedules.length === 0) return null;
                  return {
                    clientId: `ai-${optionIndex}-${Date.now()}`,
                    nombre: option.nombre.trim(),
                    orientacion: orientation,
                    cupos: schedules.reduce((total, schedule) => total + schedule.cupos, 0),
                    horarios: schedules,
                    actividades: Array.isArray(option.actividades)
                      ? option.actividades.map(String).join("\n")
                      : "",
                    requisitos: Array.isArray(option.requisitos)
                      ? option.requisitos.map(String).join("\n")
                      : "",
                    ubicacion: option.ubicacion?.trim() || "",
                  } satisfies LaunchOptionDraft;
                }
              )
              .filter((option: LaunchOptionDraft | null): option is LaunchOptionDraft => !!option)
          : [];

        setFormData((prev) => ({
          ...prev,
          descripcion: parsed.descripcion || prev.descripcion,
          direccion: parsed.direccion || prev.direccion,
          orientacion: detectedOrientations.length > 0 ? detectedOrientations : prev.orientacion,
          requisitoObligatorio: parsed.requisitoObligatorio || prev.requisitoObligatorio,
          actividadesLabel: parsed.actividadesLabel || prev.actividadesLabel,
          opciones: detectedOptions.length > 0 ? detectedOptions : prev.opciones,
          cuposDisponibles:
            detectedOptions.length > 0
              ? detectedOptions.reduce((total, option) => total + option.cupos, 0)
              : prev.cuposDisponibles,
        }));

        if (Array.isArray(parsed.actividades) && parsed.actividades.length > 0) {
          setActividades(parsed.actividades);
        }

        if (detectedOptions.length === 0 && Array.isArray(parsed.horarios)) {
          const detectedSchedules = parsed.horarios
            .map((h: { texto?: string; orientacion_vinculada?: string }) => ({
              time: h.texto || "",
              orientacion: h.orientacion_vinculada || "",
              obligatorio: false,
            }))
            .filter((s: ScheduleEntry) => s.time.length > 0);
          if (detectedSchedules.length > 0) setSchedules(detectedSchedules);
        }

        setToastInfo({ message: "✨ Datos y comisiones detectados", type: "success" });
      }
    } catch (error) {
      logger.error("AI Auto-Gen Error", error);
      setToastInfo({ message: `Error IA: ${(error as Error).message}`, type: "error" });
    } finally {
      setIsGenerating(false);
    }
  }, [rawActivityText]);

  const handleSmartPreview = useCallback(() => {
    try {
      const institutionName = selectedInstitution?.[FIELD_NOMBRE_INSTITUCIONES];
      const message = buildWhatsappMessage({
        formData,
        schedules,
        isMultiOrientation,
        institutionName: typeof institutionName === "string" ? institutionName : undefined,
      });
      setFormData((prev) => ({ ...prev, mensajeWhatsApp: message }));
      setShowPreviewModal(true);
    } catch (error) {
      logger.error("[Lanzador] No se pudo generar la previsualización:", error);
      setToastInfo({
        message:
          "No pudimos generar la previsualización. Revisá los horarios e intentá nuevamente.",
        type: "error",
      });
    }
  }, [formData, schedules, isMultiOrientation, selectedInstitution]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const checked = (e.target as HTMLInputElement).checked;
      let newValue: string | boolean = type === "checkbox" ? checked : value;
      if (type === "date" && typeof newValue === "string" && newValue.includes("T")) {
        newValue = newValue.split("T")[0];
      }
      setFormData((prev) => ({ ...prev, [name]: newValue as never }));
    },
    []
  );

  const handleScheduleChange = useCallback(
    (index: number, field: "time" | "orientacion" | "obligatorio", value: string | boolean) => {
      setSchedules((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addSchedule = useCallback(
    () => setSchedules((p) => [...p, { time: "", orientacion: "", obligatorio: false }]),
    []
  );
  const removeSchedule = useCallback((index: number) => {
    setSchedules((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ time: "", orientacion: "", obligatorio: false }];
    });
  }, []);

  const handleActivityChange = useCallback((index: number, value: string) => {
    setActividades((prev) => prev.map((a, i) => (i === index ? value : a)));
  }, []);
  const addActivity = useCallback(() => setActividades((p) => [...p, ""]), []);
  const removeActivity = useCallback((index: number) => {
    setActividades((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleLoadLastData = useCallback(() => {
    if (!lastLanzamiento) return;
    const prevSchedulesString = lastLanzamiento[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS];
    const explicitMandatoryRaw = lastLanzamiento[FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS];
    const explicitMandatory = Array.isArray(explicitMandatoryRaw)
      ? new Set(explicitMandatoryRaw.map(String))
      : null;
    const allLegacySchedulesAreMandatory =
      explicitMandatory === null && !!lastLanzamiento[FIELD_HORARIOS_FIJOS_LANZAMIENTOS];
    let prevSchedulesList: ScheduleEntry[] = [];
    if (prevSchedulesString) {
      prevSchedulesList = String(prevSchedulesString)
        .split(";")
        .map((s) => {
          const item = s.trim();
          if (!item) return null;
          const match = item.match(/(.*)\[(.*)\]/);
          const obligatorio = allLegacySchedulesAreMandatory || !!explicitMandatory?.has(item);
          if (match)
            return {
              time: match[1].trim(),
              orientacion: match[2].trim(),
              obligatorio,
            };
          return { time: item, orientacion: "", obligatorio };
        })
        .filter((i): i is ScheduleEntry => i !== null);
    }
    if (prevSchedulesList.length === 0)
      prevSchedulesList = [{ time: "", orientacion: "", obligatorio: false }];

    const prevActivitiesRaw = lastLanzamiento[FIELD_ACTIVIDADES_LANZAMIENTOS];
    let prevActivitiesList: string[] = [];
    if (Array.isArray(prevActivitiesRaw)) {
      prevActivitiesList = prevActivitiesRaw.map(String);
    } else if (typeof prevActivitiesRaw === "string") {
      try {
        const parsed = JSON.parse(prevActivitiesRaw);
        prevActivitiesList = Array.isArray(parsed) ? parsed : [prevActivitiesRaw];
      } catch {
        prevActivitiesList = [prevActivitiesRaw];
      }
    }

    const orientationRaw = lastLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS];
    let orientationList: string[] = [];
    if (typeof orientationRaw === "string") {
      orientationList = orientationRaw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    } else if (Array.isArray(orientationRaw)) {
      orientationList = orientationRaw;
    }
    orientationList = [
      ...new Set(
        orientationList.map(
          (o) =>
            ALL_ORIENTACIONES.find(
              (std) => normalizeStringForComparison(std) === normalizeStringForComparison(o)
            ) || o
        )
      ),
    ];

    const previousOptions = (lastLanzamiento.opciones || []).map((option) => ({
      clientId: option.id,
      nombre: option.nombre,
      orientacion: option.orientacion,
      cupos: option.cupos,
      horarios:
        option.franjas && option.franjas.length > 0
          ? option.franjas
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((schedule) => ({
                clientId: schedule.id,
                horario: schedule.horario,
                cupos: schedule.cupos,
              }))
          : [
              {
                clientId: `${option.id}-legacy`,
                horario: option.horarios.join(" · ") || "Horario a convenir",
                cupos: option.cupos,
              },
            ],
      actividades: option.actividades.join("\n"),
      requisitos: option.requisitos.join("\n"),
      ubicacion: option.ubicacion || "",
    }));

    setFormData((prev) => ({
      ...prev,
      orientacion: orientationList,
      horasAcreditadas: (lastLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] as number) || 0,
      cuposDisponibles: (lastLanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number) || 1,
      reqCertificadoTrabajo: lastLanzamiento[FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS] !== false,
      reqCv: !!lastLanzamiento[FIELD_REQ_CV_LANZAMIENTOS],
      direccion: (lastLanzamiento[FIELD_DIRECCION_LANZAMIENTOS] as string) || prev.direccion,
      descripcion: (lastLanzamiento[FIELD_DESCRIPCION_LANZAMIENTOS] as string) || "",
      requisitoObligatorio:
        (lastLanzamiento[FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS] as string) || "",
      archivoDescargableNombre: (lastLanzamiento[FIELD_ARCHIVO_DESCARGABLE_NOMBRE] as string) || "",
      archivoDescargableUrl: (lastLanzamiento[FIELD_ARCHIVO_DESCARGABLE_URL] as string) || "",
      fechaEncuentroInicial:
        (lastLanzamiento[FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS] as string) || "",
      fechaInicioInscripcion: "",
      fechaFinInscripcion: "",
      mensajeWhatsApp: (lastLanzamiento[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string) || "",
      actividadesLabel:
        (lastLanzamiento[FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS] as string) || "Actividades",
      horariosFijos:
        prevSchedulesList.some((schedule) => schedule.time.trim()) &&
        prevSchedulesList.every((schedule) => !schedule.time.trim() || schedule.obligatorio),
      opciones: previousOptions,
    }));
    setSchedules(prevSchedulesList);
    setActividades(prevActivitiesList.length ? prevActivitiesList : [""]);
    setToastInfo({ message: "Datos anteriores cargados.", type: "success" });
  }, [lastLanzamiento]);

  useEffect(() => {
    if (lastLanzamiento && selectedInstitution) handleLoadLastData();
  }, [lastLanzamiento, selectedInstitution, handleLoadLastData]);

  const handleSelectInstitution = useCallback((inst: AirtableRecord<InstitucionFields> | null) => {
    if (!inst) {
      setSelectedInstitution(null);
      return;
    }
    setSelectedInstitution(inst);
    setInstiSearch(inst[FIELD_NOMBRE_INSTITUCIONES] || "");
    setFormData((prev) => ({
      ...prev,
      nombrePPS: inst[FIELD_NOMBRE_INSTITUCIONES] || "",
      direccion: inst[FIELD_DIRECCION_INSTITUCIONES] || prev.direccion,
    }));
    setIsDropdownOpen(false);
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      setUploadingFile(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `convocatorias/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("documentos_pps")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("documentos_pps").getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, archivoDescargableUrl: urlData.publicUrl }));
      setToastInfo({ message: "Archivo subido correctamente", type: "success" });
    } catch (err) {
      logger.error("Error uploading file:", err);
      setToastInfo({ message: "Error al subir archivo: " + (err as Error).message, type: "error" });
    } finally {
      setUploadingFile(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const horas = Number(formData.horasAcreditadas);
    const hasHours = !isNaN(horas);

    const launchOptions = Array.isArray(formData.opciones) ? formData.opciones : [];
    const invalidOption = launchOptions.some(
      (option) =>
        !option.nombre.trim() ||
        !option.orientacion.trim() ||
        option.horarios.length === 0 ||
        option.horarios.some((schedule) => !schedule.horario.trim() || Number(schedule.cupos) <= 0)
    );

    if (
      !formData.nombrePPS ||
      !formData.fechaInicio ||
      !safeOrientacion.length ||
      !hasHours ||
      invalidOption
    ) {
      setToastInfo({
        message:
          "Por favor, complete los campos requeridos (Nombre, Fecha de inicio, Orientación, Horas).",
        type: "error",
      });
      return;
    }

    let fechaPublicacionIso: string | null = null;
    if (formData.programarLanzamiento) {
      try {
        fechaPublicacionIso = normalizeScheduledDateToUtc(formData.fechaPublicacion);
      } catch (error) {
        setToastInfo({ message: (error as Error).message, type: "error" });
        return;
      }
    }

    const formattedSchedules = schedules
      .map((s) => {
        const time = s.time.trim();
        const orient = isMultiOrientation ? s.orientacion.trim() : "";
        if (!time) return null;
        return {
          value: orient ? `${time} [${orient}]` : time,
          obligatorio: s.obligatorio,
        };
      })
      .filter((schedule): schedule is { value: string; obligatorio: boolean } => schedule !== null);
    const optionSchedules = launchOptions.map((option) => {
      const horarios = option.horarios
        .map(
          (schedule) =>
            `${schedule.horario.trim()} (${Number(schedule.cupos)} ${
              Number(schedule.cupos) === 1 ? "cupo" : "cupos"
            })`
        )
        .join(" / ");
      return `${option.nombre.trim()} · ${horarios} [${option.orientacion.trim()}]`;
    });
    const horarioFinal =
      optionSchedules.length > 0
        ? optionSchedules.join("; ")
        : formattedSchedules.map((schedule) => schedule.value).join("; ");
    const horariosObligatorios = formattedSchedules
      .filter((schedule) => schedule.obligatorio)
      .map((schedule) => schedule.value);
    const todosLosHorariosSonObligatorios =
      formattedSchedules.length > 0 && horariosObligatorios.length === formattedSchedules.length;
    const actividadesFinal = actividades.map((a) => a.trim()).filter(Boolean);

    const finalPayload: Record<string, unknown> = {
      [FIELD_NOMBRE_PPS_LANZAMIENTOS]: formData.nombrePPS,
      [FIELD_FECHA_INICIO_LANZAMIENTOS]: formData.fechaInicio,
      [FIELD_FECHA_FIN_LANZAMIENTOS]: formData.finalizacionPorHoras
        ? null
        : formData.fechaFin || null,
      [FIELD_FINALIZACION_POR_HORAS_LANZAMIENTOS]: formData.finalizacionPorHoras,
      [FIELD_ORIENTACION_LANZAMIENTOS]: safeOrientacion
        .map(
          (o) =>
            ALL_ORIENTACIONES.find(
              (std) => normalizeStringForComparison(std) === normalizeStringForComparison(o)
            ) || o
        )
        .join(", "),
      [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: Number(formData.horasAcreditadas),
      [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]:
        launchOptions.length > 0
          ? launchOptions.reduce(
              (total, option) =>
                total +
                option.horarios.reduce(
                  (scheduleTotal, schedule) =>
                    scheduleTotal + Math.max(0, Number(schedule.cupos) || 0),
                  0
                ),
              0
            )
          : Number(formData.cuposDisponibles),
      [FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS]: formData.tipoActividad,
      [FIELD_MODALIDAD_CUPO_LANZAMIENTOS]: formData.modalidadCupo,
      [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: horarioFinal,
      [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: formData.programarLanzamiento
        ? "Programada"
        : formData.estadoConvocatoria,
      [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Relanzada",
      [FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS]: formData.reqCertificadoTrabajo,
      [FIELD_REQ_CV_LANZAMIENTOS]: formData.reqCv,
      [FIELD_DIRECCION_LANZAMIENTOS]: formData.direccion,
      [FIELD_DESCRIPCION_LANZAMIENTOS]: formData.descripcion,
      [FIELD_ACTIVIDADES_LANZAMIENTOS]: actividadesFinal,
      [FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS]: formData.requisitoObligatorio,
      [FIELD_ARCHIVO_DESCARGABLE_NOMBRE]: formData.archivoDescargableNombre,
      [FIELD_ARCHIVO_DESCARGABLE_URL]: formData.archivoDescargableUrl,
      [FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS]: formData.fechaInicioInscripcion,
      [FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]: formData.fechaFinInscripcion,
      [FIELD_FECHA_PUBLICACION_LANZAMIENTOS]: fechaPublicacionIso,
      [FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS]: formData.mensajeWhatsApp,
      [FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS]: formData.actividadesLabel,
      [FIELD_HORARIOS_FIJOS_LANZAMIENTOS]: todosLosHorariosSonObligatorios,
      [FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS]: horariosObligatorios,
      [FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS]: formData.fechaEncuentroInicial || null,
      [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: (formData.linkTareaCampus || "").trim() || null,
      [FIELD_INSTITUCION_LINK_PRACTICAS]: selectedInstitution?.id || "recInstMock_nuevo",
    };

    createLaunchMutation.mutate(finalPayload);
  }, [
    formData,
    safeOrientacion,
    schedules,
    isMultiOrientation,
    actividades,
    selectedInstitution,
    createLaunchMutation,
  ]);

  const handleStatusAction = useCallback(
    (id: string, action: "cerrar" | "abrir" | "ocultar") => {
      const updates: Record<string, unknown> = {};
      if (action === "cerrar") updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Cerrado";
      else if (action === "abrir") {
        updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Abierta";
        updates[FIELD_ESTADO_GESTION_LANZAMIENTOS] = "Relanzada";
      } else if (action === "ocultar") updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Oculto";
      updateStatusMutation.mutate({ id, updates });
    },
    [updateStatusMutation]
  );

  const handleViewInscriptos = useCallback(
    (id: string) => navigate(`/admin/lanzador?tab=seleccionador&launchId=${id}`),
    [navigate]
  );

  const handleDeleteLaunch = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: "¿Eliminar este lanzamiento?",
        message:
          "Esto no se puede deshacer y podría afectar a los estudiantes inscriptos en la convocatoria.",
        confirmText: "Eliminar",
        type: "danger",
      });
      if (ok) deleteLaunchMutation.mutate(id);
    },
    [confirm, deleteLaunchMutation]
  );

  const handleCopyHistoryWhatsApp = useCallback((launch: LanzamientoPPS) => {
    const mensajeWhatsApp = launch[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string;
    const fallback = `📢 *NUEVA CONVOCATORIA DE PRÁCTICAS*\n\n🏥 *PPS:* ${
      launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS"
    }\n📚 *Orientación:* ${launch[FIELD_ORIENTACION_LANZAMIENTOS] || ""}\n⏱️ *Horas:* ${
      launch[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] === 0
        ? "Según recorrido"
        : `${launch[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] || 0} hs`
    }\n👥 *Cupos:* ${launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0}${
      launch[FIELD_FECHA_INICIO_LANZAMIENTOS]
        ? `\n\n📅 *Período:* ${formatDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string)}`
        : ""
    }\n\n💡 *Para inscribirte, consulta en Campus o escribe a pps@uflo.com.ar`;
    navigator.clipboard.writeText(mensajeWhatsApp || fallback);
    setCopiedLaunchId(launch.id);
    setTimeout(() => setCopiedLaunchId(null), 2000);
  }, []);

  return {
    // tab
    activeTab,
    setInternalTab,
    // form state
    formData,
    setFormData,
    schedules,
    actividades,
    isMultiOrientation,
    safeOrientacion,
    rawActivityText,
    setRawActivityText,
    isGenerating,
    uploadingFile,
    toastInfo,
    setToastInfo,
    // institution
    instiSearch,
    setInstiSearch,
    isDropdownOpen,
    setIsDropdownOpen,
    filteredInstitutions,
    selectedInstitution,
    lastLanzamiento,
    // modals
    confirmDialog,
    isNewInstitutionModalOpen,
    setIsNewInstitutionModalOpen,
    showPreviewModal,
    setShowPreviewModal,
    editingLaunch,
    setEditingLaunch,
    isCopied,
    copiedLaunchId,
    // history
    visibleHistory,
    hiddenHistory,
    scheduledHistory,
    // mutations
    createInstitutionMutation,
    createLaunchMutation,
    updateDetailsMutation,
    // handlers
    copyToClipboard,
    runAIExtraction,
    handleSmartPreview,
    handleChange,
    handleScheduleChange,
    addSchedule,
    removeSchedule,
    handleActivityChange,
    addActivity,
    removeActivity,
    handleLoadLastData,
    handleSelectInstitution,
    handleUploadFile,
    handleSubmit,
    handleStatusAction,
    handleViewInscriptos,
    handleDeleteLaunch,
    handleCopyHistoryWhatsApp,
  };
}
