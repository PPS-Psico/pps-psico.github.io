import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS,
  FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
  FIELD_CV_CONVOCATORIAS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_FINALES_ADEUDA_CONVOCATORIAS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_HORARIO_ASIGNADO_CONVOCATORIAS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_ESTADO_PRACTICA,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_DESAPROBACION_FECHA_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_OTRA_SITUACION_CONVOCATORIAS,
  FIELD_PENALIZACION_ESTUDIANTE_LINK,
  FIELD_PENALIZACION_TIPO,
  FIELD_PENALIZACION_FECHA,
  FIELD_PENALIZACION_NOTAS,
  FIELD_PENALIZACION_PUNTAJE,
  FIELD_PENALIZACION_CONVOCATORIA_LINK,
  FIELD_PENALIZACION_CONVOCATORIA_ID,
  FIELD_PENALIZACION_LANZAMIENTO_ID,
  FIELD_PENALIZACION_ESTADO,
  FIELD_TELEFONO_ESTUDIANTES,
  FIELD_TERMINO_CURSAR_CONVOCATORIAS,
  FIELD_TRABAJA_CONVOCATORIAS,
  FIELD_TRABAJA_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_USER_ID_ESTUDIANTES,
  getPenaltyScore,
  isActivePenalty,
  type PenaltyType,
} from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import { invalidateLaunchData } from "../lib/launchQueryKeys";
import {
  darBajaPpsConPenalizacion,
  toggleStudentSelection,
  updatePracticaFromSchedule,
} from "../services";
import { mockDb } from "../services/mockDb";
import type {
  AirtableRecord,
  ConvocatoriaFields,
  EnrichedStudent,
  LanzamientoPPS,
  Estudiante,
  Practica,
  Penalizacion,
} from "../types";
import { cleanDbValue, normalizeStringForComparison, safeGetId } from "../utils/formatters";
import { calculateScore } from "../utils/seleccionadorScore";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";
import { calculateTotalHours, isPracticeDisapproved } from "../logic/studentRules";
import { getOptionScheduleSlots } from "../utils/launchOptions";

type CompromisoLite = {
  convocatoria_id: string | null;
  estado: string | null;
  accepted_at: string | null;
};

export const useSeleccionadorLogic = (
  isTestingMode = false,
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
  const [assignmentChoiceByEnrollment, setAssignmentChoiceByEnrollment] = useState<
    Record<string, string>
  >({});

  const queryClient = useQueryClient();

  const { data: openLaunches = [], isLoading: isLoadingLaunches } = useQuery({
    queryKey: ["openLaunchesForSelector", isTestingMode, initialLaunchId],
    queryFn: async () => {
      let records: Record<string, unknown>[] = [];
      if (isTestingMode) {
        records = await mockDb.getAll("lanzamientos_pps");
      } else {
        records = (await db.lanzamientos.getAll()) as unknown as Record<string, unknown>[];
      }

      const launches = records
        .map((r) => {
          // PRE-CLEAN DATA ON FETCH
          const cleaned = { ...r };
          cleaned[FIELD_NOMBRE_PPS_LANZAMIENTOS] = cleanDbValue(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
          return cleaned as unknown as LanzamientoPPS;
        })
        .filter((l) => {
          const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
          // Si hay un initialLaunchId (viene del historial o de una etapa del
          // lanzador), mostrar todas las convocatorias.
          if (initialLaunchId) {
            // El lanzamiento pedido explícitamente SIEMPRE se incluye, sin importar
            // su estado (p. ej. "Confirmacion" o "Activa"); de lo contrario el
            // selector de gestión no lo encontraría y no se podría seleccionar
            // ni dar de baja desde la sala de confirmación.
            if (l.id === initialLaunchId) return true;
            return (
              status === "abierta" ||
              status === "abierto" ||
              status === "cerrado" ||
              status === "cerrada"
            );
          }
          return status === "abierta" || status === "abierto";
        });
      if (!isTestingMode && launches.length > 0) {
        const { data: optionRows } = await supabase
          .from("lanzamiento_opciones")
          .select("*, franjas:lanzamiento_opcion_horarios(*)")
          .in(
            "lanzamiento_id",
            launches.map((launch) => launch.id)
          )
          .eq("activa", true)
          .order("orden", { ascending: true });
        return launches.map((launch) => ({
          ...launch,
          opciones: (optionRows || [])
            .filter((option) => option.lanzamiento_id === launch.id)
            .map((option) => ({
              ...option,
              franjas: (option.franjas || []).slice().sort((a, b) => a.orden - b.orden),
            })),
        }));
      }
      return launches;
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
        logger.info("[useSeleccionadorLogic] Auto-selected launch for full management:", target.id);
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
    // NO incluir selectedLanzamiento: el efecto solo debe reaccionar a la
    // navegación (initialLaunchId/openLaunches). Agregarlo re-seleccionaría el
    // lanzamiento inicial cada vez que el usuario elige otro, pisando su elección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // El filtro va en la base, no en el cliente: `convocatorias` tiene miles de
      // filas históricas y sirven ~20. La columna está indexada
      // (idx_convocatorias_lanzamiento_id), así que es una sola ida barata.
      let enrollments: ConvocatoriaFields[] = [];
      if (isTestingMode) {
        const allEnrollments: ConvocatoriaFields[] = await mockDb.getAll("convocatorias");
        enrollments = allEnrollments.filter(
          (c) => c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] === launchId
        );
      } else {
        enrollments = await db.convocatorias.getAll({
          filters: { [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: launchId },
        });
      }

      if (enrollments.length === 0) return [];

      const studentIds = enrollments
        .map((e) => e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS])
        .filter(Boolean) as string[];

      let studentsRes: Estudiante[] = [],
        practicasRes: Practica[] = [],
        penaltiesRes: Penalizacion[] = [],
        compromisosRes: CompromisoLite[] = [];
      let preferencesRes: {
        convocatoria_id: string;
        opcion_id: string;
        opcion_horario_id: string | null;
        prioridad: number;
      }[] = [];
      if (isTestingMode) {
        [studentsRes, practicasRes, penaltiesRes] = await Promise.all([
          mockDb.getAll("estudiantes", { id: studentIds }),
          mockDb.getAll("practicas", { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds }),
          mockDb.getAll("penalizaciones", { [FIELD_PENALIZACION_ESTUDIANTE_LINK]: studentIds }),
        ]);
      } else {
        // Using 'in' filter for array of IDs
        const [students, practicas, penalties, compromisos, preferences] = await Promise.all([
          db.estudiantes.getAll({ filters: { id: studentIds } }),
          db.practicas.getAll({ filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds } }),
          db.penalizaciones.getAll({
            filters: { [FIELD_PENALIZACION_ESTUDIANTE_LINK]: studentIds },
          }),
          supabase
            .from("compromisos_pps")
            .select("convocatoria_id, estado, accepted_at")
            .eq("lanzamiento_id", launchId),
          supabase
            .from("convocatoria_preferencias")
            .select("convocatoria_id, opcion_id, opcion_horario_id, prioridad")
            .in(
              "convocatoria_id",
              enrollments.map((enrollment) => enrollment.id)
            )
            .order("prioridad", { ascending: true }),
        ]);
        studentsRes = students;
        practicasRes = practicas;
        penaltiesRes = penalties;
        compromisosRes = compromisos.data || [];
        preferencesRes = preferences.data || [];
      }

      const studentMap = new Map(studentsRes.map((s) => [s.id, s]));
      const compromisoMap = new Map(
        (compromisosRes || [])
          .filter((item) => !!item.convocatoria_id)
          .map((item) => [item.convocatoria_id, item])
      );

      const enrichedList: EnrichedStudent[] = enrollments
        .map((enrollment) => {
          const sId = enrollment[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
          const studentDetails = sId ? studentMap.get(sId) : null;

          if (!studentDetails) return null;

          // Calc total hours & count
          const studentPractices = practicasRes.filter(
            (p) => p[FIELD_ESTUDIANTE_LINK_PRACTICAS] === sId
          );
          const totalHoras = calculateTotalHours(studentPractices);
          const cantPracticas = studentPractices.length;
          const desaprobaciones = studentPractices
            .filter((p) => isPracticeDisapproved(p[FIELD_ESTADO_PRACTICA]))
            .map((p) => ({
              practicaId: p.id,
              lanzamientoId: p.lanzamiento_id,
              nombreInstitucion:
                cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || "PPS",
              fecha: p[FIELD_DESAPROBACION_FECHA_PRACTICAS],
            }));

          // Calc penalties
          const studentPenalties = penaltiesRes.filter(
            (p) =>
              p[FIELD_PENALIZACION_ESTUDIANTE_LINK] === sId &&
              isActivePenalty(p[FIELD_PENALIZACION_ESTADO])
          );
          const penalizacionAcumulada = studentPenalties.reduce(
            (sum: number, p) => sum + (p[FIELD_PENALIZACION_PUNTAJE] || 0),
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
          const compromiso = compromisoMap.get(enrollment.id);
          const preferredOptionIds = preferencesRes
            .filter((preference) => preference.convocatoria_id === enrollment.id)
            .sort((a, b) => a.prioridad - b.prioridad)
            .map((preference) => preference.opcion_id);
          const opcionesPreferidas = (selectedLanzamiento.opciones || []).filter((option) =>
            preferredOptionIds.includes(option.id)
          );
          opcionesPreferidas.sort(
            (a, b) => preferredOptionIds.indexOf(a.id) - preferredOptionIds.indexOf(b.id)
          );
          const preferredScheduleIds = preferencesRes
            .filter((preference) => preference.convocatoria_id === enrollment.id)
            .sort((a, b) => a.prioridad - b.prioridad)
            .map((preference) => preference.opcion_horario_id)
            .filter((id): id is string => Boolean(id));
          const horariosOpcionPreferidos = (selectedLanzamiento.opciones || [])
            .flatMap(getOptionScheduleSlots)
            .filter((schedule) => preferredScheduleIds.includes(schedule.id));
          horariosOpcionPreferidos.sort(
            (a, b) => preferredScheduleIds.indexOf(a.id) - preferredScheduleIds.indexOf(b.id)
          );

          return {
            enrollmentId: enrollment.id,
            studentId: sId,
            userId: studentDetails[FIELD_USER_ID_ESTUDIANTES],
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
            horarioAsignado:
              enrollment[FIELD_HORARIO_ASIGNADO_CONVOCATORIAS] !== undefined &&
              enrollment[FIELD_HORARIO_ASIGNADO_CONVOCATORIAS] !== null
                ? String(enrollment[FIELD_HORARIO_ASIGNADO_CONVOCATORIAS])
                : null,
            opcionAsignadaId: enrollment.opcion_asignada_id,
            opcionHorarioAsignadoId: enrollment.opcion_horario_asignado_id,
            opcionesPreferidas,
            horariosOpcionPreferidos,
            totalHoras,
            cantPracticas,
            penalizacionAcumulada,
            desaprobaciones,
            puntajeTotal,
            trabaja: works,
            certificadoTrabajo: cert as string,
            cvUrl: cvUrl,
            compromisoEstado: compromiso?.estado || null,
            compromisoFecha: compromiso?.accepted_at || null,
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
      const selectedScheduleId =
        assignmentChoiceByEnrollment[student.enrollmentId] || student.opcionHorarioAsignadoId;

      if ((selectedLanzamiento.opciones || []).length > 0 && !selectedScheduleId) {
        throw new Error("Elegí una de las preferencias del estudiante antes de seleccionarlo.");
      }

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
        selectedLanzamiento,
        student.horarioAsignado || student.horarioSeleccionado,
        selectedScheduleId ?? undefined
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
      // Propaga el cambio de selección a sidebar/canvas (conteos, roster, etc.).
      invalidateLaunchData(queryClient);
    },
    onError: (err, vars, context) => {
      setToastInfo({ message: `Error: ${err.message}`, type: "error" });
      if (context?.previousCandidates)
        queryClient.setQueryData(candidatesQueryKey, context.previousCandidates);
    },
    onSettled: () => setUpdatingId(null),
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({
      id,
      schedule,
      student,
      isSelected,
    }: {
      id: string;
      schedule: string;
      isEditMode?: boolean;
      student: EnrichedStudent;
      isSelected: boolean;
    }) => {
      const updateData: Record<string, string> = {
        [FIELD_HORARIO_ASIGNADO_CONVOCATORIAS]: schedule,
      };

      if (!isTestingMode && isSelected && selectedLanzamiento) {
        await updatePracticaFromSchedule(student.studentId, selectedLanzamiento.id, schedule);
      }

      if (isTestingMode) return mockDb.update("convocatorias", id, updateData);
      return db.convocatorias.update(id, updateData);
    },
    onSuccess: () => {
      setToastInfo({ message: "Horario actualizado.", type: "success" });
      refetchCandidates().then(() => {
        queryClient.invalidateQueries();
      });
    },
    onError: (err) => {
      setToastInfo({ message: `Error: ${err.message}`, type: "error" });
    },
  });

  const handleToggle = (student: EnrichedStudent) => {
    if (
      normalizeStringForComparison(student.status) !== "seleccionado" &&
      (selectedLanzamiento?.opciones || []).length > 0 &&
      !assignmentChoiceByEnrollment[student.enrollmentId] &&
      !student.opcionHorarioAsignadoId
    ) {
      setToastInfo({
        message: "Elegí una de las preferencias del estudiante antes de seleccionarlo.",
        type: "error",
      });
      return;
    }
    setUpdatingId(student.enrollmentId);
    toggleMutation.mutate(student);
  };

  const handleOptionChoice = (enrollmentId: string, scheduleId: string) => {
    setAssignmentChoiceByEnrollment((current) => ({ ...current, [enrollmentId]: scheduleId }));
  };

  const handleBajaConPenalizacion = async (
    student: EnrichedStudent,
    tipoIncumplimiento: PenaltyType,
    notas?: string | null
  ) => {
    if (!selectedLanzamiento) {
      throw new Error("No hay una convocatoria seleccionada.");
    }

    let result: { penalizacionId: string; practicasEliminadas: number };

    if (isTestingMode) {
      await mockDb.update("convocatorias", student.enrollmentId, {
        [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "No Seleccionado",
      });

      const practices = (await mockDb.getAll("practicas")) as Practica[];
      const activePractices = practices.filter(
        (practice) =>
          safeGetId(practice[FIELD_ESTUDIANTE_LINK_PRACTICAS]) === student.studentId &&
          safeGetId(practice[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]) === selectedLanzamiento.id &&
          normalizeStringForComparison(practice[FIELD_ESTADO_PRACTICA]) === "en curso"
      );
      await Promise.all(activePractices.map((practice) => mockDb.delete("practicas", practice.id)));

      const penalty = await mockDb.create("penalizaciones", {
        [FIELD_PENALIZACION_ESTUDIANTE_LINK]: student.studentId,
        [FIELD_PENALIZACION_TIPO]: tipoIncumplimiento,
        [FIELD_PENALIZACION_FECHA]: new Date().toISOString().split("T")[0],
        [FIELD_PENALIZACION_NOTAS]: notas?.trim() || null,
        [FIELD_PENALIZACION_PUNTAJE]: getPenaltyScore(tipoIncumplimiento),
        [FIELD_PENALIZACION_CONVOCATORIA_LINK]:
          selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS",
        [FIELD_PENALIZACION_CONVOCATORIA_ID]: student.enrollmentId,
        [FIELD_PENALIZACION_LANZAMIENTO_ID]: selectedLanzamiento.id,
      });

      result = {
        penalizacionId: penalty.id,
        practicasEliminadas: activePractices.length,
      };
    } else {
      result = await darBajaPpsConPenalizacion({
        convocatoriaId: student.enrollmentId,
        tipoIncumplimiento,
        notas,
      });
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: candidatesQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["availableStudents"] }),
    ]);
    invalidateLaunchData(queryClient);
    return result;
  };

  const handleUpdateSchedule = (student: EnrichedStudent, schedule: string) => {
    scheduleMutation.mutate({
      id: student.enrollmentId,
      schedule,
      isEditMode,
      student,
      isSelected: normalizeStringForComparison(student.status) === "seleccionado",
    });
  };

  // Query para estudiantes disponibles (no inscriptos)
  const { data: availableStudents = [], isLoading: isLoadingAvailable } = useQuery({
    queryKey: ["availableStudents", selectedLanzamiento?.id, isTestingMode],
    queryFn: async () => {
      if (!selectedLanzamiento) return [];

      // Traer todos los estudiantes
      let allStudents: Estudiante[] = [];
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
        const student = await db.estudiantes.get({ filters: { id: studentId } });
        if (student && student.length > 0) {
          const est = student[0];
          const estado = normalizeStringForComparison(
            est[FIELD_ESTADO_ESTUDIANTES as keyof typeof est] as string
          );
          if (estado !== "activo") {
            throw new Error("El estudiante no está activo. No se puede inscribir.");
          }
          if (
            !est[FIELD_DNI_ESTUDIANTES as keyof typeof est] ||
            String(est[FIELD_DNI_ESTUDIANTES as keyof typeof est]).trim() === ""
          ) {
            throw new Error(
              "El estudiante no tiene DNI cargado. Complete los datos del estudiante primero."
            );
          }
        }

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
      invalidateLaunchData(queryClient);
      setToastInfo({ message: "Estudiante inscripto correctamente", type: "success" });
    },
    onError: (error) => {
      setToastInfo({
        message: getErrorMessage(error, "Error al inscribir estudiante"),
        type: "error",
      });
    },
  });

  // Determinar si se debe mostrar el selector de horarios
  const scheduleInfo = useMemo(() => {
    if (!selectedLanzamiento) {
      return { showScheduleSelector: false, horariosFijos: false, singleSchedule: false };
    }

    if ((selectedLanzamiento.opciones || []).length > 0) {
      return { showScheduleSelector: false, horariosFijos: false, singleSchedule: false };
    }

    const horariosFijos = !!selectedLanzamiento[FIELD_HORARIOS_FIJOS_LANZAMIENTOS];
    const horarioSeleccionado = selectedLanzamiento[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS];

    // Si los horarios son fijos, no mostrar selector
    if (horariosFijos) {
      return { showScheduleSelector: false, horariosFijos: true, singleSchedule: false };
    }

    // Si hay un solo horario (no contiene punto y coma), no mostrar selector
    const horariosList = horarioSeleccionado
      ? String(horarioSeleccionado)
          .split(";")
          .filter((h) => h.trim())
      : [];
    const singleSchedule = horariosList.length === 1;

    return {
      showScheduleSelector: !singleSchedule,
      horariosFijos: false,
      singleSchedule,
      horariosDisponibles: horariosList,
    };
  }, [selectedLanzamiento]);

  // Determinar si estamos en modo edición (convocatoria ya cerrada)
  const isEditMode = useMemo(() => {
    if (!selectedLanzamiento) return false;
    return (
      normalizeStringForComparison(selectedLanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]) ===
      "cerrado"
    );
  }, [selectedLanzamiento]);

  return {
    selectedLanzamiento,
    setSelectedLanzamiento,
    viewMode,
    setViewMode,
    toastInfo,
    setToastInfo,
    updatingId,
    openLaunches,
    isLoadingLaunches,
    candidates,
    isLoadingCandidates,
    selectedCandidates,
    displayedCandidates,
    scheduleInfo,
    isEditMode,
    handleToggle,
    assignmentChoiceByEnrollment,
    handleOptionChoice,
    handleBajaConPenalizacion,
    handleUpdateSchedule,
    availableStudents,
    isLoadingAvailable,
    enrollNewStudent: enrollNewStudentMutation.mutate,
  };
};
