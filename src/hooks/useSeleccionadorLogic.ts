import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../lib/db";
import { mockDb } from "../services/mockDb";
import { toggleStudentSelection } from "../services/dataService";
import { supabase } from "../lib/supabaseClient";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LEGAJO_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_CONVOCATORIAS,
  FIELD_FECHA_INICIO_CONVOCATORIAS,
  FIELD_FECHA_FIN_CONVOCATORIAS,
  FIELD_DIRECCION_CONVOCATORIAS,
  FIELD_ORIENTACION_CONVOCATORIAS,
  FIELD_HORAS_ACREDITADAS_CONVOCATORIAS,
  FIELD_CUPOS_DISPONIBLES_CONVOCATORIAS,
  FIELD_TERMINO_CURSAR_CONVOCATORIAS,
  FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
  FIELD_FINALES_ADEUDA_CONVOCATORIAS,
  FIELD_OTRA_SITUACION_CONVOCATORIAS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_TRABAJA_CONVOCATORIAS,
  FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS,
  FIELD_CV_CONVOCATORIAS,
  FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_PENALIZACION_PUNTAJE,
  FIELD_TRABAJA_ESTUDIANTES,
  FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_ESTUDIANTES,
  TABLE_NAME_PRACTICAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PENALIZACIONES,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_PENALIZACION_ESTUDIANTE_LINK,
} from "../constants";
import { normalizeStringForComparison, cleanDbValue } from "../utils/formatters";
import type { LanzamientoPPS, AirtableRecord, EnrichedStudent, ConvocatoriaFields } from "../types";
import { sendSmartEmail } from "../utils/emailService";

const SCORE_WEIGHTS = {
  TERMINO_CURSAR: 100,
  CURSANDO_ELECTIVAS: 50,
  BASE_FINALES: 30,
  PER_HOUR: 0.5,
  TRABAJA: 20,
};

const calculateScore = (
  enrollment: AirtableRecord<ConvocatoriaFields>,
  hours: number,
  penalties: number,
  works: boolean
): number => {
  let academicScore = 0;
  const termino = enrollment[FIELD_TERMINO_CURSAR_CONVOCATORIAS] === "Sí";
  const electivas = enrollment[FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS] === "Sí";

  if (termino) {
    academicScore = SCORE_WEIGHTS.TERMINO_CURSAR;
  } else if (electivas) {
    academicScore = SCORE_WEIGHTS.CURSANDO_ELECTIVAS;
  } else {
    academicScore = SCORE_WEIGHTS.BASE_FINALES;
  }

  const hoursScore = hours * SCORE_WEIGHTS.PER_HOUR;
  const workScore = works ? SCORE_WEIGHTS.TRABAJA : 0;
  const penaltyScore = penalties;

  return Math.round(academicScore + hoursScore + workScore - penaltyScore);
};

export const useSeleccionadorLogic = (
  isTestingMode = false,
  onNavigateToInsurance?: (id: string) => void,
  initialLaunchId?: string | null,
  preSelectedLaunchId?: string | null
) => {
  // preSelectedLaunchId has priority over initialLaunchId
  const priorityLaunchId = preSelectedLaunchId || initialLaunchId;

  const [selectedLanzamiento, setSelectedLanzamiento] = useState<LanzamientoPPS | null>(null);
  const [viewMode, setViewMode] = useState<"selection" | "review">("selection");
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isClosingTable, setIsClosingTable] = useState(false);

  const queryClient = useQueryClient();

  const { data: openLaunches = [], isLoading: isLoadingLaunches } = useQuery({
    queryKey: ["openLaunchesForSelector", isTestingMode, initialLaunchId],
    queryFn: async () => {
      let records: any[] = [];
      if (isTestingMode) {
        records = await mockDb.getAll("lanzamientos_pps");
      } else {
        records = await db.lanzamientos.getAll();
      }

      return records
        .map((r) => {
          // PRE-CLEAN DATA ON FETCH
          const cleaned = { ...r };
          cleaned[FIELD_NOMBRE_PPS_LANZAMIENTOS] = cleanDbValue(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
          return cleaned as LanzamientoPPS;
        })
        .filter((l) => {
          const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
          // Si hay un initialLaunchId (viene del historial), mostrar todas las convocatorias
          // Si no, solo mostrar las abiertas
          if (initialLaunchId) {
            return (
              status === "abierta" ||
              status === "abierto" ||
              status === "cerrado" ||
              status === "cerrada"
            );
          }
          return status === "abierta" || status === "abierto";
        });
    },
  });

  useEffect(() => {
    if (initialLaunchId && openLaunches.length > 0 && !selectedLanzamiento) {
      const target = openLaunches.find((l) => l.id === initialLaunchId);
      if (target) {
        setSelectedLanzamiento(target);
      }
    }
  }, [initialLaunchId, openLaunches, selectedLanzamiento]);

  // Auto-select launch when navigating from AdminDashboard with priorityLaunchId
  // NOTA: Ya no cambiamos automáticamente a modo review para permitir gestión completa
  useEffect(() => {
    if (priorityLaunchId && openLaunches.length > 0 && !selectedLanzamiento) {
      const target = openLaunches.find((l) => l.id === priorityLaunchId);
      if (target) {
        setSelectedLanzamiento(target);
        // Mantener en modo selection para ver todos los inscriptos
        setViewMode("selection");
        console.log("[useSeleccionadorLogic] Auto-selected launch for full management:", target.id);
      }
    }
  }, [priorityLaunchId, openLaunches, selectedLanzamiento]);

  // Re-run selection when preSelectedLaunchId changes (e.g., when navigating from AdminDashboard)
  useEffect(() => {
    if (initialLaunchId && openLaunches.length > 0) {
      const target = openLaunches.find((l) => l.id === initialLaunchId);
      if (target && (!selectedLanzamiento || selectedLanzamiento.id !== target.id)) {
        setSelectedLanzamiento(target);
      }
    }
  }, [initialLaunchId, openLaunches]);

  const candidatesQueryKey = ["candidatesForLaunch", selectedLanzamiento?.id, isTestingMode];

  const {
    data: candidates = [],
    isLoading: isLoadingCandidates,
    refetch: refetchCandidates,
  } = useQuery({
    queryKey: candidatesQueryKey,
    queryFn: async () => {
      if (!selectedLanzamiento) return [];
      const launchId = selectedLanzamiento.id;

      let allEnrollments: any[] = [];
      if (isTestingMode) {
        allEnrollments = await mockDb.getAll("convocatorias");
      } else {
        allEnrollments = await db.convocatorias.getAll();
      }

      // FILTER: Enrollments for this launch
      const enrollments = allEnrollments.filter(
        (c) => c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] === launchId
      );

      if (enrollments.length === 0) return [];

      const studentIds = enrollments
        .map((e) => e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS])
        .filter(Boolean) as string[];

      let studentsRes: any[] = [],
        practicasRes: any[] = [],
        penaltiesRes: any[] = [];
      if (isTestingMode) {
        [studentsRes, practicasRes, penaltiesRes] = await Promise.all([
          mockDb.getAll("estudiantes", { id: studentIds }),
          mockDb.getAll("practicas", { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds }),
          mockDb.getAll("penalizaciones", { [FIELD_PENALIZACION_ESTUDIANTE_LINK]: studentIds }),
        ]);
      } else {
        // Using 'in' filter for array of IDs
        [studentsRes, practicasRes, penaltiesRes] = await Promise.all([
          db.estudiantes.getAll({ filters: { id: studentIds } }),
          db.practicas.getAll({ filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds } }),
          db.penalizaciones.getAll({
            filters: { [FIELD_PENALIZACION_ESTUDIANTE_LINK]: studentIds },
          }),
        ]);
      }

      const studentMap = new Map(studentsRes.map((s) => [s.id, s]));

      const enrichedList: EnrichedStudent[] = enrollments
        .map((enrollment) => {
          const sId = enrollment[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
          const studentDetails = sId ? studentMap.get(sId) : null;

          if (!studentDetails) return null;

          // Calc total hours & count
          const studentPractices = practicasRes.filter(
            (p) => p[FIELD_ESTUDIANTE_LINK_PRACTICAS] === sId
          );
          const totalHoras = studentPractices.reduce(
            (sum: number, p: any) => sum + (p[FIELD_HORAS_PRACTICAS] || 0),
            0
          );
          const cantPracticas = studentPractices.length;

          // Calc penalties
          const studentPenalties = penaltiesRes.filter(
            (p) => p[FIELD_PENALIZACION_ESTUDIANTE_LINK] === sId
          );
          const penalizacionAcumulada = studentPenalties.reduce(
            (sum: number, p: any) => sum + (p[FIELD_PENALIZACION_PUNTAJE] || 0),
            0
          );

          const works =
            !!enrollment[FIELD_TRABAJA_CONVOCATORIAS] ||
            !!studentDetails[FIELD_TRABAJA_ESTUDIANTES];
          const cert =
            enrollment[FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS] ||
            studentDetails[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES];
          const cvUrl = enrollment[FIELD_CV_CONVOCATORIAS] as string | null;

          const puntajeTotal = calculateScore(enrollment, totalHoras, penalizacionAcumulada, works);

          return {
            enrollmentId: enrollment.id,
            studentId: sId,
            nombre: studentDetails[FIELD_NOMBRE_ESTUDIANTES] || "Desconocido",
            legajo: String(studentDetails[FIELD_LEGAJO_ESTUDIANTES] || ""),
            correo: studentDetails[FIELD_CORREO_ESTUDIANTES] || "",
            telefono: studentDetails[FIELD_TELEFONO_ESTUDIANTES] || "",
            status: enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "Inscripto",
            terminoCursar: enrollment[FIELD_TERMINO_CURSAR_CONVOCATORIAS] === "Sí",
            cursandoElectivas: enrollment[FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS] === "Sí",
            finalesAdeuda: enrollment[FIELD_FINALES_ADEUDA_CONVOCATORIAS] || "",
            notasEstudiante: enrollment[FIELD_OTRA_SITUACION_CONVOCATORIAS] || "",
            horarioSeleccionado: enrollment[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || "",
            totalHoras,
            cantPracticas,
            penalizacionAcumulada,
            puntajeTotal,
            trabaja: works,
            certificadoTrabajo: cert as string,
            cvUrl: cvUrl,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) as EnrichedStudent[];

      return enrichedList.sort((a, b) => b.puntajeTotal - a.puntajeTotal);
    },
    enabled: !!selectedLanzamiento,
  });

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => normalizeStringForComparison(c.status) === "seleccionado"),
    [candidates]
  );

  // Filtrar candidatos según el modo de vista
  const displayedCandidates = useMemo(() => {
    if (viewMode === "review") {
      return selectedCandidates;
    }
    return candidates;
  }, [candidates, selectedCandidates, viewMode]);

  const toggleMutation = useMutation({
    mutationFn: async (student: EnrichedStudent) => {
      if (!selectedLanzamiento) return;
      const isCurrentlySelected = normalizeStringForComparison(student.status) === "seleccionado";

      if (isTestingMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const newStatus = isCurrentlySelected ? "Inscripto" : "Seleccionado";
        await mockDb.update("convocatorias", student.enrollmentId, {
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: newStatus,
        });
        return { success: true, student };
      }

      const result = await toggleStudentSelection(
        student.enrollmentId,
        !isCurrentlySelected,
        student.studentId,
        selectedLanzamiento
      );
      return { ...result, student };
    },
    onMutate: async (student) => {
      await queryClient.cancelQueries({ queryKey: candidatesQueryKey });
      const previousCandidates = queryClient.getQueryData<EnrichedStudent[]>(candidatesQueryKey);

      // Optimistic Update
      queryClient.setQueryData(candidatesQueryKey, (old: EnrichedStudent[] | undefined) => {
        if (!old) return [];
        return old.map((c) => {
          if (c.enrollmentId === student.enrollmentId) {
            const newStatus =
              normalizeStringForComparison(c.status) === "seleccionado"
                ? "Inscripto"
                : "Seleccionado";
            return { ...c, status: newStatus };
          }
          return c;
        });
      });
      return { previousCandidates };
    },
    onSuccess: (data, vars, context) => {
      if (!data?.success) {
        setToastInfo({ message: `Error: ${data?.error}`, type: "error" });
        if (context?.previousCandidates)
          queryClient.setQueryData(candidatesQueryKey, context.previousCandidates);
      }
      queryClient.invalidateQueries({ queryKey: candidatesQueryKey });
    },
    onError: (err, vars, context) => {
      setToastInfo({ message: `Error: ${err.message}`, type: "error" });
      if (context?.previousCandidates)
        queryClient.setQueryData(candidatesQueryKey, context.previousCandidates);
    },
    onSettled: () => setUpdatingId(null),
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({ id, schedule }: { id: string; schedule: string }) => {
      if (isTestingMode)
        return mockDb.update("convocatorias", id, {
          [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: schedule,
        });
      return db.convocatorias.update(id, { [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: schedule });
    },
    onSuccess: () => {
      setToastInfo({ message: "Horario actualizado.", type: "success" });
      refetchCandidates();
    },
  });

  const closeLaunchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLanzamiento) return;
      if (isTestingMode)
        return mockDb.update("lanzamientos_pps", selectedLanzamiento.id, {
          [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrado",
        });
      return db.lanzamientos.update(selectedLanzamiento.id, {
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrado",
      });
    },
    onSuccess: () => {
      setToastInfo({ message: "Convocatoria cerrada exitosamente.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["openLaunchesForSelector"] });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
      setSelectedLanzamiento(null);
    },
    onError: (err: Error) =>
      setToastInfo({ message: `Error al cerrar: ${err.message}`, type: "error" }),
  });

  const handleToggle = (student: EnrichedStudent) => {
    setUpdatingId(student.enrollmentId);
    toggleMutation.mutate(student);
  };

  const handleUpdateSchedule = (id: string, newSchedule: string) => {
    scheduleMutation.mutate({ id, schedule: newSchedule });
  };

  const handleConfirmAndCloseTable = async () => {
    if (!selectedLanzamiento) return;
    setIsClosingTable(true);
    try {
      // Verificar si la convocatoria ya está cerrada (modo gestión de bajas desde historial)
      const isAlreadyClosed =
        normalizeStringForComparison(
          selectedLanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
        ) === "cerrado";

      if (!isTestingMode) {
        // Solo enviar correos si la convocatoria NO estaba cerrada previamente
        if (!isAlreadyClosed) {
          // Email notification loop
          const emailPromises = selectedCandidates.map(async (student) => {
            const encuentroInicial =
              selectedLanzamiento[FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS];
            let encuentroText = "";
            if (encuentroInicial) {
              const dateObj = new Date(encuentroInicial as string);
              const fechaStr = dateObj.toLocaleDateString("es-AR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              });
              const hora = dateObj.getHours().toString().padStart(2, "0");
              const minutos = dateObj.getMinutes().toString().padStart(2, "0");
              encuentroText = `${fechaStr} a las ${hora}:${minutos} hs`;
            }
            return sendSmartEmail("seleccion", {
              studentName: student.nombre,
              studentEmail: student.correo,
              ppsName: selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS],
              schedule: (student.horarioSeleccionado || "A confirmar") as string,
              encuentroInicial: encuentroText || undefined,
            });
          });
          await Promise.all(emailPromises);

          // Push notification for each selected student
          try {
            const { data: pushTemplate } = await supabase
              .from("email_templates")
              .select("subject, body, is_active")
              .eq("id", "seleccion_push")
              .single();

            if (pushTemplate?.is_active !== false) {
              const pushPromises = selectedCandidates.map(async (student) => {
                const title = (pushTemplate?.subject || "¡Fuiste seleccionado! 🎉")
                  .replace("{{nombre_alumno}}", student.nombre)
                  .replace("{{nombre_pps}}", selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]);

                const message = (
                  pushTemplate?.body ||
                  "Hola {{nombre_alumno}}, has sido seleccionado para la PPS: {{nombre_pps}}. Revisá tu correo para más detalles."
                )
                  .replace("{{nombre_alumno}}", student.nombre)
                  .replace("{{nombre_pps}}", selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]);

                return supabase.functions.invoke("send-push", {
                  body: {
                    title,
                    message,
                    url: "/student/practicas",
                    user_id: student.studentId,
                  },
                });
              });
              await Promise.all(pushPromises);
              console.log("[Seleccionador] Push notifications sent successfully");
            }
          } catch (pushError) {
            console.error("[Seleccionador] Error sending push notifications:", pushError);
            // Don't fail the whole operation if push fails
          }

          // Close Launch solo si no estaba cerrada
          await db.lanzamientos.update(selectedLanzamiento.id, {
            [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrado",
          });
        }
      } else {
        await mockDb.update("lanzamientos_pps", selectedLanzamiento.id, {
          [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrado",
        });
      }
      setToastInfo({
        message: isAlreadyClosed ? `Cambios guardados.` : `Mesa cerrada.`,
        type: "success",
      });
      if (onNavigateToInsurance)
        setTimeout(() => onNavigateToInsurance(selectedLanzamiento.id), 1500);
      else {
        queryClient.invalidateQueries({ queryKey: ["openLaunchesForSelector"] });
        queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
        setSelectedLanzamiento(null);
      }
    } catch (e: any) {
      setToastInfo({ message: `Error: ${e.message}`, type: "error" });
    } finally {
      setIsClosingTable(false);
    }
  };

  // Query para estudiantes disponibles (no inscriptos)
  const { data: availableStudents = [], isLoading: isLoadingAvailable } = useQuery({
    queryKey: ["availableStudents", selectedLanzamiento?.id, isTestingMode],
    queryFn: async () => {
      if (!selectedLanzamiento) return [];

      // Traer todos los estudiantes
      let allStudents: any[] = [];
      if (isTestingMode) {
        allStudents = await mockDb.getAll("estudiantes");
      } else {
        allStudents = await db.estudiantes.getAll();
      }

      // Filtrar los que ya están inscriptos
      const enrolledIds = new Set(candidates.map((c) => c.studentId));
      return allStudents.filter((s) => !enrolledIds.has(s.id));
    },
    enabled: !!selectedLanzamiento && candidates.length > 0,
  });

  // Mutation para inscribir nuevo estudiante
  const enrollNewStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!selectedLanzamiento) return;

      if (isTestingMode) {
        await mockDb.create("convocatorias", {
          [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: selectedLanzamiento.id,
          [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentId,
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "seleccionado",
        });
      } else {
        await db.convocatorias.create({
          [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: selectedLanzamiento.id,
          [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentId,
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "seleccionado",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidatesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["availableStudents"] });
      setToastInfo({ message: "Estudiante inscripto correctamente", type: "success" });
    },
    onError: () => {
      setToastInfo({ message: "Error al inscribir estudiante", type: "error" });
    },
  });

  return {
    selectedLanzamiento,
    setSelectedLanzamiento,
    viewMode,
    setViewMode,
    toastInfo,
    setToastInfo,
    updatingId,
    isClosingTable,
    openLaunches,
    isLoadingLaunches,
    candidates,
    isLoadingCandidates,
    selectedCandidates,
    displayedCandidates,
    handleToggle,
    handleUpdateSchedule,
    handleConfirmAndCloseTable,
    closeLaunchMutation,
    availableStudents,
    isLoadingAvailable,
    enrollNewStudent: enrollNewStudentMutation.mutate,
  };
};
