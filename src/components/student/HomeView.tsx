import React, { useState } from "react";
import type {
  CompromisoPPS,
  Convocatoria,
  LanzamientoPPS,
  EstudianteFields,
  InformeTask,
  TabId,
  CriteriosCalculados,
  FinalizacionPPS,
} from "../../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_REQ_CV_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
} from "../../constants";
import { getHorarioEfectivo } from "../../utils/scheduleUtils";
import { normalizeStringForComparison, formatDate } from "../../utils/formatters";
import ConvocatoriaCardPremium from "../ConvocatoriaCardPremium";
import EmptyState from "../EmptyState";
import ConfirmModal from "../ConfirmModal";
import CompromisoPPSModal from "./CompromisoPPSModal";
import { useModal } from "../../contexts/ModalContext";
import { fetchSeleccionados } from "../../services/dataService";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { mockDb } from "../../services/mockDb";

interface HomeViewProps {
  myEnrollments: Convocatoria[];
  allLanzamientos: LanzamientoPPS[];
  lanzamientos: LanzamientoPPS[];
  student: EstudianteFields | null;
  onInscribir: (lanzamiento: LanzamientoPPS) => void;
  onCancelarInscripcion: (convocatoriaId: string) => void;
  isCancelandoInscripcion?: boolean;
  institutionAddressMap: Map<string, string>;
  institutionLogoMap?: Map<string, { url: string; invert: boolean }>;
  enrollmentMap: Map<string, Convocatoria>;
  compromisoMap?: Map<string, CompromisoPPS>;
  completedLanzamientoIds: Set<string>;
  completedOrientationsByInstitution: Map<string, Set<string>>;
  informeTasks: InformeTask[];
  onNavigate: (tabId: TabId) => void;
  criterios: CriteriosCalculados;
  onOpenFinalization: () => void;
  finalizacionRequest?: FinalizacionPPS | null;
  onAcceptCompromiso?: (payload: {
    convocatoriaId: string;
    lanzamientoId: string;
    fullName: string;
    dni: number | null;
    legajo: string;
    signature: string;
  }) => Promise<void>;
  isSubmittingCompromiso?: boolean;
}

const HomeView: React.FC<HomeViewProps> = ({
  lanzamientos,
  institutionAddressMap,
  institutionLogoMap,
  enrollmentMap,
  compromisoMap,
  completedLanzamientoIds,
  completedOrientationsByInstitution,
  onInscribir,
  onCancelarInscripcion,
  isCancelandoInscripcion,
  student,
  onAcceptCompromiso,
  isSubmittingCompromiso,
}) => {
  const { openSeleccionadosModal, showModal } = useModal();
  const { authenticatedUser } = useAuth();
  const isTesting = authenticatedUser?.legajo === "99999";
  const [pendingCancel, setPendingCancel] = useState<{ id: string; nombre: string } | null>(null);
  const [pendingCompromiso, setPendingCompromiso] = useState<{
    lanzamiento: LanzamientoPPS;
    enrollment: Convocatoria;
  } | null>(null);

  const handleCancelarInscripcion = (convocatoriaId: string, nombrePPS: string) => {
    setPendingCancel({ id: convocatoriaId, nombre: nombrePPS });
  };

  const confirmCancelarInscripcion = () => {
    if (pendingCancel) {
      onCancelarInscripcion(pendingCancel.id);
      setPendingCancel(null);
    }
  };

  const seleccionadosMutation = useMutation({
    mutationFn: async (lanzamiento: LanzamientoPPS) => {
      if (isTesting) {
        // DYNAMIC MOCK: Fetch real mock enrollments for this launch
        const enrollments = await mockDb.getAll("convocatorias", {
          [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzamiento.id,
        });
        const selected = enrollments.filter(
          (e: any) =>
            normalizeStringForComparison(e[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) ===
            "seleccionado"
        );

        if (selected.length === 0) return null;

        const studentIds = selected.map((e: any) => e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
        const students = await mockDb.getAll("estudiantes", { id: studentIds });
        const studentMap = new Map(students.map((s: any) => [s.id, s]));

        const grouped: Record<string, { nombre: any; legajo: any }[]> = {};
        selected.forEach((e: any) => {
          const horario = e[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || "No especificado";
          const s = studentMap.get(e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
          if (s) {
            if (!grouped[horario]) grouped[horario] = [];
            grouped[horario].push({
              nombre: s[FIELD_NOMBRE_ESTUDIANTES],
              legajo: s[FIELD_LEGAJO_ESTUDIANTES],
            });
          }
        });
        return grouped;
      }
      return fetchSeleccionados(lanzamiento);
    },
    onSuccess: (data, lanzamiento) => {
      const title = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Convocatoria";
      openSeleccionadosModal(data, title);
    },
    onError: (error) => showModal("Error", error.message),
  });

  // Obtener fecha actual (sin hora para comparación precisa)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filtrar lanzamientos que ya comenzaron (fecha_inicio <= hoy)
  const startedLanzamientoIds = new Set(
    lanzamientos
      .filter((l) => {
        const fechaInicio = l[FIELD_FECHA_INICIO_LANZAMIENTOS];
        if (!fechaInicio) return false;
        const startDate = new Date(fechaInicio);
        startDate.setHours(0, 0, 0, 0);
        return startDate <= today;
      })
      .map((l) => l.id)
  );

  // Las convocatorias que ya comenzaron se mueven a cerradas/finalizadas automáticamente
  const openLanzamientos = lanzamientos.filter((l) => {
    const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
    const isStarted = startedLanzamientoIds.has(l.id);
    // Solo mostrar en abiertas si NO ha comenzado y el estado es abierto
    return !isStarted && (status === "abierta" || status === "abierto");
  });

  const closedLanzamientos = lanzamientos.filter((l) => {
    const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
    const isStarted = startedLanzamientoIds.has(l.id);
    // Mostrar en cerradas si ya comenzó O si el estado es cerrado
    return isStarted || status === "cerrada" || status === "cerrado";
  });

  const renderCard = (lanzamientoWithSuffix: LanzamientoPPS & { key_suffix?: string }) => {
    const { key_suffix, ...lanzamiento } = lanzamientoWithSuffix;
    const enrollment = enrollmentMap.get(lanzamiento.id);
    const enrollmentStatus = enrollment ? enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] : null;
    const compromiso = enrollment ? compromisoMap?.get(enrollment.id) : null;
    const ppsName = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "";
    const groupName = ppsName.split(" - ")[0].trim();
    const finalDireccion =
      lanzamiento[FIELD_DIRECCION_LANZAMIENTOS] ||
      institutionAddressMap.get(normalizeStringForComparison(ppsName)) ||
      institutionAddressMap.get(normalizeStringForComparison(groupName));

    const logoData =
      institutionLogoMap &&
      (institutionLogoMap.get(normalizeStringForComparison(ppsName)) ||
        institutionLogoMap.get(normalizeStringForComparison(groupName)));

    // Check if this PPS was already completed by the student (orientation-aware)
    const normalizedPpsName = normalizeStringForComparison(ppsName);
    const normalizedGroupName = normalizeStringForComparison(groupName);
    const launchOrientaciones = Array.isArray(lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS])
      ? (lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] as string[])
      : lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS]
        ? [lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] as string]
        : [];

    const completedOrientations =
      completedOrientationsByInstitution.get(normalizedGroupName) ||
      completedOrientationsByInstitution.get(normalizedPpsName) ||
      new Set<string>();

    const allOrientationsCompleted =
      launchOrientaciones.length > 0 &&
      launchOrientaciones.every((o) => completedOrientations.has(normalizeStringForComparison(o)));

    // Single-orientation launch: block by ID or name as before
    const isFullyCompleted =
      completedLanzamientoIds.has(lanzamiento.id) || completedLanzamientoIds.has(normalizedPpsName);

    // Multi-orientation: block only if ALL orientations are completed
    // Single-orientation or no orientation: block if completed by ID/name
    const isCompleted =
      launchOrientaciones.length > 1 ? allOrientationsCompleted : isFullyCompleted;

    const completedOrientationsList = allOrientationsCompleted
      ? launchOrientaciones
      : launchOrientaciones.filter((o) =>
          completedOrientations.has(normalizeStringForComparison(o))
        );

    return (
      <ConvocatoriaCardPremium
        key={`${lanzamiento.id}-${key_suffix || "default"}`}
        id={lanzamiento.id}
        logoUrl={logoData?.url}
        invertLogo={logoData?.invert}
        nombre={lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Convocatoria"}
        orientacion={lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] || "General"}
        direccion={finalDireccion || "Dirección no disponible"}
        descripcion={lanzamiento.descripcion_larga || "Descripción de la propuesta no disponible."}
        actividades={
          Array.isArray(lanzamiento.actividades_lista)
            ? lanzamiento.actividades_lista
            : lanzamiento.actividades_lista
              ? [String(lanzamiento.actividades_lista)]
              : []
        }
        horasAcreditadas={String(lanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] || 0)}
        horariosCursada={
          enrollment
            ? getHorarioEfectivo(enrollment) ||
              lanzamiento[FIELD_HORARIO_FORMULA_CONVOCATORIAS] ||
              "A definir"
            : lanzamiento[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || "A definir"
        }
        cupo={String(lanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0)}
        requisitoObligatorio={lanzamiento.requisito_obligatorio || ""}
        archivoDescargableNombre={lanzamiento.archivo_descargable_nombre || ""}
        archivoDescargableUrl={lanzamiento.archivo_descargable_url || ""}
        reqCv={lanzamiento[FIELD_REQ_CV_LANZAMIENTOS] || false}
        timeline={{
          inscripcion:
            (lanzamiento as any)[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] &&
            (lanzamiento as any)[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]
              ? `${formatDate((lanzamiento as any)[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] as string)} - ${formatDate((lanzamiento as any)[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string)}`
              : "Abierta",
          inicio: formatDate(lanzamiento.fecha_inicio),
          fin: formatDate(lanzamiento.fecha_finalizacion),
        }}
        status={lanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]}
        estadoInscripcion={enrollmentStatus as any}
        compromisoEstado={compromiso?.estado || null}
        enrollment={enrollment}
        isCompleted={isCompleted}
        completedOrientaciones={completedOrientationsList}
        onInscribirse={() => onInscribir(lanzamiento)}
        onCancelarInscripcion={() =>
          enrollment &&
          handleCancelarInscripcion(
            enrollment.id,
            lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "esta PPS"
          )
        }
        isCancelandoInscripcion={isCancelandoInscripcion}
        onVerConvocados={() => seleccionadosMutation.mutate(lanzamiento)}
        onConfirmCompromiso={() => {
          if (enrollment) {
            setPendingCompromiso({ lanzamiento, enrollment });
          }
        }}
        horariosFijos={!!lanzamiento[FIELD_HORARIOS_FIJOS_LANZAMIENTOS]}
        fechaEncuentroInicial={lanzamiento.fecha_encuentro_inicial}
      />
    );
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Active Convocatorias */}
      {openLanzamientos.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Convocatorias Abiertas
          </h3>
          <div className="grid grid-cols-1 gap-6">
            {openLanzamientos.map((l, idx) => renderCard({ ...l, key_suffix: `active-${idx}` }))}
          </div>
        </div>
      ) : null}

      {/* Closed Convocatorias */}
      {closedLanzamientos.length > 0 ? (
        <div className="pt-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Convocatorias
            Finalizadas
          </h3>
          <div className="grid grid-cols-1 gap-6 opacity-85 hover:opacity-100 transition-opacity">
            {closedLanzamientos.map((l, idx) => renderCard({ ...l, key_suffix: `closed-${idx}` }))}
          </div>
        </div>
      ) : null}

      {openLanzamientos.length === 0 && closedLanzamientos.length === 0 && (
        <EmptyState
          type="no-convocatorias"
          title="No hay convocatorias abiertas"
          message="Por el momento, no hay procesos de inscripción disponibles. ¡Vuelve a consultar pronto!"
          size="lg"
        />
      )}
      <ConfirmModal
        isOpen={!!pendingCancel}
        title="Cancelar Inscripción"
        message={`¿Estás seguro de que deseas cancelar tu inscripción a "${pendingCancel?.nombre}"?\n\nEsta acción no se puede deshacer.`}
        confirmText="Sí, cancelar inscripción"
        cancelText="Volver"
        type="danger"
        onConfirm={confirmCancelarInscripcion}
        onClose={() => setPendingCancel(null)}
      />
      <CompromisoPPSModal
        isOpen={!!pendingCompromiso}
        onClose={() => setPendingCompromiso(null)}
        student={student}
        lanzamiento={pendingCompromiso?.lanzamiento || null}
        enrollment={pendingCompromiso?.enrollment || null}
        onSubmit={async (payload) => {
          await onAcceptCompromiso?.(payload);
        }}
        isSubmitting={isSubmittingCompromiso}
      />
    </div>
  );
};

export default HomeView;
