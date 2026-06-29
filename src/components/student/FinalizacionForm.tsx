import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitFinalizationRequest, uploadFinalizationFile } from "../../services";
import { useNotifications } from "../../contexts/NotificationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { logger } from "../../utils/logger";
import { Icon } from "./ds";
import {
  FIELD_ES_ONLINE_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOTA_PRACTICAS,
} from "../../constants";
import { normalizeStringForComparison } from "../../utils/formatters";
import {
  computeNotaPromedio,
  computeTotalHoras,
  NOTA_NUMERICA_OPTIONS,
  NOTA_TEXTO_OPTIONS,
  type DetallePracticaItem,
  type DetallePracticas,
} from "../../utils/acreditacion";
import type { CriteriosCalculados, Practica } from "../../types";

interface FinalizacionFormProps {
  isOpen: boolean;
  studentId: string | null;
  onClose?: () => void;
  practicas?: Practica[];
  criterios?: CriteriosCalculados;
  onAddPPS?: () => void;
  onDeletePractica?: (practicaId: string) => Promise<void> | void;
  isDeletingPractica?: boolean;
}

type Step = "requisitos" | "completar" | "documentacion" | "confirmar" | "enviado";

interface RowState {
  nota: string;
  fechaFin: string; // YYYY-MM-DD
  informe: File | null;
  asistencia: File | null;
}

const toDateInput = (value: string | null | undefined): string =>
  value ? String(value).slice(0, 10) : "";

const DANGER = "#c0563f";

// --- Subcomponentes UI (.ed) ---

const StepDots: React.FC<{ index: number; total: number }> = ({ index, total }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: total }).map((_, i) => (
      <span
        key={i}
        className="h-1.5 rounded-full transition-all duration-300"
        style={{
          width: i === index ? 22 : 7,
          background: i <= index ? "var(--accent)" : "var(--line-strong)",
        }}
      />
    ))}
  </div>
);

const CriterioCard: React.FC<{
  label: string;
  value: string;
  ok: boolean;
  hint?: string;
}> = ({ label, value, ok, hint }) => (
  <div
    className="p-4 rounded-2xl border flex flex-col gap-1"
    style={{
      borderColor: ok ? "var(--accent)" : "var(--line)",
      background: ok ? "var(--tint)" : "var(--bg-elevated)",
    }}
  >
    <div className="flex items-center justify-between">
      <span className="eyebrow" style={{ color: "var(--ink-muted)", fontSize: 10 }}>
        {label}
      </span>
      <Icon
        name={ok ? "check" : "alert"}
        size={16}
        color={ok ? "var(--accent-text)" : "var(--ink-muted)"}
        strokeWidth={2.2}
      />
    </div>
    <span
      className="text-lg font-bold leading-tight"
      style={{ color: ok ? "var(--accent-text)" : "var(--ink)" }}
    >
      {value}
    </span>
    {hint && (
      <span className="text-[11px] font-medium" style={{ color: "var(--ink-muted)" }}>
        {hint}
      </span>
    )}
  </div>
);

const RowFileButton: React.FC<{
  label: string;
  file: File | null;
  onPick: () => void;
  onClear: () => void;
  required: boolean;
}> = ({ label, file, onPick, onClear, required }) => {
  const done = !!file;
  return (
    <div
      onClick={onPick}
      className="group cursor-pointer rounded-xl border-2 border-dashed px-3 py-2.5 flex items-center gap-2.5 transition-all duration-200"
      style={{
        borderColor: done ? "var(--accent)" : "var(--line-strong)",
        background: done ? "var(--tint)" : "var(--bg-sunken)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: "var(--bg-elevated)",
          color: done ? "var(--accent-text)" : "var(--ink-muted)",
        }}
      >
        <Icon name={done ? "check" : "upload"} size={15} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-bold leading-tight truncate"
          style={{ color: done ? "var(--accent-text)" : "var(--ink-soft)" }}
        >
          {label} {required && !done && <span style={{ color: DANGER }}>*</span>}
        </p>
        <p className="text-[10px] truncate" style={{ color: "var(--ink-subtle)" }}>
          {file ? file.name : "PDF, Word o imagen · máx 10MB"}
        </p>
      </div>
      {done && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="p-1 rounded-md flex-shrink-0"
          style={{ color: "var(--ink-muted)" }}
          aria-label="Quitar archivo"
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
};

const FinalizacionForm: React.FC<FinalizacionFormProps> = ({
  isOpen,
  studentId,
  onClose,
  practicas = [],
  criterios,
  onAddPPS,
  onDeletePractica,
  isDeletingPractica = false,
}) => {
  const { showToast } = useNotifications();
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("requisitos");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [sugerencias, setSugerencias] = useState("");
  const [pendingFilePicker, setPendingFilePicker] = useState<{
    practicaId: string;
    kind: "informe" | "asistencia";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prácticas finalizadas: son las que entran al trámite.
  const finalizadas = useMemo(
    () =>
      practicas.filter(
        (p) => normalizeStringForComparison(p[FIELD_ESTADO_PRACTICA]) === "finalizada"
      ),
    [practicas]
  );

  const cumpleTodo = useMemo(() => {
    if (!criterios) return true;
    return (
      criterios.cumpleHorasTotales &&
      criterios.cumpleRotacion &&
      criterios.cumpleHorasOrientacion &&
      !criterios.tienePracticasPendientes
    );
  }, [criterios]);

  // Reset al abrir.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setStep("requisitos");
      setSugerencias("");
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Sincroniza el estado por fila con las prácticas finalizadas (preserva archivos elegidos).
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, RowState> = {};
      for (const p of finalizadas) {
        const existing = prev[p.id];
        next[p.id] = existing ?? {
          nota: p[FIELD_NOTA_PRACTICAS] ?? "",
          fechaFin: toDateInput(p[FIELD_FECHA_FIN_PRACTICAS]),
          informe: null,
          asistencia: null,
        };
      }
      return next;
    });
  }, [finalizadas]);

  const isRowValid = (p: Practica): boolean => {
    const rs = rows[p.id];
    if (!rs) return false;
    const esOnline = !!p[FIELD_ES_ONLINE_PRACTICAS];
    if (!rs.nota) return false;
    if (!rs.informe) return false;
    if (!esOnline && !rs.asistencia) return false;
    return true;
  };

  const allRowsValid = finalizadas.length > 0 && finalizadas.every(isRowValid);

  const setRow = (practicaId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [practicaId]: { ...prev[practicaId], ...patch } }));
  };

  const openFilePicker = (practicaId: string, kind: "informe" | "asistencia") => {
    setPendingFilePicker({ practicaId, kind });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (file: File | null) => {
    if (!file || !pendingFilePicker) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast(`El archivo ${file.name} es demasiado grande (máx 10MB).`, "error");
      return;
    }
    setRow(pendingFilePicker.practicaId, { [pendingFilePicker.kind]: file } as Partial<RowState>);
    setPendingFilePicker(null);
  };

  const handleDelete = async (practicaId: string) => {
    if (!onDeletePractica) return;
    if (!window.confirm("¿Eliminar esta PPS del trámite? Esta acción no se puede deshacer."))
      return;
    await onDeletePractica(practicaId);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("ID de estudiante no disponible.");

      const items: DetallePracticaItem[] = [];
      for (const p of finalizadas) {
        const rs = rows[p.id];
        const esOnline = !!p[FIELD_ES_ONLINE_PRACTICAS];

        const informeUrl = await uploadFinalizationFile(rs.informe!, studentId, "informe", p.id);
        let asistencia: DetallePracticaItem["asistencia"] = null;
        if (!esOnline && rs.asistencia) {
          const asistenciaUrl = await uploadFinalizationFile(
            rs.asistencia,
            studentId,
            "asistencia",
            p.id
          );
          asistencia = { url: asistenciaUrl, filename: rs.asistencia.name };
        }

        items.push({
          practicaId: p.id,
          nombre: p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] || "PPS",
          especialidad: p[FIELD_ESPECIALIDAD_PRACTICAS] ?? null,
          horas: Number(p[FIELD_HORAS_PRACTICAS]) || 0,
          fechaInicio: p[FIELD_FECHA_INICIO_PRACTICAS] ?? null,
          fechaFinalizacion: rs.fechaFin || p[FIELD_FECHA_FIN_PRACTICAS] || null,
          esOnline,
          nota: rs.nota,
          informe: { url: informeUrl, filename: rs.informe!.name },
          asistencia,
        });
      }

      const detalle: DetallePracticas = {
        totalHoras: computeTotalHoras(items.map((i) => i.horas)),
        notaPromedio: computeNotaPromedio(items.map((i) => i.nota)),
        items,
      };

      await submitFinalizationRequest(studentId, { detalle, sugerencias });
    },
    onSuccess: () => {
      setStep("enviado");
      queryClient.invalidateQueries({ queryKey: ["finalizacionRequest"] });
      queryClient.invalidateQueries({ queryKey: ["solicitudes"] });
      queryClient.invalidateQueries({ queryKey: ["practicas"] });
      showToast("Solicitud de acreditación enviada con éxito.", "success");
    },
    onError: (error) => {
      logger.error("Finalizacion submission error:", error);
      showToast(`Error al enviar: ${error?.message || "desconocido"}.`, "error");
    },
  });

  const totalHoras = useMemo(
    () => computeTotalHoras(finalizadas.map((p) => p[FIELD_HORAS_PRACTICAS])),
    [finalizadas]
  );
  const notaPromedio = useMemo(
    () => computeNotaPromedio(finalizadas.map((p) => rows[p.id]?.nota)),
    [finalizadas, rows]
  );

  if (!isOpen) return null;

  const stepIndex =
    step === "requisitos" ? 0 : step === "completar" || step === "documentacion" ? 1 : 2;

  const headerTitle =
    step === "requisitos"
      ? "Trámite de acreditación"
      : step === "completar"
        ? "Completá tus PPS"
        : step === "documentacion"
          ? "Documentación por PPS"
          : step === "confirmar"
            ? "Revisá y enviá"
            : "Solicitud enviada";

  return createPortal(
    <div
      className="ed fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
      data-mode={resolvedTheme}
      data-accent="teal"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
        onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
      />
      <div
        className="relative w-full sm:w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-5 py-4 sm:px-7 sm:py-5 flex items-center justify-between safe-area-top"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="min-w-0 pr-4">
            <span className="eyebrow" style={{ color: "var(--accent-text)" }}>
              Acreditación
            </span>
            <h2
              className="truncate"
              style={{
                fontSize: 26,
                marginTop: 2,
                color: "var(--ink)",
                fontFamily: '"Instrument Serif", ui-serif, Georgia, serif',
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              {headerTitle}
            </h2>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            {step !== "enviado" && <StepDots index={stepIndex} total={3} />}
            <button
              onClick={onClose}
              className="p-2 -mr-1 rounded-full transition-colors hover:bg-[var(--bg-sunken)]"
              style={{ color: "var(--ink-muted)" }}
              aria-label="Cerrar"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 custom-scrollbar">
          {step === "requisitos" && (
            <RequisitosStep criterios={criterios} cumpleTodo={cumpleTodo} />
          )}

          {step === "completar" && (
            <CompletarStep criterios={criterios} finalizadas={finalizadas} onAddPPS={onAddPPS} />
          )}

          {step === "documentacion" && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Cargá por cada PPS el <strong>informe final</strong>, la{" "}
                <strong>planilla de asistencia</strong> y la <strong>nota</strong>. Verificá que la{" "}
                <strong>fecha de finalización</strong> sea correcta. Las PPS online no requieren
                planilla de asistencia.
              </p>

              {finalizadas.length === 0 ? (
                <EmptyPps onAddPPS={onAddPPS} />
              ) : (
                finalizadas.map((p) => (
                  <PpsDocCard
                    key={p.id}
                    practica={p}
                    row={rows[p.id]}
                    valid={isRowValid(p)}
                    onSetRow={(patch) => setRow(p.id, patch)}
                    onPickInforme={() => openFilePicker(p.id, "informe")}
                    onPickAsistencia={() => openFilePicker(p.id, "asistencia")}
                    onDelete={onDeletePractica ? () => handleDelete(p.id) : undefined}
                    isDeleting={isDeletingPractica}
                  />
                ))
              )}

              {onAddPPS && finalizadas.length > 0 && (
                <button
                  type="button"
                  onClick={onAddPPS}
                  className="w-full rounded-2xl border-2 border-dashed py-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors hover:bg-[var(--bg-sunken)]"
                  style={{ borderColor: "var(--line-strong)", color: "var(--accent-text)" }}
                >
                  <Icon name="plus" size={16} strokeWidth={2.2} />
                  ¿Hiciste una PPS que no figura? Agregala
                </button>
              )}
            </div>
          )}

          {step === "confirmar" && (
            <ConfirmarStep
              count={finalizadas.length}
              totalHoras={totalHoras}
              notaPromedio={notaPromedio}
              sugerencias={sugerencias}
              onSugerencias={setSugerencias}
            />
          )}

          {step === "enviado" && <EnviadoStep />}
        </div>

        {/* Footer */}
        {step !== "enviado" && (
          <div
            className="flex-shrink-0 px-5 py-4 sm:px-7 sm:py-4 flex items-center justify-between gap-3 safe-area-bottom"
            style={{ borderTop: "1px solid var(--line)", background: "var(--bg-elevated)" }}
          >
            <FooterButtons
              step={step}
              cumpleTodo={cumpleTodo}
              allRowsValid={allRowsValid}
              isSubmitting={submitMutation.isPending}
              onBack={() => {
                if (step === "completar") setStep("requisitos");
                else if (step === "documentacion") setStep(cumpleTodo ? "requisitos" : "completar");
                else if (step === "confirmar") setStep("documentacion");
              }}
              onNext={() => {
                if (step === "requisitos") setStep(cumpleTodo ? "documentacion" : "completar");
                else if (step === "completar") setStep("documentacion");
                else if (step === "documentacion") setStep("confirmar");
                else if (step === "confirmar") submitMutation.mutate();
              }}
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// --- Pasos ---

const RequisitosStep: React.FC<{
  criterios?: CriteriosCalculados;
  cumpleTodo: boolean;
}> = ({ criterios, cumpleTodo }) => (
  <div className="space-y-5">
    {!cumpleTodo && (
      <div
        className="p-4 rounded-2xl flex items-start gap-3"
        style={{ background: "rgba(192,86,63,0.08)", border: "1px solid rgba(192,86,63,0.30)" }}
      >
        <Icon name="alert" size={18} color={DANGER} />
        <p className="text-xs font-medium leading-relaxed" style={{ color: DANGER }}>
          Detectamos que todavía no cumplís todos los requisitos. Si tenés PPS hechas que no
          figuran, en el próximo paso vas a poder agregarlas para completar los criterios. Si igual
          querés continuar, podés hacerlo.
        </p>
      </div>
    )}

    {criterios ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CriterioCard
          label="Carga horaria"
          value={`${Math.round(criterios.horasTotales)} / 350 hs`}
          ok={criterios.cumpleHorasTotales}
        />
        <CriterioCard
          label="Rotación"
          value={`${criterios.orientacionesCursadasCount} / 2 áreas`}
          ok={criterios.cumpleRotacion}
        />
        <CriterioCard
          label="Especialidad"
          value={`${Math.round(criterios.horasOrientacionElegida)} / 70 hs`}
          ok={criterios.cumpleHorasOrientacion}
        />
        <CriterioCard
          label="Estado prácticas"
          value={criterios.tienePracticasPendientes ? "Pendientes" : "Todas finalizadas"}
          ok={!criterios.tienePracticasPendientes}
          hint={
            criterios.tienePracticasPendientes
              ? "Tenés prácticas activas sin finalizar."
              : undefined
          }
        />
      </div>
    ) : (
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Vas a cargar el informe, la planilla de asistencia y la nota de cada una de tus PPS.
      </p>
    )}

    <div
      className="p-4 rounded-2xl flex items-start gap-3"
      style={{ background: "var(--tint)", border: "1px solid var(--line)" }}
    >
      <Icon name="file" size={18} color="var(--accent-text)" />
      <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        Tené a mano los <strong>informes corregidos</strong> y las{" "}
        <strong>planillas de asistencia</strong> de tus PPS presenciales. Ya no se pide la planilla
        de seguimiento.
      </p>
    </div>
  </div>
);

const CompletarStep: React.FC<{
  criterios?: CriteriosCalculados;
  finalizadas: Practica[];
  onAddPPS?: () => void;
}> = ({ criterios, finalizadas, onAddPPS }) => {
  const faltantes: string[] = [];
  if (criterios) {
    if (!criterios.cumpleHorasTotales)
      faltantes.push(`Faltan ${Math.max(0, Math.round(criterios.horasFaltantes250))} hs totales`);
    if (!criterios.cumpleRotacion) faltantes.push("Falta rotación (2 áreas mínimo)");
    if (!criterios.cumpleHorasOrientacion)
      faltantes.push(
        `Faltan ${Math.max(0, Math.round(criterios.horasFaltantesOrientacion))} hs de especialidad`
      );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        A veces la página no tiene cargadas todas tus PPS. Si hiciste prácticas que no figuran,
        agregalas acá (se cargan como una solicitud que revisa coordinación).
      </p>

      {faltantes.length > 0 && (
        <div
          className="p-4 rounded-2xl"
          style={{ background: "var(--bg-sunken)", border: "1px solid var(--line)" }}
        >
          <span className="eyebrow" style={{ color: "var(--ink-muted)", fontSize: 10 }}>
            Lo que falta
          </span>
          <ul className="mt-2 space-y-1.5">
            {faltantes.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                <Icon name="alert" size={14} color={DANGER} />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onAddPPS && (
        <button
          type="button"
          onClick={onAddPPS}
          className="w-full rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--accent)" }}
        >
          <Icon name="plus" size={18} strokeWidth={2.4} color="var(--on-accent)" />
          Agregar una PPS
        </button>
      )}

      <div>
        <span className="eyebrow" style={{ color: "var(--ink-muted)", fontSize: 10 }}>
          PPS registradas ({finalizadas.length})
        </span>
        <div className="mt-2 space-y-2">
          {finalizadas.length === 0 ? (
            <p className="text-sm italic" style={{ color: "var(--ink-subtle)" }}>
              Todavía no tenés PPS finalizadas registradas.
            </p>
          ) : (
            finalizadas.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: "var(--bg-sunken)", border: "1px solid var(--line)" }}
              >
                <span className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>
                  {p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
                  {Number(p[FIELD_HORAS_PRACTICAS]) || 0} hs
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const PpsDocCard: React.FC<{
  practica: Practica;
  row?: RowState;
  valid: boolean;
  onSetRow: (patch: Partial<RowState>) => void;
  onPickInforme: () => void;
  onPickAsistencia: () => void;
  onDelete?: () => void;
  isDeleting: boolean;
}> = ({
  practica,
  row,
  valid,
  onSetRow,
  onPickInforme,
  onPickAsistencia,
  onDelete,
  isDeleting,
}) => {
  const esOnline = !!practica[FIELD_ES_ONLINE_PRACTICAS];
  if (!row) return null;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 space-y-4"
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${valid ? "var(--accent)" : "var(--line)"}`,
      }}
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4
            className="text-base font-bold leading-tight truncate"
            style={{ color: "var(--ink)" }}
          >
            {practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]}
          </h4>
          <p className="text-xs font-medium mt-0.5" style={{ color: "var(--ink-muted)" }}>
            {practica[FIELD_ESPECIALIDAD_PRACTICAS] || "—"} ·{" "}
            {Number(practica[FIELD_HORAS_PRACTICAS]) || 0} hs
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {esOnline && (
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
              style={{ background: "var(--tint)", color: "var(--accent-text)" }}
            >
              Online · sin asistencia
            </span>
          )}
          {valid && (
            <span style={{ color: "var(--accent-text)" }}>
              <Icon name="check" size={18} strokeWidth={2.4} />
            </span>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-40"
              style={{ color: DANGER }}
              aria-label="Eliminar PPS"
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Fechas + nota */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--ink-muted)" }}>
            Fecha inicio
          </label>
          <input
            type="date"
            value={toDateInput(practica[FIELD_FECHA_INICIO_PRACTICAS])}
            disabled
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "var(--bg-sunken)",
              border: "1px solid var(--line)",
              color: "var(--ink-muted)",
            }}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--ink-muted)" }}>
            Fecha finalización ✎
          </label>
          <input
            type="date"
            value={row.fechaFin}
            onChange={(e) => onSetRow({ fechaFin: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--line-strong)",
              color: "var(--ink)",
            }}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--ink-muted)" }}>
            Nota {!row.nota && <span style={{ color: DANGER }}>*</span>}
          </label>
          <select
            value={row.nota}
            onChange={(e) => onSetRow({ nota: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--line-strong)",
              color: "var(--ink)",
            }}
          >
            <option value="">Elegí…</option>
            {NOTA_NUMERICA_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {NOTA_TEXTO_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[11px] -mt-1" style={{ color: "var(--ink-subtle)" }}>
        Verificá que la fecha de finalización sea correcta antes de enviar.
      </p>

      {/* Archivos */}
      <div className={`grid grid-cols-1 ${esOnline ? "" : "sm:grid-cols-2"} gap-2.5`}>
        <RowFileButton
          label="Informe final"
          file={row.informe}
          onPick={onPickInforme}
          onClear={() => onSetRow({ informe: null })}
          required
        />
        {!esOnline && (
          <RowFileButton
            label="Planilla de asistencia"
            file={row.asistencia}
            onPick={onPickAsistencia}
            onClear={() => onSetRow({ asistencia: null })}
            required
          />
        )}
      </div>
    </div>
  );
};

const ConfirmarStep: React.FC<{
  count: number;
  totalHoras: number;
  notaPromedio: number | null;
  sugerencias: string;
  onSugerencias: (v: string) => void;
}> = ({ count, totalHoras, notaPromedio, sugerencias, onSugerencias }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "PPS", value: String(count) },
        { label: "Horas totales", value: String(totalHoras) },
        { label: "Nota promedio", value: notaPromedio != null ? String(notaPromedio) : "—" },
      ].map((s) => (
        <div
          key={s.label}
          className="p-4 rounded-2xl text-center"
          style={{ background: "var(--tint)", border: "1px solid var(--line)" }}
        >
          <p
            className="text-2xl font-bold leading-none"
            style={{
              color: "var(--accent-text)",
              fontFamily: '"Instrument Serif", ui-serif, Georgia, serif',
              fontWeight: 400,
            }}
          >
            {s.value}
          </p>
          <p className="eyebrow mt-2" style={{ color: "var(--ink-muted)", fontSize: 9 }}>
            {s.label}
          </p>
        </div>
      ))}
    </div>

    <div>
      <label className="eyebrow block mb-2" style={{ color: "var(--accent-text)", fontSize: 11 }}>
        Sugerencias (opcional)
      </label>
      <textarea
        value={sugerencias}
        onChange={(e) => onSugerencias(e.target.value)}
        rows={3}
        placeholder="¿Algo para mejorar en el proceso?"
        className="w-full text-sm rounded-xl p-3 outline-none focus:ring-2"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--line-strong)",
          color: "var(--ink)",
        }}
      />
    </div>

    <p className="text-xs leading-relaxed" style={{ color: "var(--ink-muted)" }}>
      Al enviar, coordinación recibirá tu acreditación con el detalle de cada PPS. La nota promedio
      se calcula automáticamente (redondeada) y la usamos para cargar en el SAC.
    </p>
  </div>
);

const EnviadoStep: React.FC = () => (
  <div className="py-8 flex flex-col items-center text-center gap-4">
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center"
      style={{ background: "var(--tint)", color: "var(--accent-text)" }}
    >
      <Icon name="check" size={32} strokeWidth={2.4} />
    </div>
    <div>
      <h3 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
        ¡Acreditación enviada!
      </h3>
      <p className="text-sm mt-1 max-w-sm" style={{ color: "var(--ink-soft)" }}>
        Recibimos el detalle de tus PPS. El trámite quedó en proceso y vas a recibir novedades por
        correo.
      </p>
    </div>
  </div>
);

const EmptyPps: React.FC<{ onAddPPS?: () => void }> = ({ onAddPPS }) => (
  <div
    className="py-10 rounded-2xl flex flex-col items-center text-center gap-3"
    style={{ background: "var(--bg-sunken)", border: "1px dashed var(--line-strong)" }}
  >
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center"
      style={{ background: "var(--bg-elevated)", color: "var(--ink-muted)" }}
    >
      <Icon name="file" size={22} />
    </div>
    <p className="text-sm font-medium px-6" style={{ color: "var(--ink-soft)" }}>
      No encontramos PPS finalizadas. Si hiciste prácticas que no figuran, agregalas para continuar.
    </p>
    {onAddPPS && (
      <button
        type="button"
        onClick={onAddPPS}
        className="px-4 py-2 rounded-xl text-sm font-bold text-white"
        style={{ background: "var(--accent)" }}
      >
        Agregar una PPS
      </button>
    )}
  </div>
);

const FooterButtons: React.FC<{
  step: Step;
  cumpleTodo: boolean;
  allRowsValid: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
}> = ({ step, cumpleTodo, allRowsValid, isSubmitting, onBack, onNext }) => {
  const showBack = step !== "requisitos";
  const nextLabel =
    step === "requisitos"
      ? cumpleTodo
        ? "Continuar"
        : "Continuar igual"
      : step === "completar"
        ? "Ya cargué todo, continuar"
        : step === "documentacion"
          ? "Revisar y enviar"
          : "Enviar acreditación";
  const nextDisabled =
    (step === "documentacion" && !allRowsValid) || (step === "confirmar" && isSubmitting);

  return (
    <>
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-4 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-40 flex items-center gap-1.5"
          style={{ color: "var(--ink-muted)" }}
        >
          <Icon name="arrowback" size={16} />
          Atrás
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 flex items-center gap-2"
        style={{ background: "var(--accent)" }}
      >
        {isSubmitting ? "Enviando…" : nextLabel}
        {!isSubmitting && <Icon name="arrow" size={16} color="var(--on-accent)" />}
      </button>
    </>
  );
};

export default FinalizacionForm;
