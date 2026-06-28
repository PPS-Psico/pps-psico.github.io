/**
 * PenalizationManager — Rediseño v1 (Paper & Ink editorial)
 *
 * Solo cambia la capa visual. La lógica de datos se preserva intacta:
 *   · Query de PPS relevantes del alumno (convocatorias + prácticas en curso).
 *   · applyPenaltyMutation con baja automática de inscripción/práctica según el
 *     tipo de incumplimiento.
 *   · Agregación por alumno con puntaje total y semáforo de severidad.
 *   · Borrado con confirmación (ConfirmModal).
 *
 * Severidad (puntaje): ≥21 crítico · ≥11 medio · resto leve.
 */
import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminSearch from "./AdminSearch";
import {
  fetchAllData,
  createRecord,
  deleteRecord,
  updateRecord,
} from "../../services/supabaseService";
import { mockDb } from "../../services/mockDb";
import type { EstudianteFields, Penalizacion, AirtableRecord } from "../../types";
import {
  TABLE_NAME_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  TABLE_NAME_PENALIZACIONES,
  FIELD_PENALIZACION_ESTUDIANTE_LINK,
  FIELD_PENALIZACION_TIPO,
  FIELD_PENALIZACION_FECHA,
  FIELD_PENALIZACION_NOTAS,
  FIELD_PENALIZACION_PUNTAJE,
  TABLE_NAME_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  TABLE_NAME_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_PENALIZACION_CONVOCATORIA_LINK,
  FIELD_LEGAJO_CONVOCATORIAS,
  FIELD_NOMBRE_BUSQUEDA_PRACTICAS,
} from "../../constants";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import ConfirmModal from "../ConfirmModal";
import { formatDate } from "../../utils/formatters";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { injectPremiumMotion } from "./premiumMotion";
import { logger } from "../../utils/logger";
import {
  mapConvocatoria,
  mapLanzamiento,
  mapPenalizacion,
  mapPractica,
  mapEstudiante,
} from "../../utils/mappers";

// ─── CSS scoped (Paper & Ink editorial) ───────────────────────────────────────

const CSS = `
.pen {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .pen {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
}
.pen .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.pen .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
.pen .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

/* Panel de búsqueda */
.pen-search-panel{ border:1px solid var(--rule-2); border-radius:16px; background:var(--paper); padding:22px 24px; }
.pen-search-panel h2{ font-family:'Instrument Serif', serif; font-size:26px; font-weight:700; letter-spacing:-0.025em; margin:6px 0 0; }
.pen-search-panel p{ font-size:13.5px; color:var(--ink-3); margin:6px 0 0; max-width:520px; }
.pen-search-box{ margin-top:18px; border:1px solid var(--rule-3); border-radius:10px; background:var(--paper-2); padding:4px 12px; }
.pen-search-box:focus-within{ border-color:var(--accent); }

/* Header de listado */
.pen-list-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin:30px 0 14px; flex-wrap:wrap; }
.pen-legend{ display:flex; gap:14px; flex-wrap:wrap; }
.pen-legend span{ display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--ink-3); }
.pen-legend .dot{ width:8px; height:8px; border-radius:999px; }

/* Tarjeta de alumno */
.pen-card{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); overflow:hidden; transition:border-color .12s ease; }
.pen-card:hover{ border-color:var(--rule-3); }
.pen-card[data-sev="critico"]{ border-left:3px solid var(--warn); }
.pen-card-head{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; cursor:pointer; background:transparent; border:none; text-align:left; font-family:inherit; }
.pen-card-head:hover{ background:var(--paper-2); }
.pen-id{ display:flex; align-items:center; gap:13px; min-width:0; }
.pen-sev-ico{ width:38px; height:38px; flex-shrink:0; border-radius:10px; display:flex; align-items:center; justify-content:center; }
.pen-sev-ico .material-icons{ font-size:20px; }
.pen-sev-ico[data-sev="critico"]{ background:var(--warn-s); color:var(--warn); }
.pen-sev-ico[data-sev="medio"]{ background:var(--warn-s); color:var(--warn); }
.pen-sev-ico[data-sev="leve"]{ background:var(--paper-3); color:var(--ink-3); }
.pen-name{ font-size:15px; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pen-legajo{ font-size:12px; color:var(--ink-3); font-family:'JetBrains Mono', monospace; margin-top:1px; }
.pen-score-wrap{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
.pen-score{ text-align:right; }
.pen-score .num{ font-family:'JetBrains Mono', monospace; font-size:30px; font-weight:300; letter-spacing:-0.04em; line-height:1; }
.pen-score .num[data-sev="critico"]{ color:var(--warn); }
.pen-score .num[data-sev="medio"]{ color:var(--warn); }
.pen-score .num[data-sev="leve"]{ color:var(--ink-2); }
.pen-score .lbl{ font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-4); margin-top:2px; }
.pen-chev{ color:var(--ink-4); transition:transform .2s ease; }
.pen-chev.open{ transform:rotate(180deg); }

/* Detalle expandido */
.pen-detail{ border-top:1px solid var(--rule-2); background:var(--paper-2); padding:16px 18px; }
.pen-detail h4{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); margin:0 0 12px; }
.pen-item{ display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:1px solid var(--rule-2); border-radius:10px; background:var(--paper); }
.pen-item + .pen-item{ margin-top:8px; }
.pen-item-ico{ color:var(--ink-4); margin-top:1px; }
.pen-item-ico .material-icons{ font-size:18px; }
.pen-item-body{ flex:1; min-width:0; }
.pen-item-tipo{ font-size:13.5px; font-weight:600; color:var(--ink); }
.pen-item-pps{ font-size:11.5px; color:var(--ink-3); margin-top:1px; }
.pen-item-date{ font-size:11px; font-family:'JetBrains Mono', monospace; color:var(--ink-3); white-space:nowrap; }
.pen-item-notes{ margin-top:8px; font-size:12.5px; color:var(--ink-2); line-height:1.5; padding-left:10px; border-left:2px solid var(--rule-3); font-style:italic; }
.pen-del{ flex-shrink:0; width:30px; height:30px; border-radius:8px; border:none; background:transparent; color:var(--ink-4); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .12s, color .12s; }
.pen-del:hover{ background:var(--warn-s); color:var(--warn); }
.pen-del .material-icons{ font-size:17px; }
.pen-del:disabled{ opacity:.5; cursor:not-allowed; }
@keyframes pen-spin{ to{ transform:rotate(360deg); } }
.pen-spin{ width:15px; height:15px; border:2px solid var(--rule-3); border-top-color:var(--warn); border-radius:999px; animation:pen-spin .8s linear infinite; }

/* Modal */
.pen-modal-bg{ position:fixed; inset:0; background:rgba(20,19,16,0.45); display:flex; align-items:center; justify-content:center; z-index:200; padding:24px; animation:pen-fade .15s ease; }
@keyframes pen-fade{ from{ opacity:0; } to{ opacity:1; } }
.pen-modal{ background:var(--paper); border:1px solid var(--rule-2); border-radius:16px; width:100%; max-width:480px; max-height:90vh; overflow:auto; box-shadow:0 24px 80px rgba(20,19,16,0.22); }
.pen-modal-head{ padding:20px 24px; border-bottom:1px solid var(--rule-2); }
.pen-modal-head .eyebrow{ color:var(--warn); }
.pen-modal-head h3{ font-family:'Instrument Serif', serif; font-size:22px; font-weight:700; letter-spacing:-0.02em; margin:5px 0 0; }
.pen-modal-body{ padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
.pen-modal-foot{ padding:16px 24px; border-top:1px solid var(--rule-2); display:flex; justify-content:flex-end; gap:10px; }
.pen-label{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--ink-3); margin-bottom:6px; }
.pen-field{ width:100%; padding:10px 12px; border:1px solid var(--rule-3); border-radius:9px; background:var(--paper-2); color:var(--ink); font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; }
.pen-field:focus{ border-color:var(--accent); }
textarea.pen-field{ resize:vertical; min-height:64px; }
.pen-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:9px 16px; border-radius:9px; border:1px solid var(--rule-3); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; transition:background .12s; }
.pen-btn:hover{ background:var(--paper-2); }
.pen-btn-primary{ background:var(--warn); color:#fff; border-color:var(--warn); }
.pen-btn-primary:hover{ opacity:.88; background:var(--warn); }
.pen-btn:disabled{ opacity:.5; cursor:not-allowed; }
.pen-hint{ display:flex; align-items:flex-start; gap:8px; font-size:11.5px; color:var(--ink-3); line-height:1.5; }
.pen-hint .material-icons{ font-size:14px; color:var(--warn); flex-shrink:0; margin-top:1px; }
`;

injectScopedStyles("pen-styles", CSS);
injectPremiumMotion();

// ─── Constantes ───────────────────────────────────────────────────────────────

const PENALTY_TYPES = [
  "Baja Anticipada",
  "Baja sobre la Fecha / Ausencia en Inicio",
  "Abandono durante la PPS",
  "Falta sin Aviso",
];

const TRIGGER_TYPES = [
  "Baja Anticipada",
  "Baja sobre la Fecha / Ausencia en Inicio",
  "Abandono durante la PPS",
];

type Severity = "critico" | "medio" | "leve";

const severityOf = (score: number): Severity =>
  score >= 21 ? "critico" : score >= 11 ? "medio" : "leve";

const severityMeta: Record<Severity, { label: string; icon: string }> = {
  critico: { label: "Crítico", icon: "local_fire_department" },
  medio: { label: "Medio", icon: "warning_amber" },
  leve: { label: "Leve", icon: "priority_high" },
};

const getPenaltyIcon = (type: string | undefined) => {
  if (!type) return "gavel";
  const t = type.toLowerCase();
  if (t.includes("baja anticipada")) return "event_busy";
  if (t.includes("baja sobre la fecha") || t.includes("ausencia")) return "no_accounts";
  if (t.includes("abandono")) return "directions_run";
  if (t.includes("falta sin aviso")) return "person_off";
  return "gavel";
};

interface SelectedStudent {
  id: string;
  legajo: string;
  nombre: string;
}

interface PenalizedStudent {
  id: string;
  legajo: string;
  nombre: string;
  totalScore: number;
  penalties: (Penalizacion & { id: string; ppsName?: string })[];
}

// ─── Modal: aplicar penalización ───────────────────────────────────────────────

const AddPenaltyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  student: SelectedStudent;
  onSuccess: () => void;
  isTestingMode?: boolean;
}> = ({ isOpen, onClose, student, onSuccess, isTestingMode = false }) => {
  const [penaltyType, setPenaltyType] = useState(PENALTY_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [selectedPpsId, setSelectedPpsId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: relevantPPS, isLoading: isLoadingPPS } = useQuery({
    queryKey: ["relevantPPSForModal", student.id, isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const mockRecs = (await mockDb.getAll("lanzamientos_pps")) as Record<string, unknown>[];
        return mockRecs.map((r) => ({
          id: r.id as string,
          name: `${r[FIELD_NOMBRE_PPS_LANZAMIENTOS]} (${formatDate(r[FIELD_FECHA_INICIO_LANZAMIENTOS] as string)})`,
        }));
      }

      const convocatoriasRes = await fetchAllData(
        TABLE_NAME_CONVOCATORIAS,
        [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS],
        {
          [FIELD_LEGAJO_CONVOCATORIAS]: student.legajo,
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: ["Seleccionado", "Inscripto"],
        }
      );

      const practicasRes = await fetchAllData(
        TABLE_NAME_PRACTICAS,
        [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, FIELD_ESTADO_PRACTICA],
        {
          [FIELD_NOMBRE_BUSQUEDA_PRACTICAS]: student.legajo,
          [FIELD_ESTADO_PRACTICA]: "En curso",
        }
      );

      const convocatorias = convocatoriasRes.records.map(mapConvocatoria);
      const practicas = practicasRes.records.map(mapPractica);

      const lanzamientoIds = new Set<string>();
      convocatorias.forEach((c) => {
        const ids = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        (Array.isArray(ids) ? ids : [ids])
          .filter(Boolean)
          .forEach((id) => lanzamientoIds.add(id as string));
      });
      practicas.forEach((p) => {
        const ids = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
        (Array.isArray(ids) ? ids : [ids])
          .filter(Boolean)
          .forEach((id) => lanzamientoIds.add(id as string));
      });

      if (lanzamientoIds.size === 0) return [];

      const lanzamientosRes = await fetchAllData(
        TABLE_NAME_LANZAMIENTOS_PPS,
        [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS],
        { id: Array.from(lanzamientoIds) }
      );

      return lanzamientosRes.records.map(mapLanzamiento).map((r) => ({
        id: r.id,
        name: `${r[FIELD_NOMBRE_PPS_LANZAMIENTOS]} (${formatDate(r[FIELD_FECHA_INICIO_LANZAMIENTOS])})`,
      }));
    },
    enabled: isOpen,
  });

  const applyPenaltyMutation = useMutation({
    mutationFn: async (penaltyData: Record<string, unknown>) => {
      if (isTestingMode) {
        logger.info("TEST MODE: Applying penalty:", penaltyData);
        await mockDb.create("penalizaciones", penaltyData);
        return;
      }
      const penaltyResult = await createRecord(TABLE_NAME_PENALIZACIONES, penaltyData);
      if (penaltyResult.error) {
        const errorMsg =
          typeof penaltyResult.error.error === "string"
            ? penaltyResult.error.error
            : penaltyResult.error.error.message;
        throw new Error(`Error al crear la penalización: ${errorMsg}`);
      }

      if (selectedPpsId && TRIGGER_TYPES.includes(penaltyType)) {
        const ppsId = selectedPpsId;

        const [convocatoriasRes, practicasRes] = await Promise.all([
          fetchAllData(TABLE_NAME_CONVOCATORIAS, undefined, {
            [FIELD_LEGAJO_CONVOCATORIAS]: student.legajo,
          }),
          fetchAllData(TABLE_NAME_PRACTICAS, undefined, {
            [FIELD_NOMBRE_BUSQUEDA_PRACTICAS]: student.legajo,
          }),
        ]);

        const targetConv = convocatoriasRes.records.map(mapConvocatoria).find((c) => {
          const ids = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
          return (Array.isArray(ids) ? ids : [ids]).includes(ppsId);
        });

        const targetPractica = practicasRes.records.map(mapPractica).find((p) => {
          const ids = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
          return (Array.isArray(ids) ? ids : [ids]).includes(ppsId);
        });

        const sideEffectPromises: Promise<unknown>[] = [];
        if (targetConv) {
          sideEffectPromises.push(
            updateRecord(TABLE_NAME_CONVOCATORIAS, targetConv.id, {
              [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "No Seleccionado",
            })
          );
        }
        if (targetPractica) {
          sideEffectPromises.push(deleteRecord(TABLE_NAME_PRACTICAS, targetPractica.id));
        }
        if (sideEffectPromises.length > 0) {
          await Promise.all(sideEffectPromises);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPenalizedStudents"] });
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleSave = () => {
    const penaltyData: Record<string, unknown> = {
      [FIELD_PENALIZACION_ESTUDIANTE_LINK]: student.id,
      [FIELD_PENALIZACION_TIPO]: penaltyType,
      [FIELD_PENALIZACION_FECHA]: new Date().toISOString().split("T")[0],
      [FIELD_PENALIZACION_NOTAS]: notes,
      [FIELD_PENALIZACION_PUNTAJE]: 10,
    };
    if (selectedPpsId) penaltyData[FIELD_PENALIZACION_CONVOCATORIA_LINK] = selectedPpsId;
    applyPenaltyMutation.mutate(penaltyData);
  };

  if (!isOpen) return null;

  const triggersUnsubscribe = TRIGGER_TYPES.includes(penaltyType) && !!selectedPpsId;

  return (
    <div className="pen" onClick={onClose}>
      <div className="pen-modal-bg">
        <div className="pen-modal" onClick={(e) => e.stopPropagation()}>
          <div className="pen-modal-head">
            <span className="eyebrow">Nueva penalización</span>
            <h3>{student.nombre}</h3>
          </div>

          <div className="pen-modal-body">
            <div>
              <label htmlFor="pps-select-modal" className="pen-label">
                PPS afectada (opcional)
              </label>
              {isLoadingPPS ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Cargando PPS…</p>
              ) : (
                <select
                  id="pps-select-modal"
                  className="pen-field"
                  value={selectedPpsId}
                  onChange={(e) => setSelectedPpsId(e.target.value)}
                >
                  <option value="">Sin PPS específica…</option>
                  {relevantPPS?.map((pps: { id: string; name: string }) => (
                    <option key={pps.id} value={pps.id}>
                      {pps.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="penalty-type-modal" className="pen-label">
                Tipo de incumplimiento
              </label>
              <select
                id="penalty-type-modal"
                className="pen-field"
                value={penaltyType}
                onChange={(e) => setPenaltyType(e.target.value)}
              >
                {PENALTY_TYPES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="penalty-notes-modal" className="pen-label">
                Notas (opcional)
              </label>
              <textarea
                id="penalty-notes-modal"
                className="pen-field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contexto del incumplimiento…"
              />
            </div>

            {triggersUnsubscribe && (
              <div className="pen-hint">
                <span className="material-icons">info</span>
                <span>
                  Este tipo da de baja automáticamente la inscripción o práctica del alumno en la
                  PPS seleccionada.
                </span>
              </div>
            )}
          </div>

          <div className="pen-modal-foot">
            <button onClick={onClose} className="pen-btn">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={applyPenaltyMutation.isPending}
              className="pen-btn pen-btn-primary"
            >
              {applyPenaltyMutation.isPending ? "Guardando…" : "Aplicar penalización"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tarjeta de alumno penalizado ──────────────────────────────────────────────

const PenalizedStudentCard: React.FC<{
  student: PenalizedStudent;
  onDeleteRequest: (penaltyId: string) => void;
  deletingId: string | null;
}> = ({ student, onDeleteRequest, deletingId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sev = useMemo(() => severityOf(student.totalScore), [student.totalScore]);

  return (
    <div className="pen-card" data-sev={sev}>
      <button
        className="pen-card-head"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        aria-controls={`penalties-for-${student.legajo}`}
      >
        <div className="pen-id">
          <span className="pen-sev-ico" data-sev={sev}>
            <span className="material-icons">{severityMeta[sev].icon}</span>
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="pen-name">{student.nombre}</div>
            <div className="pen-legajo">Legajo {student.legajo}</div>
          </div>
        </div>
        <div className="pen-score-wrap">
          <div className="pen-score">
            <div className="num" data-sev={sev}>
              {student.totalScore}
            </div>
            <div className="lbl">{severityMeta[sev].label}</div>
          </div>
          <span className={`material-icons pen-chev ${isExpanded ? "open" : ""}`}>expand_more</span>
        </div>
      </button>

      {isExpanded && (
        <div id={`penalties-for-${student.legajo}`} className="pen-detail">
          <h4>Historial de incumplimientos</h4>
          {student.penalties.map((p) => (
            <div key={p.id} className="pen-item">
              <span className="pen-item-ico">
                <span className="material-icons">
                  {getPenaltyIcon(p[FIELD_PENALIZACION_TIPO] ?? undefined)}
                </span>
              </span>
              <div className="pen-item-body">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div className="pen-item-tipo">{p[FIELD_PENALIZACION_TIPO]}</div>
                    {p.ppsName && <div className="pen-item-pps">PPS: {p.ppsName}</div>}
                  </div>
                  <div className="pen-item-date">{formatDate(p[FIELD_PENALIZACION_FECHA])}</div>
                </div>
                {p[FIELD_PENALIZACION_NOTAS] && (
                  <div className="pen-item-notes">{p[FIELD_PENALIZACION_NOTAS]}</div>
                )}
              </div>
              <button
                className="pen-del"
                onClick={() => onDeleteRequest(p.id)}
                disabled={deletingId === p.id}
                aria-label="Eliminar penalización"
              >
                {deletingId === p.id ? (
                  <span className="pen-spin" />
                ) : (
                  <span className="material-icons">delete_outline</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Vista principal ────────────────────────────────────────────────────────────

interface PenalizationManagerProps {
  isTestingMode?: boolean;
}

const PenalizationManager: React.FC<PenalizationManagerProps> = ({ isTestingMode = false }) => {
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [penaltyToDelete, setPenaltyToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: penalizedStudents, isLoading } = useQuery<PenalizedStudent[]>({
    queryKey: ["allPenalizedStudents", isTestingMode],
    queryFn: async () => {
      let penaltiesRes: Record<string, unknown>[] = [],
        studentsRes: Record<string, unknown>[] = [],
        lanzamientosRes: Record<string, unknown>[] = [];

      if (isTestingMode) {
        [penaltiesRes, studentsRes, lanzamientosRes] = await Promise.all([
          mockDb.getAll("penalizaciones"),
          mockDb.getAll("estudiantes"),
          mockDb.getAll("lanzamientos_pps"),
        ]);
      } else {
        const [p, s, l] = await Promise.all([
          fetchAllData(TABLE_NAME_PENALIZACIONES),
          fetchAllData(TABLE_NAME_ESTUDIANTES, [
            FIELD_LEGAJO_ESTUDIANTES,
            FIELD_NOMBRE_ESTUDIANTES,
          ]),
          fetchAllData(TABLE_NAME_LANZAMIENTOS_PPS, [FIELD_NOMBRE_PPS_LANZAMIENTOS]),
        ]);
        penaltiesRes = p.records.map(mapPenalizacion);
        studentsRes = s.records.map(mapEstudiante);
        lanzamientosRes = l.records.map(mapLanzamiento);
      }

      const studentsMap = new Map<string, { legajo: string; nombre: string }>();
      studentsRes.forEach((r) => {
        if (r[FIELD_LEGAJO_ESTUDIANTES] && r[FIELD_NOMBRE_ESTUDIANTES]) {
          studentsMap.set(r.id as string, {
            legajo: String(r[FIELD_LEGAJO_ESTUDIANTES]),
            nombre: String(r[FIELD_NOMBRE_ESTUDIANTES]),
          });
        }
      });

      const lanzamientosMap = new Map<string, string>();
      lanzamientosRes.forEach((r) => {
        if (r[FIELD_NOMBRE_PPS_LANZAMIENTOS]) {
          lanzamientosMap.set(r.id as string, String(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]));
        }
      });

      const penaltiesByStudent = new Map<string, PenalizedStudent>();
      penaltiesRes.forEach((p) => {
        const rawStudentLink = p[FIELD_PENALIZACION_ESTUDIANTE_LINK];
        const studentId = (
          Array.isArray(rawStudentLink) ? rawStudentLink[0] : rawStudentLink
        ) as string;
        const studentInfo = studentId ? studentsMap.get(studentId) : null;
        if (!studentInfo) return;

        if (!penaltiesByStudent.has(studentId)) {
          penaltiesByStudent.set(studentId, {
            id: studentId,
            legajo: studentInfo.legajo,
            nombre: studentInfo.nombre,
            totalScore: 0,
            penalties: [],
          });
        }
        const studentData = penaltiesByStudent.get(studentId)!;
        const rawPpsLink = p[FIELD_PENALIZACION_CONVOCATORIA_LINK];
        const ppsId = (Array.isArray(rawPpsLink) ? rawPpsLink[0] : rawPpsLink) as
          | string
          | undefined;

        studentData.penalties.push({
          ...(p as Penalizacion & { id: string }),
          ppsName: ppsId ? lanzamientosMap.get(ppsId) : undefined,
        });
        studentData.totalScore += (p[FIELD_PENALIZACION_PUNTAJE] as number) || 0;
      });
      return Array.from(penaltiesByStudent.values()).sort((a, b) => b.totalScore - a.totalScore);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (penaltyId: string) => {
      if (isTestingMode) return mockDb.delete("penalizaciones", penaltyId);
      return deleteRecord(TABLE_NAME_PENALIZACIONES, penaltyId);
    },
    onSuccess: () => {
      setToastInfo({ message: "Penalización eliminada.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["allPenalizedStudents"] });
    },
    onError: () => {
      setToastInfo({ message: "Error al eliminar la penalización.", type: "error" });
    },
    onSettled: () => {
      setDeletingId(null);
      setPenaltyToDelete(null);
    },
  });

  const confirmDelete = () => {
    if (penaltyToDelete) {
      setDeletingId(penaltyToDelete);
      deleteMutation.mutate(penaltyToDelete);
    }
  };

  const handleStudentSelect = useCallback((student: AirtableRecord<EstudianteFields>) => {
    if (!student[FIELD_LEGAJO_ESTUDIANTES] || !student[FIELD_NOMBRE_ESTUDIANTES]) {
      setToastInfo({ message: "El registro del estudiante está incompleto.", type: "error" });
      return;
    }
    setSelectedStudent({
      id: student.id,
      legajo: String(student[FIELD_LEGAJO_ESTUDIANTES]),
      nombre: String(student[FIELD_NOMBRE_ESTUDIANTES]),
    });
    setIsModalOpen(true);
  }, []);

  const totalPenalties = useMemo(
    () => (penalizedStudents || []).reduce((sum, s) => sum + s.penalties.length, 0),
    [penalizedStudents]
  );

  return (
    <div className="pen">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {selectedStudent && (
        <AddPenaltyModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          student={selectedStudent}
          onSuccess={() =>
            setToastInfo({ message: "Penalización aplicada con éxito.", type: "success" })
          }
          isTestingMode={isTestingMode}
        />
      )}

      <ConfirmModal
        isOpen={!!penaltyToDelete}
        title="Eliminar penalización"
        message="¿Seguro que querés eliminar este registro? Afectará el puntaje del alumno y no se puede deshacer."
        onConfirm={confirmDelete}
        onClose={() => setPenaltyToDelete(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

      {/* Panel de búsqueda / alta */}
      <div className="pen-search-panel">
        <span className="eyebrow">Aplicar sanción</span>
        <h2 className="serif">Penalizaciones</h2>
        <p>
          Buscá un alumno para registrar un incumplimiento. Según el tipo, se da de baja
          automáticamente su lugar en la PPS afectada.
        </p>
        <div className="pen-search-box">
          <AdminSearch onStudentSelect={handleStudentSelect} isTestingMode={isTestingMode} />
        </div>
      </div>

      {/* Listado */}
      <div className="pen-list-head">
        <span className="eyebrow">
          Alumnos sancionados{penalizedStudents ? ` · ${penalizedStudents.length}` : ""}
          {totalPenalties > 0 ? ` · ${totalPenalties} registros` : ""}
        </span>
        <div className="pen-legend">
          <span>
            <span className="dot" style={{ background: "var(--warn)" }} /> Crítico ≥ 21
          </span>
          <span>
            <span className="dot" style={{ background: "var(--warn)", opacity: 0.5 }} /> Medio ≥ 11
          </span>
          <span>
            <span className="dot" style={{ background: "var(--ink-4)" }} /> Leve
          </span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader />
        </div>
      ) : penalizedStudents && penalizedStudents.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 14,
          }}
        >
          {penalizedStudents.map((student) => (
            <PenalizedStudentCard
              key={student.id}
              student={student}
              onDeleteRequest={setPenaltyToDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="verified_user"
          title="Sin penalizaciones"
          message="No hay estudiantes con penalizaciones registradas."
        />
      )}
    </div>
  );
};

export default PenalizationManager;
