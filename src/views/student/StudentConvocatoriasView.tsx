import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useStudentPanel } from "../../contexts/StudentPanelContext";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import EmptyState from "../../components/EmptyState";
import ConfirmModal from "../../components/ConfirmModal";
import StudentConvCard from "../../components/student/home/StudentConvCard";
import { fetchSeleccionados } from "../../services";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
} from "../../constants";
import { normalizeStringForComparison } from "../../utils/formatters";
import type { LanzamientoPPS } from "../../types";

const StudentConvocatoriasView: React.FC = () => {
  const { lanzamientos, allLanzamientos, enrollmentMap, cancelEnrollment } = useStudentPanel();
  const { authenticatedUser } = useAuth();
  const { openSeleccionadosModal, showModal } = useModal();
  const navigate = useNavigate();
  const openDetalle = (l: LanzamientoPPS) => navigate(`/student/convocatoria/${l.id}`);
  const isTesting = authenticatedUser?.legajo === "99999";

  const [pendingCancel, setPendingCancel] = useState<{ id: string; nombre: string } | null>(null);

  // ── Ver convocados (seleccionados) de una convocatoria cerrada ──
  const seleccionadosMutation = useMutation({
    mutationFn: async (lanzamiento: LanzamientoPPS) => {
      if (isTesting) return null;
      return fetchSeleccionados(lanzamiento);
    },
    onSuccess: (data, lanzamiento) => {
      const title = (lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Convocatoria";
      openSeleccionadosModal(data, title);
    },
    onError: (error: any) => showModal("Error", error.message),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startedLanzamientoIds = useMemo(
    () =>
      new Set(
        (allLanzamientos ?? [])
          .filter((l) => {
            const fechaInicio = l[FIELD_FECHA_INICIO_LANZAMIENTOS];
            if (!fechaInicio) return false;
            const startDate = new Date(fechaInicio);
            startDate.setHours(0, 0, 0, 0);
            return startDate <= today;
          })
          .map((l) => l.id)
      ),
    [allLanzamientos, today]
  );

  const { openLanzamientos, closedLanzamientos } = useMemo(() => {
    const open: LanzamientoPPS[] = [];
    const closed: LanzamientoPPS[] = [];
    const seen = new Set<string>();

    const classify = (l: LanzamientoPPS) => {
      if (seen.has(l.id)) return;
      seen.add(l.id);
      const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] || "");
      const isStarted = startedLanzamientoIds.has(l.id);
      if (!isStarted && (status === "abierta" || status === "abierto")) {
        open.push(l);
      } else {
        // Todo lo demás (cerrada, archivada, confirmacion/activa del pipeline o ya
        // iniciada) se muestra como "cerrada" → habilita "Ver convocados".
        closed.push(l);
      }
    };

    (lanzamientos ?? []).forEach(classify);

    // Garantía: cualquier PPS en la que el estudiante esté inscripto/seleccionado
    // debe aparecer SIEMPRE, aunque su lanzamiento ya no esté en la lista pública
    // (p. ej. pasó a estado "Confirmacion"/"Activa" o fue archivado). Estas viven
    // en allLanzamientos vía las inscripciones.
    (allLanzamientos ?? []).forEach((l) => {
      if (enrollmentMap.has(l.id)) classify(l);
    });

    return { openLanzamientos: open, closedLanzamientos: closed };
  }, [lanzamientos, allLanzamientos, enrollmentMap, startedLanzamientoIds]);

  const handleCancelar = (id: string, nombre: string) => setPendingCancel({ id, nombre });
  const confirmCancelar = () => {
    if (pendingCancel) {
      cancelEnrollment.mutate(pendingCancel.id);
      setPendingCancel(null);
    }
  };

  const renderConv = (l: LanzamientoPPS, keySuffix: string) => {
    const enrollment = enrollmentMap.get(l.id);
    const isOpen = keySuffix.startsWith("open");
    return (
      <StudentConvCard
        key={`${l.id}-${keySuffix}`}
        lanzamiento={l}
        enrollment={enrollment ?? null}
        isOpen={isOpen}
        onOpen={() => openDetalle(l)}
        onInscribirse={() => openDetalle(l)}
        onVerConvocados={() => seleccionadosMutation.mutate(l)}
        onCancelarInscripcion={() =>
          enrollment &&
          handleCancelar(enrollment.id, (l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "esta PPS")
        }
      />
    );
  };

  return (
    <div className="space-y-7 pb-4 animate-fade-in">
      {/* Header editorial */}
      <header>
        <span className="font-mono text-[11px] uppercase tracking-[.12em] text-student-ink-muted">
          Procesos de inscripción
        </span>
        <h1 className="font-bricolage text-[30px] md:text-[40px] font-bold leading-[0.96] tracking-[-0.04em] mt-1 text-student-ink">
          Convocatorias.
        </h1>
        <p className="mt-2 text-[14px] text-student-ink-soft max-w-prose">
          Mirá las prácticas disponibles. Tap en una convocatoria para ver el detalle, los días y
          los horarios.
        </p>
      </header>

      {/* Abiertas */}
      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-uflo-teal" />
            <h2 className="font-mono text-[11px] uppercase tracking-[.12em] text-student-ink-muted">
              Abiertas
            </h2>
          </div>
          <span className="font-mono text-[11px] text-student-ink-subtle">
            {openLanzamientos.length}{" "}
            {openLanzamientos.length === 1 ? "oportunidad" : "oportunidades"}
          </span>
        </div>

        {openLanzamientos.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {openLanzamientos.map((l, idx) => renderConv(l, `open-${idx}`))}
          </div>
        ) : (
          <EmptyState
            type="no-convocatorias"
            title="No hay convocatorias abiertas"
            message="Por el momento, no hay procesos de inscripción disponibles. ¡Vuelve a consultar pronto!"
            size="lg"
          />
        )}
      </section>

      {/* Cerradas / Archivadas */}
      {closedLanzamientos.length > 0 ? (
        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-student-ink-subtle" />
              <h2 className="font-mono text-[11px] uppercase tracking-[.12em] text-student-ink-muted">
                Cerradas · Archivadas
              </h2>
            </div>
            <span className="font-mono text-[11px] text-student-ink-subtle">
              {closedLanzamientos.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 opacity-90 hover:opacity-100 transition-opacity md:grid-cols-2 xl:grid-cols-3">
            {closedLanzamientos.map((l, idx) => renderConv(l, `closed-${idx}`))}
          </div>
        </section>
      ) : null}

      <ConfirmModal
        isOpen={!!pendingCancel}
        title="Cancelar Inscripción"
        message={`¿Estás seguro que deseas cancelar tu inscripción a "${pendingCancel?.nombre}"?\n\nEsta acción no se puede deshacer.`}
        confirmText="Sí, cancelar inscripción"
        cancelText="Volver"
        type="danger"
        onConfirm={confirmCancelar}
        onClose={() => setPendingCancel(null)}
      />
    </div>
  );
};

export default StudentConvocatoriasView;
