import React from "react";
import type {
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
} from "../../constants";
import { normalizeStringForComparison, formatDate } from "../../utils/formatters";
import ConvocatoriaCardPremium from "../ConvocatoriaCardPremium";
import EmptyState from "../EmptyState";
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
  institutionAddressMap: Map<string, string>;
  institutionLogoMap?: Map<string, { url: string; invert: boolean }>;
  enrollmentMap: Map<string, Convocatoria>;
  completedLanzamientoIds: Set<string>;
  informeTasks: InformeTask[];
  onNavigate: (tabId: TabId) => void;
  criterios: CriteriosCalculados;
  onOpenFinalization: () => void;
  finalizacionRequest?: FinalizacionPPS | null;
}

const HomeView: React.FC<HomeViewProps> = ({
  lanzamientos,
  institutionAddressMap,
  institutionLogoMap,
  enrollmentMap,
  completedLanzamientoIds,
  onInscribir,
}) => {
  const { openSeleccionadosModal, showModal } = useModal();
  const { authenticatedUser } = useAuth();
  const isTesting = authenticatedUser?.legajo === "99999";

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

  const openLanzamientos = lanzamientos.filter((l) => {
    const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
    return status === "abierta" || status === "abierto";
  });

  const closedLanzamientos = lanzamientos.filter((l) => {
    const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
    return status === "cerrada" || status === "cerrado";
  });

  const renderCard = (lanzamientoWithSuffix: LanzamientoPPS & { key_suffix?: string }) => {
    const { key_suffix, ...lanzamiento } = lanzamientoWithSuffix;
    const enrollment = enrollmentMap.get(lanzamiento.id);
    const enrollmentStatus = enrollment ? enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] : null;
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

    // Check if this PPS was already completed by the student
    const normalizedPpsName = normalizeStringForComparison(ppsName);
    const isCompleted =
      completedLanzamientoIds.has(lanzamiento.id) || completedLanzamientoIds.has(normalizedPpsName);

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
        horariosCursada={lanzamiento[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || "A definir"}
        cupo={String(lanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0)}
        requisitoObligatorio={lanzamiento.requisito_obligatorio || ""}
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
        isCompleted={isCompleted}
        onInscribirse={() => onInscribir(lanzamiento)}
        onVerConvocados={() => seleccionadosMutation.mutate(lanzamiento)}
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
    </div>
  );
};

export default HomeView;
