import React from "react";
import { useMutation } from "@tanstack/react-query";
import type { Convocatoria, LanzamientoPPS, EstudianteFields } from "../types";
import ConvocatoriaCardPremium from "./ConvocatoriaCardPremium";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_GENERO_ESTUDIANTES,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS,
} from "../constants";
import EmptyState from "./EmptyState";
import { useModal } from "../contexts/ModalContext";
import { normalizeStringForComparison, formatDate } from "../utils/formatters";
import { fetchSeleccionados } from "../services/dataService";
import { useAuth } from "../contexts/AuthContext";

interface ConvocatoriasListProps {
  lanzamientos: LanzamientoPPS[];
  student: EstudianteFields | null;
  onInscribir: (lanzamiento: LanzamientoPPS) => void;
  institutionAddressMap: Map<string, string>;
  institutionLogoMap?: Map<string, { url: string; invert: boolean }>;
  enrollmentMap: Map<string, Convocatoria>;
  completedLanzamientoIds: Set<string>;
}

const ConvocatoriasList: React.FC<ConvocatoriasListProps> = ({
  lanzamientos,
  student,
  onInscribir,
  institutionAddressMap,
  institutionLogoMap,
  enrollmentMap,
  completedLanzamientoIds,
}) => {
  const { openSeleccionadosModal, showModal } = useModal();
  const { authenticatedUser } = useAuth();
  const isTesting = authenticatedUser?.legajo === "99999";

  const seleccionadosMutation = useMutation({
    mutationFn: (lanzamiento: LanzamientoPPS) => {
      if (isTesting && lanzamiento.id === "lanz_mock_2") {
        return Promise.resolve({
          "Turno Mañana": [
            { nombre: "Ana Rodriguez (Ejemplo)", legajo: "99901" },
            { nombre: "Carlos Gomez (Ejemplo)", legajo: "99902" },
          ],
          "Turno Tarde": [{ nombre: "Lucia Fernandez (Ejemplo)", legajo: "99903" }],
        });
      }
      return fetchSeleccionados(lanzamiento);
    },
    onSuccess: (data, lanzamiento) => {
      const title = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Convocatoria";
      openSeleccionadosModal(data, title);
    },
    onError: (error) => {
      showModal("Error", error.message);
    },
  });

  if (lanzamientos.length === 0) {
    return (
      <EmptyState
        icon="upcoming"
        title="No hay convocatorias abiertas"
        message="Por el momento, no hay procesos de inscripción disponibles. ¡Vuelve a consultar pronto!"
      />
    );
  }

  return (
    <div className="grid gap-6 animate-fade-in">
      {lanzamientos.map((lanzamiento) => {
        const enrollment = enrollmentMap.get(lanzamiento.id);
        const enrollmentStatus = enrollment
          ? enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]
          : null;

        // Check ID match OR Full Name match
        const ppsName = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "";
        const isCompleted =
          completedLanzamientoIds.has(lanzamiento.id) ||
          completedLanzamientoIds.has(normalizeStringForComparison(ppsName));

        const lanzamientoDireccion = lanzamiento[FIELD_DIRECCION_LANZAMIENTOS];
        const institutionName = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS];
        const fallbackDireccion = institutionName
          ? institutionAddressMap.get(normalizeStringForComparison(institutionName))
          : undefined;
        const finalDireccion = lanzamientoDireccion || fallbackDireccion;

        const logoData =
          institutionName && institutionLogoMap
            ? institutionLogoMap.get(normalizeStringForComparison(institutionName))
            : undefined;

        return (
          <ConvocatoriaCardPremium
            key={lanzamiento.id}
            id={lanzamiento.id}
            logoUrl={logoData?.url}
            invertLogo={logoData?.invert}
            nombre={lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Convocatoria"}
            orientacion={lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] || "General"}
            direccion={finalDireccion || "Dirección no disponible"}
            descripcion={
              lanzamiento.descripcion_larga || "Descripción de la propuesta no disponible."
            }
            actividades={
              Array.isArray(lanzamiento.actividades_lista)
                ? lanzamiento.actividades_lista
                : lanzamiento.actividades_lista
                  ? [String(lanzamiento.actividades_lista)]
                  : []
            }
            horasAcreditadas={String(lanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] || 0)}
            horariosCursada={lanzamiento[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] || "A definir"}
            cupo={String(lanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0)}
            requisitoObligatorio={lanzamiento.requisito_obligatorio || ""}
            reqCv={lanzamiento.req_cv || false}
            timeline={{
              inscripcion:
                lanzamiento[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] &&
                lanzamiento[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]
                  ? `${formatDate(lanzamiento[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] as string)} - ${formatDate(lanzamiento[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string)}`
                  : "Abierta",
              inicio: formatDate(lanzamiento.fecha_inicio),
              fin: formatDate(lanzamiento.fecha_finalizacion),
            }}
            status={lanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]}
            estadoInscripcion={enrollmentStatus as any}
            isCompleted={isCompleted}
            horariosFijos={lanzamiento.horarios_fijos || false}
            fechaEncuentroInicial={lanzamiento.fecha_encuentro_inicial}
            onInscribirse={() => onInscribir(lanzamiento)}
          />
        );
      })}
    </div>
  );
};

export default React.memo(ConvocatoriasList);
