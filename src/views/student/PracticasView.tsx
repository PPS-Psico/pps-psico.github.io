import React, { useState } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import PracticasTable from "../../components/student/PracticasTable";
import SolicitudModificacionModal from "../../components/student/SolicitudModificacionModal";
import SolicitudNuevaPPSModal from "../../components/student/SolicitudNuevaPPSModal";
import { useStudentPanel } from "../../contexts/StudentPanelContext";
import { useAuth } from "../../contexts/AuthContext";
import type { Practica } from "../../types";

const PracticasView: React.FC = () => {
  const { practicas, updateNota, updateFechaFin, refetchPracticas, studentDetails } =
    useStudentPanel();
  const { authenticatedUser: user } = useAuth();

  const [showModificacionModal, setShowModificacionModal] = useState(false);
  const [showNuevaPPSModal, setShowNuevaPPSModal] = useState(false);
  const [selectedPractica, setSelectedPractica] = useState<Practica | null>(null);

  const handleRequestModificacion = (practica: Practica) => {
    setSelectedPractica(practica);
    setShowModificacionModal(true);
  };

  const handleRequestNuevaPPS = () => {
    setShowNuevaPPSModal(true);
  };

  const handleSuccess = () => {
    refetchPracticas();
  };

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
          handleNotaChange={(pid, n, cid) =>
            updateNota.mutate({ practicaId: pid, nota: n, convocatoriaId: cid })
          }
          handleFechaFinChange={(pid, fecha) => {
            alert("DEBUG: Fix Directo - Intentando guardar");
            updateFechaFin.mutate({ practicaId: pid, fecha });
          }}
          onRequestModificacion={handleRequestModificacion}
          onRequestNuevaPPS={handleRequestNuevaPPS}
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
