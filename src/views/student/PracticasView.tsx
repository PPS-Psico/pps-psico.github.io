import React, { useMemo, useState } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import PracticasTable from "../../components/student/PracticasTable";
import SolicitudModificacionModal from "../../components/student/SolicitudModificacionModal";
import SolicitudNuevaPPSModal from "../../components/student/SolicitudNuevaPPSModal";
import { useStudentPanel } from "../../contexts/StudentPanelContext";
import type { Practica } from "../../types";
import { logger } from "../../utils/logger";

const PracticasView: React.FC = () => {
  const {
    practicas,
    updateFechaFin,
    refetchPracticas,
    studentDetails,
    solicitudesModificacion,
    refetchSolicitudesModificacion,
  } = useStudentPanel();
  const [showModificacionModal, setShowModificacionModal] = useState(false);
  const [showNuevaPPSModal, setShowNuevaPPSModal] = useState(false);
  const [selectedPractica, setSelectedPractica] = useState<Practica | null>(null);

  const handleRequestModificacion = (practica: Practica) => {
    logger.info("[DEBUG] Solicitar modificación para:", practica);
    setSelectedPractica(practica);
    setShowModificacionModal(true);
  };

  const handleRequestNuevaPPS = () => {
    logger.info("[DEBUG] Abrir modal nueva PPS");
    logger.info("[DEBUG] Estado antes:", { modalVisible: showNuevaPPSModal });
    setShowNuevaPPSModal(true);
    logger.info("[DEBUG] Seteando modal a true");
  };

  logger.info("[DEBUG] PracticasView render - handlers definidos:", {
    onRequestModificacion: !!handleRequestModificacion,
    onRequestNuevaPPS: !!handleRequestNuevaPPS,
    practicasCount: practicas.length,
  });

  const handleSuccess = () => {
    refetchPracticas();
    refetchSolicitudesModificacion();
  };

  const pendingWithdrawalByPractice = useMemo(
    () =>
      new Map(
        solicitudesModificacion
          .filter(
            (request) =>
              request.tipo_modificacion === "eliminacion" &&
              request.estado === "pendiente" &&
              request.practica_id
          )
          .map((request) => [request.practica_id as string, request])
      ),
    [solicitudesModificacion]
  );

  return (
    <>
      <PageWrapper
        icon="work_history"
        title={
          <span>
            Historial de{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Practicas
            </span>
          </span>
        }
        description="Detalle de todas las practicas realizadas y sus calificaciones."
      >
        <PracticasTable
          practicas={practicas}
          onRequestModificacion={handleRequestModificacion}
          onRequestNuevaPPS={handleRequestNuevaPPS}
          pendingWithdrawalByPractice={pendingWithdrawalByPractice}
        />
      </PageWrapper>

      <SolicitudModificacionModal
        isOpen={showModificacionModal}
        onClose={() => {
          setShowModificacionModal(false);
          setSelectedPractica(null);
        }}
        practica={selectedPractica}
        studentId={studentDetails?.id || null}
        onFechaFinChange={(practicaId, fecha) =>
          updateFechaFin.mutateAsync({ practicaId, fecha }).then(() => undefined)
        }
        onSuccess={handleSuccess}
      />

      <SolicitudNuevaPPSModal
        isOpen={showNuevaPPSModal}
        onClose={() => setShowNuevaPPSModal(false)}
        studentId={studentDetails?.id || null}
        onSuccess={handleSuccess}
      />
    </>
  );
};

export default PracticasView;
