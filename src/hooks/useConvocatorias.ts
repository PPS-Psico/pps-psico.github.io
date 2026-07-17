import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useModal } from "../contexts/ModalContext";
import { fetchConvocatoriasData } from "../services";
import { db } from "../lib/db";
import { mockDb } from "../services/mockDb";
import type {
  LanzamientoPPS,
  InformeTask,
  AppRecord,
  ConvocatoriaFields,
  Estudiante,
  EnrollmentFormData,
} from "../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_CONVOCATORIAS,
  FIELD_FECHA_INICIO_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_LEGAJO_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_TERMINO_CURSAR_CONVOCATORIAS,
  FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
  FIELD_FINALES_ADEUDA_CONVOCATORIAS,
  FIELD_OTRA_SITUACION_CONVOCATORIAS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_ORIENTACION_CONVOCATORIAS,
  FIELD_HORAS_ACREDITADAS_CONVOCATORIAS,
  FIELD_CORREO_CONVOCATORIAS,
  FIELD_TELEFONO_CONVOCATORIAS,
  FIELD_DNI_CONVOCATORIAS,
  FIELD_INFORME_SUBIDO_CONVOCATORIAS,
  FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS,
  FIELD_NOTA_PRACTICAS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_FECHA_FIN_CONVOCATORIAS,
  FIELD_DIRECCION_CONVOCATORIAS,
  FIELD_TRABAJA_ESTUDIANTES,
  FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES,
  FIELD_TRABAJA_CONVOCATORIAS,
  FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS,
  FIELD_CV_CONVOCATORIAS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_ESTADO_ESTUDIANTES,
} from "../constants";
import { normalizeStringForComparison, cleanInstitutionName, safeGetId } from "../utils/formatters";
import { logger } from "../utils/logger";
import {
  getMandatoryLaunchSchedules,
  mergeMandatorySchedules,
  parseLaunchSchedules,
} from "../utils/scheduleRequirements";

type ConvocatoriasQueryData = Awaited<ReturnType<typeof fetchConvocatoriasData>>;

export const useConvocatorias = (
  legajo: string,
  studentId: string | null,
  studentDetails: Estudiante | null,
  isSuperUserMode: boolean
) => {
  const queryClient = useQueryClient();
  const { showModal, openEnrollmentForm, closeEnrollmentForm, setIsSubmittingEnrollment } =
    useModal();

  const {
    data: convocatoriasData,
    isLoading: isConvocatoriasLoading,
    error: convocatoriasError,
    refetch: refetchConvocatorias,
  } = useQuery({
    queryKey: ["convocatorias", legajo, studentId],
    queryFn: async () => {
      let result: any;
      if (legajo === "99999") {
        const [myConvs, allLanz] = await Promise.all([
          mockDb.getAll("convocatorias", {
            [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentId || "st_999",
          }),
          mockDb.getAll("lanzamientos_pps"),
        ]);
        const launchesMap = new Map(
          allLanz.map((l: Record<string, unknown>) => [l.id as string, l])
        );
        const hydratedEnrollments = myConvs.map((row: Record<string, unknown>) => {
          const launchId = row[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] as string;
          const launch = launchesMap.get(launchId) as Record<string, unknown> | undefined;
          return {
            ...row,
            [FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(
              launch?.[FIELD_NOMBRE_PPS_LANZAMIENTOS]
            ),
            [FIELD_FECHA_INICIO_CONVOCATORIAS]: launch?.[FIELD_FECHA_INICIO_LANZAMIENTOS],
            [FIELD_FECHA_FIN_CONVOCATORIAS]: launch?.[FIELD_FECHA_FIN_LANZAMIENTOS],
            [FIELD_DIRECCION_CONVOCATORIAS]: launch?.[FIELD_DIRECCION_LANZAMIENTOS],
            [FIELD_ORIENTACION_CONVOCATORIAS]: launch?.[FIELD_ORIENTACION_LANZAMIENTOS],
            [FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]: launch?.[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS],
          };
        });
        const availableLaunches = allLanz.filter((l: Record<string, unknown>) => {
          const estadoConv = normalizeStringForComparison(
            l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
          );
          const estadoGestion = l[FIELD_ESTADO_GESTION_LANZAMIENTOS];
          return (
            estadoConv !== "oculto" &&
            estadoGestion !== "Archivado" &&
            estadoGestion !== "No se Relanza"
          );
        });
        const institutionAddressMap = new Map<string, string>();
        allLanz.forEach((l: Record<string, unknown>) => {
          const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | undefined;
          const addr = l[FIELD_DIRECCION_LANZAMIENTOS] as string | undefined;
          if (name && addr) institutionAddressMap.set(normalizeStringForComparison(name), addr);
        });
        result = {
          lanzamientos: availableLaunches,
          myEnrollments: hydratedEnrollments,
          allLanzamientos: allLanz,
          institutionAddressMap,
          institutionLogoMap: new Map(),
        };
      } else {
        result = await fetchConvocatoriasData(studentId);
      }

      try {
        const serialized = {
          lanzamientos: result.lanzamientos,
          myEnrollments: result.myEnrollments,
          allLanzamientos: result.allLanzamientos,
          institutionAddressMap: Array.from(result.institutionAddressMap.entries()),
          institutionLogoMap: result.institutionLogoMap
            ? Array.from(result.institutionLogoMap.entries())
            : [],
        };
        sessionStorage.setItem(`pps_cache_convs_${legajo}`, JSON.stringify(serialized));
      } catch (e) {}

      return result;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem(`pps_cache_convs_${legajo}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            lanzamientos: parsed.lanzamientos,
            myEnrollments: parsed.myEnrollments,
            allLanzamientos: parsed.allLanzamientos,
            institutionAddressMap: new Map(parsed.institutionAddressMap),
            institutionLogoMap: new Map(parsed.institutionLogoMap),
          };
        }
      } catch (e) {}
      return undefined;
    },
    enabled: !!studentId || isSuperUserMode || legajo === "99999",
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  const {
    lanzamientos = [],
    myEnrollments = [],
    allLanzamientos = [],
    institutionAddressMap = new Map(),
    institutionLogoMap = new Map(),
  } = (convocatoriasData as ConvocatoriasQueryData | undefined) || {};

  const enrollmentMutation = useMutation<
    AppRecord<ConvocatoriaFields> | null,
    Error,
    { formData: EnrollmentFormData; selectedLanzamiento: LanzamientoPPS }
  >({
    mutationFn: async ({ formData, selectedLanzamiento }) => {
      const availableSchedules = parseLaunchSchedules(
        selectedLanzamiento[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]
      );
      const mandatorySchedules = getMandatoryLaunchSchedules(
        selectedLanzamiento,
        availableSchedules
      );
      const selectedSchedules = mergeMandatorySchedules(
        formData.horarios,
        mandatorySchedules,
        availableSchedules
      );

      if (legajo === "99999") {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const newRecord = {
          [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: selectedLanzamiento.id,
          [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: "st_999",
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto",
          [FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(
            selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]
          ),
          [FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: formData.cursandoElectivas ? "Sí" : "No",
          [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: selectedSchedules.join("; "),
        };
        await mockDb.create("convocatorias", newRecord);
        return newRecord as unknown as AppRecord<ConvocatoriaFields>;
      }

      if (!studentId) throw new Error("No student ID");

      logger.info("[Enrollment] Validando estudiante:", {
        legajo,
        studentId,
        estado: studentDetails?.[FIELD_ESTADO_ESTUDIANTES],
        dni: studentDetails?.[FIELD_DNI_ESTUDIANTES],
      });

      // Validar estado del estudiante antes de permitir inscripción
      const estadoEstudiante = normalizeStringForComparison(
        studentDetails?.[FIELD_ESTADO_ESTUDIANTES]
      );
      logger.info("[Enrollment] Estado estudiante:", estadoEstudiante);
      if (estadoEstudiante !== "activo") {
        throw new Error("Tu cuenta no está activa. Comunicate con coordinación de PPS.");
      }

      // Validar que tenga DNI cargado (considerar 0 como "sin DNI")
      const dniEstudiante = studentDetails?.[FIELD_DNI_ESTUDIANTES];
      const tieneDniValido =
        dniEstudiante && dniEstudiante !== 0 && String(dniEstudiante).trim() !== "";
      if (!tieneDniValido) {
        throw new Error(
          "Tu registro no tiene DNI cargado. Ve a Mi Perfil para completar tus datos."
        );
      }

      // Validar teléfono
      const telefonoEstudiante = studentDetails?.[FIELD_TELEFONO_ESTUDIANTES];
      if (!telefonoEstudiante || String(telefonoEstudiante).trim() === "") {
        throw new Error(
          "Tu registro no tiene teléfono cargado. Ve a Mi Perfil para completar tus datos."
        );
      }

      // Validar correo
      const correoEstudiante = studentDetails?.[FIELD_CORREO_ESTUDIANTES];
      if (!correoEstudiante || String(correoEstudiante).trim() === "") {
        throw new Error(
          "Tu registro no tiene correo cargado. Ve a Mi Perfil para completar tus datos."
        );
      }

      if (formData.trabaja !== undefined || formData.certificadoTrabajoUrl) {
        await db.estudiantes.update(studentId, {
          [FIELD_TRABAJA_ESTUDIANTES]: formData.trabaja,
          [FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES]:
            formData.certificadoTrabajoUrl ||
            studentDetails?.[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES],
        });
      }

      // CRITICAL FIX: Ensure plain IDs and clean names before sending to Supabase
      // Added FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS and FIELD_FINALES_ADEUDA_CONVOCATORIAS
      const newRecordFields: Record<string, unknown> = {
        [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: safeGetId(selectedLanzamiento.id),
        [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: safeGetId(studentId),
        [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto",
        [FIELD_TERMINO_CURSAR_CONVOCATORIAS]: formData.terminoDeCursar ? "Sí" : "No",
        [FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: formData.cursandoElectivas ? "Sí" : "No",
        [FIELD_FINALES_ADEUDA_CONVOCATORIAS]: formData.finalesAdeudados,
        [FIELD_OTRA_SITUACION_CONVOCATORIAS]: formData.otraSituacionAcademica,
        [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: selectedSchedules.join("; "),
        [FIELD_TRABAJA_CONVOCATORIAS]: formData.trabaja,
        [FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS]:
          formData.certificadoTrabajoUrl || studentDetails?.[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES],
        [FIELD_CV_CONVOCATORIAS]: formData.cvUrl,
        // Snapshot field cleaning
        [FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(
          selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]
        ),
        [FIELD_FECHA_INICIO_CONVOCATORIAS]: selectedLanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS],
        [FIELD_FECHA_FIN_CONVOCATORIAS]: selectedLanzamiento[FIELD_FECHA_FIN_LANZAMIENTOS],
        [FIELD_ORIENTACION_CONVOCATORIAS]: selectedLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS],
        [FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]:
          selectedLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS],
        [FIELD_DIRECCION_CONVOCATORIAS]: selectedLanzamiento[FIELD_DIRECCION_LANZAMIENTOS],
      };

      const legNum = parseInt(legajo, 10);
      if (!isNaN(legNum)) newRecordFields[FIELD_LEGAJO_CONVOCATORIAS] = legNum;
      if (studentDetails) {
        newRecordFields[FIELD_CORREO_CONVOCATORIAS] = studentDetails[FIELD_CORREO_ESTUDIANTES];
        newRecordFields[FIELD_TELEFONO_CONVOCATORIAS] = studentDetails[FIELD_TELEFONO_ESTUDIANTES];
        newRecordFields[FIELD_DNI_CONVOCATORIAS] = studentDetails[FIELD_DNI_ESTUDIANTES];
      }

      const existingConvocatorias = await db.convocatorias.getAll({
        filters: {
          [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: selectedLanzamiento.id,
          [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentId,
        },
      });

      const canceledEnrollment = existingConvocatorias.find(
        (c: ConvocatoriaFields) =>
          normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) ===
          "inscripcion cancelada"
      );

      if (canceledEnrollment) {
        logger.info(
          "[Enrollment] Re-enrolling: Found canceled enrollment, updating:",
          canceledEnrollment.id
        );
        return db.convocatorias.update(canceledEnrollment.id, {
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto",
          ...newRecordFields,
        } as Parameters<typeof db.convocatorias.update>[1]);
      }

      const existingActive = existingConvocatorias.find(
        (c: ConvocatoriaFields) =>
          normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) === "inscripto" ||
          normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) === "seleccionado"
      );

      if (existingActive) {
        throw new Error("Ya estás inscripto a esta PPS.");
      }

      return db.convocatorias.create(
        newRecordFields as Parameters<typeof db.convocatorias.create>[0]
      );
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["convocatorias", legajo, studentId] });
      setIsSubmittingEnrollment(true);
    },
    onError: (err) => {
      showModal("Error", `Error: ${err.message}`);
    },
    onSuccess: () => {
      showModal(
        "Inscripción confirmada",
        "Tu inscripción quedó registrada. Podés revisar los horarios elegidos desde Inicio y te avisaremos cuando finalice la selección."
      );
      queryClient.invalidateQueries({ queryKey: ["convocatorias", legajo, studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", legajo] });
      closeEnrollmentForm();
    },
    onSettled: () => {
      setIsSubmittingEnrollment(false);
    },
  });

  const cancelEnrollmentMutation = useMutation<
    void,
    Error,
    { convocatoriaId: string },
    { prev: unknown }
  >({
    mutationFn: async ({ convocatoriaId }) => {
      if (legajo === "99999") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
      }
      logger.info("[Enrollment] Attempting hard delete of convocatoria:", {
        convocatoriaId,
        studentId,
        legajo,
      });
      await db.convocatorias.delete(convocatoriaId);
    },
    // Optimistic UI: quitamos la inscripción del cache al instante para que la
    // tarjeta desaparezca sin esperar al server. Si falla, hacemos rollback.
    onMutate: async ({ convocatoriaId }) => {
      const key = ["convocatorias", legajo, studentId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: ConvocatoriasQueryData | undefined) => {
        if (!old?.myEnrollments) return old;
        return {
          ...old,
          myEnrollments: old.myEnrollments.filter(
            (c: ConvocatoriaFields) => c.id !== convocatoriaId
          ),
        };
      });
      return { prev };
    },
    onError: (err, variables, context) => {
      // Rollback al estado previo si la baja falló.
      if (context?.prev !== undefined) {
        queryClient.setQueryData(["convocatorias", legajo, studentId], context.prev);
      }
      logger.error("[Enrollment] Error deleting convocatoria", {
        convocatoriaId: variables.convocatoriaId,
        studentId,
        legajo,
        message: err.message,
      });
      showModal("No se pudo eliminar la inscripción", err.message);
    },
    onSuccess: () => {
      logger.info("[Enrollment] Convocatoria deleted successfully");
      showModal("Inscripción eliminada", "La inscripción se eliminó correctamente.");
    },
    // Reconciliamos con el server tanto en éxito como en error.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["convocatorias", legajo, studentId] });
    },
  });

  const confirmInformeMutation = useMutation({
    mutationFn: async (task: InformeTask) => {
      if (legajo === "99999") return;
      if (task.practicaId && task.convocatoriaId.startsWith("practica-")) {
        return db.practicas.update(task.practicaId, {
          [FIELD_NOTA_PRACTICAS]: "Entregado (sin corregir)",
        });
      } else if (task.convocatoriaId) {
        return db.convocatorias.update(task.convocatoriaId, {
          [FIELD_INFORME_SUBIDO_CONVOCATORIAS]: true,
          [FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS]: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocatorias", legajo, studentId] });
      queryClient.invalidateQueries({ queryKey: ["practicas", legajo] });
    },
  });

  const enrollStudent = {
    mutate: (lanzamiento: LanzamientoPPS, completedOrientaciones?: string[]) => {
      openEnrollmentForm(
        lanzamiento,
        studentDetails,
        async (fd) => {
          await enrollmentMutation.mutateAsync({ formData: fd, selectedLanzamiento: lanzamiento });
        },
        completedOrientaciones
      );
    },
    isPending: enrollmentMutation.isPending,
  };

  return {
    lanzamientos,
    myEnrollments,
    allLanzamientos,
    isConvocatoriasLoading,
    convocatoriasError,
    enrollStudent,
    cancelEnrollment: {
      mutate: (convocatoriaId: string) => {
        cancelEnrollmentMutation.mutate({ convocatoriaId });
      },
      isPending: cancelEnrollmentMutation.isPending,
    },
    confirmInforme: confirmInformeMutation,
    refetchConvocatorias,
    institutionAddressMap,
    institutionLogoMap,
  };
};
