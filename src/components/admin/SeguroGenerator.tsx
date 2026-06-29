import React, { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_DIRECCION_CONVOCATORIAS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_DNI_ESTUDIANTES,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_FECHA_FIN_CONVOCATORIAS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_HORARIO_ASIGNADO_CONVOCATORIAS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_NOMBRE_SEPARADO_ESTUDIANTES,
  FIELD_ORIENTACION_CONVOCATORIAS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_TELEFONO_ESTUDIANTES,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_INSTITUCION_LINK_PRACTICAS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
} from "../../constants";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  marcarAseguramiento,
  revertirAseguramiento,
  buildClipboardText,
} from "../../services/aseguramientoService";
import {
  formatDate,
  formatPhoneNumber,
  normalizeStringForComparison,
  simpleNameSplit,
} from "../../utils/formatters";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { injectPremiumMotion } from "./premiumMotion";
import { downloadBlob } from "../../utils/downloadFile";
import { logger } from "../../utils/logger";
import { getErrorMessage } from "../../utils/getErrorMessage";
import type { Convocatoria } from "../../types";

/**
 * Convocatoria agregada por lanzamiento para la tabla de selección del seguro:
 * agrupa los inscriptos seleccionados en `estudiante_id` (array de IDs).
 */
type ConvAgg = Omit<Convocatoria, "estudiante_id"> & {
  id: string;
  estudiante_id: string[];
};

// ─── CSS scoped (Paper & Ink editorial) ───────────────────────────────────────
const SEG_CSS = `
.seg {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  --wa:#2F8F43;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .seg {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
  --wa:#88BD96;
}
.seg .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.seg .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; }
.seg .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

.seg-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:22px; }
.seg-head h2{ font-family:'Instrument Serif', serif; font-size:26px; font-weight:700; letter-spacing:-0.025em; margin:5px 0 0; }
.seg-head p{ font-size:13.5px; color:var(--ink-3); margin:5px 0 0; max-width:520px; }
.seg-chip-ai{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; padding:3px 9px; border-radius:999px; background:var(--ai-s); color:var(--ai); white-space:nowrap; }
.seg-chip-ai .material-icons{ font-size:12px; }

/* Pasos */
.seg-steps{ display:flex; align-items:center; gap:8px; margin-bottom:22px; }
.seg-step{ display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--ink-4); }
.seg-step b{ width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-family:'JetBrains Mono', monospace; background:var(--paper-3); color:var(--ink-3); }
.seg-step[data-on="1"]{ color:var(--ink); }
.seg-step[data-on="1"] b{ background:var(--ink); color:var(--paper); }
.seg-step-line{ flex:1; height:1px; background:var(--rule-3); max-width:48px; }

/* Tabla de convocatorias */
.seg-panel{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); overflow:hidden; }
.seg-table{ width:100%; border-collapse:collapse; font-size:13.5px; }
.seg-table thead th{ text-align:left; padding:11px 16px; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--ink-3); border-bottom:1px solid var(--rule-2); background:var(--paper-2); }
.seg-table tbody tr{ border-bottom:1px solid var(--rule-2); cursor:pointer; transition:background .1s; }
.seg-table tbody tr:last-child{ border-bottom:none; }
.seg-table tbody tr:hover{ background:var(--paper-2); }
.seg-table tbody tr[data-sel="1"]{ background:var(--accent-s); }
.seg-table td{ padding:13px 16px; color:var(--ink-2); }
.seg-table td.name{ font-weight:600; color:var(--ink); }
.seg-count{ display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:22px; padding:0 7px; font-size:11.5px; font-weight:700; font-family:'JetBrains Mono', monospace; border-radius:999px; background:var(--accent-s); color:var(--accent); }

/* Checkbox simple */
.seg-check{ width:18px; height:18px; border-radius:5px; border:1.5px solid var(--rule-3); display:inline-flex; align-items:center; justify-content:center; background:var(--paper); transition:all .12s; }
.seg-check[data-on="1"]{ background:var(--ink); border-color:var(--ink); }
.seg-check .material-icons{ font-size:14px; color:var(--paper); }

/* Botones */
.seg-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:9px 15px; border-radius:9px; border:1px solid var(--rule-3); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; transition:background .12s; white-space:nowrap; }
.seg-btn:hover{ background:var(--paper-2); }
.seg-btn:disabled{ opacity:.5; cursor:not-allowed; }
.seg-btn-primary{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.seg-btn-primary:hover{ opacity:.9; background:var(--ink); }
.seg-btn-wa{ background:var(--wa); color:#fff; border-color:var(--wa); }
.seg-btn-wa:hover{ opacity:.9; }
.seg-btn .material-icons{ font-size:16px; }
.seg-link{ background:none; border:none; cursor:pointer; font-family:inherit; font-size:12px; font-weight:600; color:var(--ink-3); display:inline-flex; align-items:center; gap:5px; }
.seg-link:hover{ color:var(--accent); }
.seg-link .material-icons{ font-size:15px; }

/* Tarjeta de institución (review) */
.seg-inst{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); padding:18px 20px; }
.seg-inst + .seg-inst{ margin-top:12px; }
.seg-inst-head{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:14px; }
.seg-inst-name{ font-family:'Instrument Serif', serif; font-size:18px; font-weight:700; letter-spacing:-0.02em; }
.seg-inst-count{ font-size:12px; color:var(--ink-3); }
/* Pasos numerados dentro de la tarjeta */
.seg-actions{ display:flex; flex-wrap:wrap; gap:8px; padding:14px; border:1px solid var(--rule-2); border-radius:11px; background:var(--paper-2); }
.seg-num{ display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; font-size:10px; font-family:'JetBrains Mono', monospace; background:var(--ink); color:var(--paper); margin-right:2px; }
.seg-disclosure{ margin-top:12px; }
.seg-disclosure summary{ cursor:pointer; font-size:12px; font-weight:600; color:var(--ink-3); list-style:none; display:flex; align-items:center; gap:6px; }
.seg-disclosure summary .material-icons{ font-size:16px; transition:transform .15s; }
.seg-disclosure[open] summary .material-icons{ transform:rotate(90deg); }
.seg-stud-list{ margin-top:8px; padding-left:18px; border-left:2px solid var(--rule-3); }
.seg-stud{ padding:7px 0; font-size:13px; border-bottom:1px solid var(--rule-2); }
.seg-stud:last-child{ border-bottom:none; }
.seg-stud b{ font-weight:600; color:var(--ink); }
.seg-stud span{ color:var(--ink-3); margin-left:8px; font-family:'JetBrains Mono', monospace; font-size:11.5px; }
.seg-foot{ display:flex; justify-content:flex-end; gap:10px; padding-top:16px; margin-top:18px; border-top:1px solid var(--rule-2); }

/* ── Flujo de 4 pasos (contextual, Paper & Ink) ─────────────────────────────── */
.seg-flowhead{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); padding:16px 18px; margin-bottom:18px; }
.seg-flowhead-name{ font-family:'Instrument Serif', serif; font-size:20px; font-weight:700; letter-spacing:-0.02em; margin:2px 0 0; }
.seg-flowhead-meta{ display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
.seg-meta-chip{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; padding:4px 10px; border-radius:999px; background:var(--paper-2); color:var(--ink-2); }
.seg-meta-chip .material-icons{ font-size:13px; color:var(--ink-3); }

.seg-steplist{ display:flex; flex-direction:column; gap:10px; }
.seg-steprow{ display:flex; align-items:center; gap:14px; border:1px solid var(--rule-2); border-radius:12px; background:var(--paper); padding:14px 16px; transition:border-color .12s, background .12s; }
.seg-steprow[data-done="1"]{ background:var(--ok-s); border-color:var(--ok); }
.seg-steprow[data-final="1"]{ border-color:var(--ink); border-width:1.5px; }
.seg-steprow[data-final="1"][data-done="1"]{ border-color:var(--ok); }
.seg-stepdot{ flex:none; width:30px; height:30px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; font-family:'JetBrains Mono', monospace; background:var(--paper-3); color:var(--ink-3); }
.seg-steprow[data-done="1"] .seg-stepdot{ background:var(--ok); color:#fff; }
.seg-stepdot .material-icons{ font-size:17px; }
.seg-stepbody{ flex:1; min-width:0; }
.seg-steptitle{ font-size:14px; font-weight:600; color:var(--ink); display:flex; align-items:center; gap:8px; }
.seg-steptag{ font-size:9.5px; text-transform:uppercase; letter-spacing:.1em; font-weight:700; padding:2px 7px; border-radius:999px; background:var(--ink); color:var(--paper); }
.seg-stepdesc{ font-size:12.5px; color:var(--ink-3); margin-top:2px; }

/* Banner "seguro gestionado" */
.seg-done{ border:1px solid var(--ok); border-radius:14px; background:var(--ok-s); padding:18px 20px; display:flex; align-items:flex-start; gap:14px; }
.seg-done-icon{ flex:none; width:36px; height:36px; border-radius:50%; background:var(--ok); color:#fff; display:inline-flex; align-items:center; justify-content:center; }
.seg-done-body{ flex:1; min-width:0; }
.seg-done-title{ font-family:'Instrument Serif', serif; font-size:18px; font-weight:700; letter-spacing:-0.02em; }
.seg-done-sub{ font-size:13px; color:var(--ink-2); margin-top:3px; }
`;
injectScopedStyles("seg-styles", SEG_CSS);
injectPremiumMotion();

interface SeguroGeneratorProps {
  showModal: (title: string, message: string) => void;
  isTestingMode?: boolean;
  preSelectedLanzamientoId?: string | null;
}

interface StudentForReview {
  studentId: string;
  nombre: string;
  apellido: string;
  dni: string;
  legajo: string;
  correo: string;
  telefono: string;
  institucion: string;
  institucionTelefono: string;
  direccion: string;
  periodo: string;
  horario: string;
  // Campos calculados para el Excel de Seguro
  cargo: string;
  lugarCompleto: string;
  duracionCompleta: string;
  tutor: string;
  orientacion: string;
}

const SeguroGenerator: React.FC<SeguroGeneratorProps> = ({
  showModal,
  isTestingMode = false,
  preSelectedLanzamientoId,
}) => {
  // Cuando se entra desde una PPS (Lanzador), el flujo arranca contextual en los
  // 4 pasos, sin paso previo de "Seleccionar convocatorias" (Req 9.1, 9.2).
  const contextual = !!preSelectedLanzamientoId;

  const { authenticatedUser } = useAuth();
  const coordinadorId = authenticatedUser?.id ?? null;
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"selection" | "review">(contextual ? "review" : "selection");

  const [convocatorias, setConvocatorias] = useState<ConvAgg[]>([]); // Convocatorias agrupadas
  const [selectedConvocatorias, setSelectedConvocatorias] = useState<Set<string>>(new Set());
  const [studentsForReview, setStudentsForReview] = useState<StudentForReview[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );

  // ── Estado del flujo de aseguramiento (sólo modo contextual) ────────────────
  // Progreso de pasos 1–3 en sesión (no persiste — Req 4.2). El paso 4 sí persiste.
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  // Marca persistida del lanzamiento (seguro_gestionado_at). null = pendiente.
  const [seguroGestionadoAt, setSeguroGestionadoAt] = useState<string | null>(null);
  const [isMarcando, setIsMarcando] = useState(false);

  const markStepDone = useCallback((n: number) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      next.add(n);
      return next;
    });
  }, []);

  // --- PASO 1: Cargar Convocatorias ---
  const handleFetchConvocatorias = useCallback(async (): Promise<ConvAgg[]> => {
    setIsLoading(true);
    setLoadingMessage("Cargando convocatorias...");
    setConvocatorias([]);

    if (isTestingMode) {
      const mock = [
        {
          id: "mock_conv_1",
          createdTime: "",
          [FIELD_NOMBRE_PPS_CONVOCATORIAS]: "Hospital Mock",
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
          [FIELD_FECHA_INICIO_CONVOCATORIAS]: "2024-01-01",
          [FIELD_FECHA_FIN_CONVOCATORIAS]: "2024-06-01",
          [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: "student_1",
        } as unknown as ConvAgg,
      ];
      setConvocatorias(mock);
      setIsLoading(false);
      return mock;
    }

    try {
      // Fetch Convocatorias, Lanzamientos and Instituciones
      const [records, lanzamientoRes] = await Promise.all([
        db.convocatorias.getAll({
          filters: { [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado" },
          sort: [{ field: FIELD_FECHA_INICIO_CONVOCATORIAS, direction: "desc" }],
        }),
        db.lanzamientos.getAll(),
      ]);

      // Fetch instituciones separately to get telefono
      const institucionRes = await db.instituciones.getAll();
      const institucionDataMap = new Map(institucionRes.map((i) => [i.id, i]));

      // Build a quick lookup for telefonos
      const institucionTelefonos: Record<string, string> = {};
      institucionRes.forEach((i) => {
        institucionTelefonos[i.id] = i[FIELD_TELEFONO_INSTITUCIONES] || "";
      });

      const lanzamientoMap = new Map(lanzamientoRes.map((l) => [l.id, l]));
      const groupedConvocatorias = new Map<string, ConvAgg>();

      records.forEach((record) => {
        const lanzId = record[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        const linkedLanzamiento = lanzId ? lanzamientoMap.get(lanzId) : undefined;

        // Priority: Convocatoria Field -> Lanzamiento Field -> Fallback
        const name =
          record[FIELD_NOMBRE_PPS_CONVOCATORIAS] ||
          linkedLanzamiento?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] ||
          "Sin Nombre";
        const date =
          record[FIELD_FECHA_INICIO_CONVOCATORIAS] ||
          linkedLanzamiento?.[FIELD_FECHA_INICIO_LANZAMIENTOS] ||
          "N/A";

        // Usamos el ID de lanzamiento como clave primaria si existe, sino fallback
        const key = lanzId || `${name}||${date}`;

        if (!groupedConvocatorias.has(key)) {
          groupedConvocatorias.set(key, {
            ...record,
            id: key, // Usamos la key como ID del grupo para la UI
            [FIELD_NOMBRE_PPS_CONVOCATORIAS]: name, // Ensure name is filled
            [FIELD_FECHA_INICIO_CONVOCATORIAS]: date, // Ensure date is filled
            [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: [], // Array for aggregated students
            [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzId,
          });
        }

        const group = groupedConvocatorias.get(key)!;
        const studentId = record[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];

        if (studentId) {
          const currentStudents =
            (group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string[]) || [];
          if (!currentStudents.includes(studentId)) {
            currentStudents.push(studentId);
            group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] = currentStudents;
          }
        }
      });

      const finalConvocatorias = Array.from(groupedConvocatorias.values())
        .sort((a, b) => {
          const dateA = new Date(a[FIELD_FECHA_INICIO_CONVOCATORIAS] || "1900-01-01").getTime();
          const dateB = new Date(b[FIELD_FECHA_INICIO_CONVOCATORIAS] || "1900-01-01").getTime();
          return dateB - dateA;
        })
        .slice(0, 20);

      setConvocatorias(finalConvocatorias);
      return finalConvocatorias;
    } catch (error) {
      showModal(
        "Error de Carga",
        `No se pudieron cargar las convocatorias: ${getErrorMessage(error)}`
      );
      return [];
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  }, [isTestingMode, showModal]);

  useEffect(() => {
    handleFetchConvocatorias().then((loaded) => {
      // Si venimos de cerrar una mesa, pre-seleccionar y compilar directo.
      if (preSelectedLanzamientoId) {
        const sel = new Set([preSelectedLanzamientoId]);
        setSelectedConvocatorias(sel);
        // Pasamos la lista recién cargada para evitar leer estado obsoleto.
        handleProceedToReview(sel, loaded);
      }
    });
    // Auto-proceso de montaje: debe correr al cargar / cambiar el lanzamiento
    // pre-seleccionado, no ante cambios de identidad de handleProceedToReview
    // (re-ejecutarlo dispararía un re-fetch y re-compilación duplicados).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleFetchConvocatorias, preSelectedLanzamientoId]);

  // Cargar la marca persistida (seguro_gestionado_at) del lanzamiento de contexto.
  // Si ya está asegurado, el generador muestra el estado "asegurado" + reversión
  // en lugar del flujo pendiente (Req 9.10).
  useEffect(() => {
    if (!preSelectedLanzamientoId || isTestingMode) return;
    let cancel = false;
    (async () => {
      try {
        const launches = await db.lanzamientos.get({
          filters: { id: preSelectedLanzamientoId },
          maxRecords: 1,
        });
        if (cancel) return;
        const launch = launches[0];
        const at = (launch?.[FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS] as string | null) ?? null;
        setSeguroGestionadoAt(at);
      } catch (e) {
        logger.warn("No se pudo leer seguro_gestionado_at del lanzamiento", e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [preSelectedLanzamientoId, isTestingMode]);

  // --- PASO 2: Procesar Datos ---
  const handleProceedToReview = async (
    overrideSelection?: Set<string>,
    overrideConvocatorias?: ConvAgg[]
  ) => {
    const selectionToUse = overrideSelection || selectedConvocatorias;
    const convocatoriasToUse = overrideConvocatorias || convocatorias;

    setIsLoading(true);
    setLoadingMessage("Procesando estudiantes...");

    if (isTestingMode) {
      setStudentsForReview([
        {
          studentId: "s1",
          nombre: "Juan",
          apellido: "Test",
          dni: "123",
          legajo: "111",
          correo: "j@t.com",
          telefono: "111",
          institucion: "Hosp Test",
          institucionTelefono: "2999999999",
          direccion: "Calle 1",
          periodo: "Ene-Jun",
          horario: "9-18",
          cargo: "Estudiante",
          lugarCompleto: "Hosp Test - Calle 1",
          duracionCompleta: "Periodo: Ene-Jun. Horario: 9-18",
          tutor: "Tutor 1",
          orientacion: "Clínica",
        },
      ]);
      setStep("review");
      setIsLoading(false);
      return;
    }

    // Filter convocatorias based on selection ID
    const selectedGroups = convocatoriasToUse.filter((c) => selectionToUse.has(c.id));

    const studentIds = new Set<string>();

    selectedGroups.forEach((group) => {
      ((group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string[]) || []).forEach((id) =>
        studentIds.add(id)
      );
    });

    if (studentIds.size === 0) {
      // Si se llamó automáticamente pero no se encontraron estudiantes (raro pero posible si falló carga), no avanzar
      if (!overrideSelection)
        showModal("Sin Estudiantes", "No hay estudiantes en las convocatorias seleccionadas.");
      setIsLoading(false);
      return;
    }

    try {
      const [estudiantesRes, lanzamientosRes, convocatoriasRes] = await Promise.all([
        db.estudiantes.getAll(),
        db.lanzamientos.getAll(),
        db.convocatorias.getAll(),
      ]);

      const studentMap = new Map(estudiantesRes.map((r) => [r.id, r]));
      const lanzamientoMap = new Map(lanzamientosRes.map((r) => [r.id, r]));

      // Map studentID-launchID to specific fields like 'Horario'
      const convMap = new Map<string, any>();
      convocatoriasRes.forEach((c) => {
        const sId = c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
        const lId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];

        if (sId && lId) convMap.set(`${sId}-${lId}`, c);
      });

      const compiledList: StudentForReview[] = [];
      const institucionTelefonos: Record<string, string> = {};

      for (const group of selectedGroups) {
        const groupLanzamientoId = group[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        const ppsData = groupLanzamientoId ? lanzamientoMap.get(groupLanzamientoId) : undefined;
        const groupStudents = (group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string[]) || [];

        for (const sId of groupStudents) {
          const student = studentMap.get(sId);
          if (!student) continue;

          const specificConv = convMap.get(`${sId}-${groupLanzamientoId}`);

          const institucion =
            ppsData?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] ||
            group[FIELD_NOMBRE_PPS_CONVOCATORIAS] ||
            "N/A";

          // Get telefono de la institución
          const institucionId = ppsData?.[FIELD_INSTITUCION_LINK_PRACTICAS];
          const institucionTelefono = institucionId
            ? institucionTelefonos[institucionId] || ""
            : "";

          const direccion =
            ppsData?.[FIELD_DIRECCION_LANZAMIENTOS] || group[FIELD_DIRECCION_CONVOCATORIAS] || "";
          const fechaInicio =
            ppsData?.[FIELD_FECHA_INICIO_LANZAMIENTOS] || group[FIELD_FECHA_INICIO_CONVOCATORIAS];
          const fechaFin =
            ppsData?.[FIELD_FECHA_FIN_LANZAMIENTOS] || group[FIELD_FECHA_FIN_CONVOCATORIAS];

          // Logic for schedules: Priority order:
          // 1. horario_asignado (el horario final asignado por el admin)
          // 2. Si es fixed: usar horario del lanzamiento
          // 3. Si no es fixed: usar horario_seleccionado del estudiante
          // 4. Fallback a horario del lanzamiento o "A definir"
          const isFixed = !!ppsData?.[FIELD_HORARIOS_FIJOS_LANZAMIENTOS];
          const horarioAsignado = specificConv?.[FIELD_HORARIO_ASIGNADO_CONVOCATORIAS];
          const horarioSolicitado = specificConv?.[FIELD_HORARIO_FORMULA_CONVOCATORIAS];
          const horarioLanzamiento = ppsData?.[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS];

          // Si hay horario_asignado, usarlo primero (es el horario final)
          // Sino, usar la lógica anterior
          const horario =
            horarioAsignado ||
            (isFixed
              ? horarioLanzamiento || "A definir"
              : horarioSolicitado || horarioLanzamiento || "A definir");

          const orientacion =
            ppsData?.[FIELD_ORIENTACION_LANZAMIENTOS] ||
            group[FIELD_ORIENTACION_CONVOCATORIAS] ||
            "General";

          const fullName = student[FIELD_NOMBRE_ESTUDIANTES] || "";
          let nombre = String(student[FIELD_NOMBRE_SEPARADO_ESTUDIANTES] ?? "");
          let apellido = String(student[FIELD_APELLIDO_SEPARADO_ESTUDIANTES] ?? "");

          if (!nombre || !apellido) {
            const split = simpleNameSplit(fullName);
            nombre = split.nombre;
            apellido = split.apellido;
          }

          const periodoValue = `Del ${formatDate(fechaInicio)} al ${formatDate(fechaFin)}`;

          let tutor = "N/A";
          const normOrientacion = normalizeStringForComparison(orientacion);
          if (normOrientacion.includes("clinica")) tutor = "Selva Estrella";
          else if (normOrientacion.includes("educacional")) tutor = "Franco Pedraza";
          else if (normOrientacion.includes("laboral") || normOrientacion.includes("comunitaria"))
            tutor = "Cynthia Rossi";

          // Formato limpio para lugar y duración
          const lugarCompleto = direccion ? `${institucion} - ${direccion}` : institucion;
          const duracionCompleta = `Período: ${periodoValue}. Horario: ${horario}`;

          compiledList.push({
            studentId: sId,
            nombre,
            apellido,
            dni: String(student[FIELD_DNI_ESTUDIANTES] || "N/A"),
            legajo: String(student[FIELD_LEGAJO_ESTUDIANTES] || "N/A"),
            correo: String(student[FIELD_CORREO_ESTUDIANTES] || "N/A"),
            telefono: formatPhoneNumber(String(student[FIELD_TELEFONO_ESTUDIANTES] || "")),
            institucion,
            institucionTelefono: "",
            direccion,
            periodo: periodoValue,
            horario,
            // CAMPOS ESPECÍFICOS PARA SEGURO ART (Requerimiento del usuario)
            cargo: "Estudiante",
            lugarCompleto,
            duracionCompleta,
            tutor,
            orientacion,
          });
        }
      }

      setStudentsForReview(compiledList);
      setStep("review");
    } catch (e) {
      logger.error(e);
      showModal("Error", "Ocurrió un error al procesar los datos.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // --- Generar Excel (Lista Institución) ---
  // Devuelve true si la descarga del listado se generó con éxito (Req 9.8: el
  // cierre del aseguramiento sólo ocurre con descarga exitosa).
  const handleGenerateSelectionExcel = async (): Promise<boolean> => {
    if (studentsForReview.length === 0) return false;

    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      const studentsByInstitution = studentsForReview.reduce(
        (acc, student) => {
          const key = student.institucion;
          if (!acc[key]) acc[key] = [];
          acc[key].push(student);
          return acc;
        },
        {} as Record<string, StudentForReview[]>
      );

      for (const institucion in studentsByInstitution) {
        const group = studentsByInstitution[institucion];
        const baseSheetName = institucion.replace(/[\\/?*[\]]/g, "").substring(0, 25) || "PPS";
        const worksheet = workbook.addWorksheet(baseSheetName);

        // Verificar si todos los estudiantes del grupo tienen el mismo horario
        const uniqueHorarios = new Set(group.map((s) => s.horario).filter(Boolean));
        const hasSingleSchedule = uniqueHorarios.size <= 1;

        // Definir columnas según si hay un solo horario o varios
        const columns = [
          { header: "APELLIDO", key: "apellido", width: 25 },
          { header: "NOMBRE", key: "nombre", width: 25 },
          { header: "DNI", key: "dni", width: 15 },
          { header: "LEGAJO", key: "legajo", width: 15 },
          { header: "CORREO", key: "correo", width: 30 },
          { header: "TELEFONO", key: "telefono", width: 20 },
        ];

        // Solo agregar columna de horario si hay varios horarios diferentes
        if (!hasSingleSchedule) {
          columns.push({ header: "HORARIO", key: "horario", width: 30 });
        }

        worksheet.columns = columns;

        // Preparar datos según las columnas (excluyendo horario si es único)
        const rows = hasSingleSchedule
          ? group.map((s) => ({
              apellido: s.apellido,
              nombre: s.nombre,
              dni: s.dni,
              legajo: s.legajo,
              correo: s.correo,
              telefono: s.telefono,
            }))
          : group;

        worksheet.addRows(rows);

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9E2F3" },
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const fechaHoy = new Date().toISOString().split("T")[0];

      // Generar nombre de archivo según la cantidad de instituciones
      const instituciones = Object.keys(studentsByInstitution);
      let nombreArchivo: string;

      if (instituciones.length === 1) {
        // Si hay una sola institución, usar su nombre
        const nombreInstitucion = instituciones[0].replace(/[\\/?*[\]]/g, "").substring(0, 50);
        nombreArchivo = `Listado_${nombreInstitucion}_${fechaHoy}.xlsx`;
      } else if (instituciones.length <= 3) {
        // Si hay 2-3 instituciones, incluir los nombres truncados
        const nombresInstituciones = instituciones
          .map((inst) => inst.replace(/[\\/?*[\]]/g, "").substring(0, 15))
          .join("_");
        nombreArchivo = `Listado_${nombresInstituciones}_${fechaHoy}.xlsx`;
      } else {
        // Si hay más de 3, usar "General" o "Multiple"
        nombreArchivo = `Listado_General_${fechaHoy}.xlsx`;
      }

      downloadBlob(blob, nombreArchivo);

      setToastInfo({ message: "Excel generado correctamente.", type: "success" });
      return true;
    } catch (e) {
      logger.error("Error generating Excel:", e);
      showModal("Error", "No se pudo generar el Excel: " + getErrorMessage(e));
      return false;
    }
  };

  // --- Descargar Plantilla de Seguro ---
  const handleDownloadTemplate = async (institutionName: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage("Descargando plantilla de Supabase...");

      const { data, error } = await supabase.storage
        .from("documentos_seguros")
        .download("Seguro (2).xlsx");

      const fechaHoy = new Date().toISOString().split("T")[0];

      if (error) {
        logger.warn("Error downloading specific file, trying alternative...", error);
        // Fallback attempt if name is slightly different
        const { data: altData, error: altError } = await supabase.storage
          .from("documentos_seguros")
          .download("Seguro.xlsx");

        if (altError) throw altError;
        if (!altData) throw new Error("No se encontró la plantilla en el servidor.");

        const cleanName = institutionName.replace(/[\\/?*[\]]/g, "").substring(0, 50);
        downloadBlob(altData, `Seguro - ${cleanName} - ${fechaHoy}.xlsx`);
      } else {
        if (!data) throw new Error("El archivo descargado está vacío.");
        const cleanName = institutionName.replace(/[\\/?*[\]]/g, "").substring(0, 50);
        downloadBlob(data, `Seguro - ${cleanName} - ${fechaHoy}.xlsx`);
      }

      setToastInfo({ message: "Plantilla descargada. Ahora copia los datos.", type: "success" });
    } catch (e) {
      logger.error("Error detallado descarga:", e);
      let errorMessage = "Error desconocido al descargar la plantilla.";
      const o = e as { message?: string; error_description?: string; error?: unknown };
      if (o?.message) errorMessage = o.message;
      else if (o?.error_description) errorMessage = o.error_description;
      else if (o?.error)
        errorMessage = typeof o.error === "string" ? o.error : JSON.stringify(o.error);

      showModal(
        "Error de Descarga",
        `No se pudo descargar la plantilla.\n\nDetalle: ${errorMessage}`
      );
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // --- Copiar al Portapapeles ---
  const handleCopyToClipboard = (students: StudentForReview[]) => {
    // Formato TSV de 7 campos por estudiante (Req 9.6) — fuente única de verdad.
    const text = buildClipboardText(students);

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setToastInfo({
          message: `${students.length} filas copiadas. Pegar en el Excel de Seguro (celda A2).`,
          type: "success",
        });
      })
      .catch((err) => {
        logger.error("Failed to copy", err);
        setToastInfo({ message: "Error al copiar los datos.", type: "error" });
      });
  };

  // --- Enviar a Administración (Step 3) ---
  const handleSendToAdmin = (institutionName: string) => {
    const subject = `Reporte de Seguro - ${institutionName}`;
    const body = `Hola Sergio,\n\nTe adjunto el seguro de la PPS.\n\nSaludos.`;
    const mailto = `mailto:mesadeayuda.patagonia@uflouniversidad.edu.ar?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.open(mailto, "_blank");
    setToastInfo({
      message: "Ventana de correo abierta. Adjunta el Excel generado.",
      type: "success",
    });
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedConvocatorias);
    newSelection.has(id) ? newSelection.delete(id) : newSelection.add(id);
    setSelectedConvocatorias(newSelection);
  };

  // ── Encabezado y datos del flujo contextual (Req 9.4) ───────────────────────
  const primaryInstitution = studentsForReview[0]?.institucion ?? "Sin institución";
  const headerFecha = studentsForReview[0]?.periodo ?? null;
  const totalSeleccionados = studentsForReview.length;

  // ── Handlers de los 4 pasos (modo contextual) ───────────────────────────────
  const handleStepDescargarSeguro = async () => {
    await handleDownloadTemplate(primaryInstitution);
    markStepDone(1);
  };

  const handleStepCopiarDatos = () => {
    handleCopyToClipboard(studentsForReview);
    markStepDone(2);
  };

  const handleStepEnviarSergio = () => {
    handleSendToAdmin(primaryInstitution);
    markStepDone(3);
  };

  // Paso 4 (cierre): descarga el listado y, si tiene éxito, persiste la marca de
  // aseguramiento. Si la persistencia falla, NO marca el paso ni invalida queries:
  // el lanzamiento permanece en "A asegurar" (Req 1.5, 9.8).
  const handleStepDescargarLista = async () => {
    if (totalSeleccionados === 0 || !preSelectedLanzamientoId) return;
    setIsMarcando(true);
    try {
      const ok = await handleGenerateSelectionExcel();
      if (!ok) return; // la generación falló → no cerrar el aseguramiento

      try {
        await marcarAseguramiento(preSelectedLanzamientoId, coordinadorId);
      } catch (e) {
        logger.error("Error al persistir aseguramiento:", e);
        showModal(
          "No se pudo registrar el aseguramiento",
          `El listado se descargó, pero no se pudo marcar el seguro como gestionado.\n\nDetalle: ${getErrorMessage(
            e
          )}\n\nLa PPS permanece en "A asegurar". Reintentá el paso 4.`
        );
        return;
      }

      // Éxito: reflejar el estado "asegurado" y refrescar el Lanzador.
      markStepDone(4);
      setSeguroGestionadoAt(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
      queryClient.invalidateQueries({ queryKey: ["convStatusByLaunch"] });
      queryClient.invalidateQueries({ queryKey: ["inscCountByLaunch"] });
      setToastInfo({ message: "Seguro gestionado. La PPS pasó a Activas.", type: "success" });
    } finally {
      setIsMarcando(false);
    }
  };

  // ── Reversión del aseguramiento (Req 5.x, 9.10) ─────────────────────────────
  const handleRevertir = async () => {
    if (!preSelectedLanzamientoId) return;
    const confirmed = window.confirm(
      '¿Revertir el aseguramiento? La PPS volverá a aparecer en "A asegurar".'
    );
    if (!confirmed) return;

    setIsMarcando(true);
    try {
      await revertirAseguramiento(preSelectedLanzamientoId, coordinadorId);
      setSeguroGestionadoAt(null);
      setDoneSteps(new Set());
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
      queryClient.invalidateQueries({ queryKey: ["convStatusByLaunch"] });
      queryClient.invalidateQueries({ queryKey: ["inscCountByLaunch"] });
      setToastInfo({ message: "Aseguramiento revertido.", type: "success" });
    } catch (e) {
      logger.error("Error al revertir aseguramiento:", e);
      showModal("Error", `No se pudo revertir el aseguramiento.\n\nDetalle: ${getErrorMessage(e)}`);
    } finally {
      setIsMarcando(false);
    }
  };

  // ── Definición declarativa de los 4 pasos (Req 9.3) ─────────────────────────
  const flowSteps = [
    {
      n: 1,
      title: "Descargar seguro",
      desc: "Descargá la plantilla de seguro de la institución.",
      icon: "download",
      onRun: handleStepDescargarSeguro,
      disabled: false,
    },
    {
      n: 2,
      title: "Copiar datos",
      desc: "Copiá los datos de los seleccionados al portapapeles.",
      icon: "content_copy",
      onRun: handleStepCopiarDatos,
      disabled: totalSeleccionados === 0,
    },
    {
      n: 3,
      title: "Enviar a Sergio",
      desc: "Abrí el correo a administración para enviar el seguro.",
      icon: "send",
      onRun: handleStepEnviarSergio,
      disabled: false,
    },
    {
      n: 4,
      title: "Descargar lista",
      desc: "Descargá el listado para las instituciones. Cierra el aseguramiento.",
      icon: "table_view",
      onRun: handleStepDescargarLista,
      // El paso final requiere al menos un seleccionado (Req 1.2, 1.3).
      disabled: totalSeleccionados === 0 || isMarcando,
      final: true,
    },
  ];

  // ── Render del flujo contextual de 4 pasos (Paper & Ink) ────────────────────
  const renderContextualFlow = () => {
    if (isLoading && studentsForReview.length === 0) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader />
        </div>
      );
    }

    // Estado "ya asegurado": en vez del flujo pendiente, mostrar fecha + Revertir.
    if (seguroGestionadoAt) {
      return (
        <div className="seg-done" role="status">
          <span className="seg-done-icon">
            <span className="material-icons">verified</span>
          </span>
          <div className="seg-done-body">
            <div className="seg-done-title">Seguro gestionado</div>
            <div className="seg-done-sub">
              Gestionado el {formatDate(seguroGestionadoAt)}. La PPS figura en “Activas”.
            </div>
            <div style={{ marginTop: 14 }}>
              <button onClick={handleRevertir} disabled={isMarcando} className="seg-btn">
                <span className="material-icons">undo</span>
                Revertir aseguramiento
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (studentsForReview.length === 0) {
      return (
        <EmptyState
          icon="group_off"
          title="Sin seleccionados"
          message="Esta PPS todavía no tiene estudiantes seleccionados para asegurar."
        />
      );
    }

    return (
      <div>
        <div className="seg-flowhead">
          <span className="eyebrow">Aseguramiento · PPS</span>
          <div className="seg-flowhead-name">{primaryInstitution}</div>
          <div className="seg-flowhead-meta">
            {headerFecha && (
              <span className="seg-meta-chip">
                <span className="material-icons">event</span>
                {headerFecha}
              </span>
            )}
            <span className="seg-meta-chip">
              <span className="material-icons">group</span>
              {totalSeleccionados} seleccionado{totalSeleccionados !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="seg-steplist">
          {flowSteps.map((s) => {
            const done = doneSteps.has(s.n);
            return (
              <div
                key={s.n}
                className="seg-steprow"
                data-done={done ? "1" : "0"}
                data-final={s.final ? "1" : "0"}
              >
                <span className="seg-stepdot">
                  {done ? <span className="material-icons">check</span> : s.n}
                </span>
                <div className="seg-stepbody">
                  <div className="seg-steptitle">
                    {s.title}
                    {s.final && <span className="seg-steptag">Cierra</span>}
                  </div>
                  <div className="seg-stepdesc">{s.desc}</div>
                </div>
                <button
                  onClick={s.onRun}
                  disabled={s.disabled}
                  className={`seg-btn ${s.final ? "seg-btn-primary" : ""}`}
                  aria-label={`${s.title}${done ? " (rehacer)" : ""}`}
                >
                  <span className="material-icons">{s.icon}</span>
                  {done ? "Rehacer" : "Ejecutar"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSelectionStep = () => (
    <div>
      <div className="seg-steps">
        <span className="seg-step" data-on="1">
          <b>1</b> Seleccionar convocatorias
        </span>
        <span className="seg-step-line" />
        <span className="seg-step" data-on="0">
          <b>2</b> Generar documentación
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader />
        </div>
      ) : convocatorias.length === 0 ? (
        <EmptyState
          icon="event_busy"
          title="Sin convocatorias"
          message="No se encontraron convocatorias recientes con alumnos seleccionados."
        />
      ) : (
        <div className="seg-panel" style={{ overflowX: "auto" }}>
          <table className="seg-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <span className="sr-only">Seleccionar</span>
                </th>
                <th>Institución (lanzamiento)</th>
                <th style={{ textAlign: "center" }}>Alumnos</th>
                <th>Fecha inicio</th>
              </tr>
            </thead>
            <tbody>
              {convocatorias.map((conv) => {
                const sel = selectedConvocatorias.has(conv.id);
                return (
                  <tr
                    key={conv.id}
                    data-sel={sel ? "1" : "0"}
                    onClick={() => toggleSelection(conv.id)}
                  >
                    <td>
                      <span className="seg-check" data-on={sel ? "1" : "0"}>
                        {sel && <span className="material-icons">check</span>}
                      </span>
                    </td>
                    <td className="name">{conv[FIELD_NOMBRE_PPS_CONVOCATORIAS]}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="seg-count">
                        {conv[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]?.length || 0}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-3)" }}>
                      {formatDate(conv[FIELD_FECHA_INICIO_CONVOCATORIAS])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <button
          onClick={() => handleProceedToReview()}
          disabled={selectedConvocatorias.size === 0 || isLoading}
          className="seg-btn seg-btn-primary"
        >
          Continuar
          <span className="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>
  );

  const renderReviewStep = () => {
    const grouped = studentsForReview.reduce(
      (acc, curr) => {
        if (!acc[curr.institucion]) acc[curr.institucion] = [];
        acc[curr.institucion].push(curr);
        return acc;
      },
      {} as Record<string, StudentForReview[]>
    );

    return (
      <div>
        <div className="seg-steps">
          <span className="seg-step" data-on="0">
            <b>1</b> Seleccionar convocatorias
          </span>
          <span className="seg-step-line" />
          <span className="seg-step" data-on="1">
            <b>2</b> Generar documentación
          </span>
          <button
            onClick={() => setStep("selection")}
            className="seg-link"
            style={{ marginLeft: "auto" }}
          >
            <span className="material-icons">arrow_back</span> Volver
          </button>
        </div>

        {Object.entries(grouped).map(
          ([institucion, students]: [string, StudentForReview[]], idx) => (
            <div key={idx} className="seg-inst">
              <div className="seg-inst-head">
                <span className="seg-inst-name">{institucion}</span>
                <span className="seg-inst-count">{students.length} alumnos asignados</span>
              </div>

              <div className="seg-actions">
                <button
                  onClick={() => handleDownloadTemplate(institucion)}
                  disabled={isLoading}
                  className="seg-btn"
                >
                  <span className="seg-num">1</span>
                  <span className="material-icons">download</span>
                  Plantilla
                </button>
                <button onClick={() => handleCopyToClipboard(students)} className="seg-btn">
                  <span className="seg-num">2</span>
                  <span className="material-icons">content_copy</span>
                  Copiar datos
                </button>
                <button onClick={() => handleSendToAdmin(institucion)} className="seg-btn">
                  <span className="seg-num">3</span>
                  <span className="material-icons">send</span>
                  Enviar a Sergio
                </button>
              </div>

              <details className="seg-disclosure">
                <summary>
                  <span className="material-icons">chevron_right</span>
                  Ver lista de alumnos ({students.length})
                </summary>
                <div className="seg-stud-list">
                  {students.map((s) => (
                    <div key={s.studentId} className="seg-stud">
                      <b>
                        {s.apellido}, {s.nombre}
                      </b>
                      <span>DNI {s.dni}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )
        )}

        <div className="seg-foot">
          <button onClick={handleGenerateSelectionExcel} className="seg-btn seg-btn-primary">
            <span className="material-icons">table_view</span>
            Descargar Excel
          </button>
          {Object.keys(grouped).length === 1 &&
            (() => {
              const firstInstitution = studentsForReview[0];
              const telefono = firstInstitution?.institucionTelefono;
              if (telefono) {
                const cleanPhone = telefono.replace(/\D/g, "");
                const whatsappUrl = `https://wa.me/${cleanPhone}`;
                return (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="seg-btn seg-btn-wa"
                  >
                    <span className="material-icons">chat</span>
                    Enviar por WhatsApp
                  </a>
                );
              }
              return null;
            })()}
        </div>
      </div>
    );
  };

  return (
    <div className="seg">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <div className="seg-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="eyebrow">Documentos · seguros</span>
          <h2 className="serif">Generador de seguros</h2>
          <p>
            {contextual
              ? "Seguí los 4 pasos para gestionar el seguro de esta PPS. El paso 4 cierra el aseguramiento."
              : "Armá la planilla de seguro con los alumnos seleccionados de una o varias convocatorias, lista para enviar a administración."}
          </p>
        </div>
        <span className="seg-chip-ai" style={{ marginTop: 6 }}>
          <span className="material-icons">auto_awesome</span>
          Hermes asiste
        </span>
      </div>

      {contextual
        ? renderContextualFlow()
        : step === "selection"
          ? renderSelectionStep()
          : renderReviewStep()}
    </div>
  );
};

export default SeguroGenerator;
