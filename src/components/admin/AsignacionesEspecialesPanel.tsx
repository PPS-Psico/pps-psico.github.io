import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "../../hooks/useConfirm";
import { supabase } from "../../lib/supabaseClient";
import {
  FIELD_ACADEMIC_YEAR_SPECIAL_PPS,
  FIELD_ACTIVITY_TYPE_SPECIAL_PPS,
  FIELD_ENABLED_SPECIAL_PPS,
  FIELD_ORIENTATION_KEY_SPECIAL_PPS,
  FIELD_STATUS_SPECIAL_PPS,
  TABLE_AULA_ENTREGAS,
  TABLE_ESTUDIANTES,
  TABLE_SPECIAL_PPS_ASSIGNMENTS,
  TABLE_SPECIAL_PPS_TASK_CATALOG,
} from "../../constants";
import type { Database } from "../../types/supabase";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import Loader from "../Loader";
import Toast from "../ui/Toast";

type ActivityType = "relevamiento_profesional" | "entrevistas_profesionales";
type OrientationKey = "clinica" | "laboral" | "comunitaria" | "educacional";
type TaskOrientationKey = "clinica" | "laboral_comunitaria" | "educacional";

type StudentRow = Pick<
  Database["public"]["Tables"]["estudiantes"]["Row"],
  "correo" | "estado" | "id" | "legajo" | "nombre"
>;

type TaskRow = Pick<
  Database["public"]["Tables"]["aula_entregas"]["Row"],
  "academic_year" | "activo" | "area" | "id" | "institucion" | "moodle_id" | "moodle_name"
>;

type CatalogBase = Database["public"]["Tables"]["special_pps_task_catalog"]["Row"];
type AssignmentBase = Database["public"]["Tables"]["special_pps_assignments"]["Row"];

interface CatalogRow extends CatalogBase {
  aula_entregas: TaskRow | null;
}

interface AssignmentRow extends AssignmentBase {
  estudiantes: Pick<StudentRow, "legajo" | "nombre"> | null;
  practicas: Pick<Database["public"]["Tables"]["practicas"]["Row"], "estado" | "nota"> | null;
  special_pps_task_catalog: {
    aula_entregas: Pick<TaskRow, "moodle_id" | "institucion"> | null;
  } | null;
}

interface AsignacionesEspecialesPanelProps {
  isTestingMode?: boolean;
}

const ACTIVITIES: Array<{ id: ActivityType; label: string; shortLabel: string }> = [
  {
    id: "relevamiento_profesional",
    label: "Relevamiento del Ejercicio Profesional en Psicología",
    shortLabel: "Relevamiento profesional",
  },
  {
    id: "entrevistas_profesionales",
    label: "Entrevistas a Profesionales",
    shortLabel: "Entrevistas profesionales",
  },
];

const ORIENTATIONS: Array<{ id: OrientationKey; label: string }> = [
  { id: "clinica", label: "Clínica" },
  { id: "laboral", label: "Laboral" },
  { id: "comunitaria", label: "Comunitaria" },
  { id: "educacional", label: "Educacional" },
];

const TASK_ORIENTATIONS: Array<{
  id: TaskOrientationKey;
  label: string;
  areas: Array<"clinica" | "laboral" | "comunitaria" | "educacional">;
}> = [
  { id: "clinica", label: "Clínica", areas: ["clinica"] },
  {
    id: "laboral_comunitaria",
    label: "Laboral / Comunitaria",
    areas: ["laboral", "comunitaria"],
  },
  { id: "educacional", label: "Educacional", areas: ["educacional"] },
];

const CSS = `
.sa-shell { max-width: 1060px; margin: 0 auto; color: var(--ink); }
.sa-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--rule-2); margin-bottom: 28px; }
.sa-tab { border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--ink-3); padding: 11px 14px 10px; font: 700 11px/1.2 'Manrope', 'Hanken Grotesk', system-ui, sans-serif; cursor: pointer; }
.sa-tab:hover { color: var(--ink); }
.sa-tab[aria-selected='true'] { color: var(--ink); border-bottom-color: var(--accent); }
.sa-tab:focus-visible, .sa-button:focus-visible, .sa-activity:focus-visible, .sa-result:focus-visible, .sa-config-select:focus-visible, .sa-field input:focus-visible, .sa-field select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sa-layout { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr); gap: 42px; align-items: start; }
.sa-section-title { margin: 0 0 6px; font-size: 22px; line-height: 1.15; letter-spacing: -.025em; }
.sa-section-copy { margin: 0 0 22px; max-width: 66ch; color: var(--ink-3); font-size: 14px; line-height: 1.55; }
.sa-field { display: grid; gap: 7px; margin-bottom: 18px; }
.sa-field > label, .sa-label { color: var(--ink-3); font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.sa-field input, .sa-field select, .sa-config-select { width: 100%; min-height: 42px; border: 1px solid var(--rule-2); border-radius: 9px; background: var(--paper); color: var(--ink); padding: 0 12px; font: 700 11px/1.2 'Manrope', 'Hanken Grotesk', system-ui, sans-serif; }
.sa-field input::placeholder { color: var(--ink-4); }
.sa-activity-list { display: grid; gap: 8px; }
.sa-activity { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 58px; padding: 11px 14px; border: 1px solid var(--rule-2); border-radius: 10px; background: var(--paper); color: var(--ink); text-align: left; cursor: pointer; }
.sa-activity:hover { background: var(--paper-2); }
.sa-activity[data-selected='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.sa-activity strong { display: block; font-size: 14px; }
.sa-activity small { display: block; margin-top: 3px; color: var(--ink-3); font-size: 11px; }
.sa-radio { width: 17px; height: 17px; border: 1px solid var(--rule-3); border-radius: 999px; flex: 0 0 auto; }
.sa-activity[data-selected='true'] .sa-radio { border: 5px solid var(--accent); }
.sa-search-results { margin: -10px 0 18px; border: 1px solid var(--rule-2); border-radius: 9px; overflow: hidden; }
.sa-result { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 0; border-bottom: 1px solid var(--rule-2); background: var(--paper); color: var(--ink); padding: 11px 12px; text-align: left; cursor: pointer; }
.sa-result:last-child { border-bottom: 0; }
.sa-result:hover { background: var(--paper-2); }
.sa-result strong { display: block; font-size: 11px; }
.sa-result small { color: var(--ink-3); font: 600 10px/1.2 'JetBrains Mono', monospace; }
.sa-selected-student { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: -8px 0 18px; padding: 12px 0; border-top: 1px solid var(--rule-2); border-bottom: 1px solid var(--rule-2); }
.sa-selected-student strong { display: block; font-size: 14px; }
.sa-selected-student small { color: var(--ink-3); font: 600 10px/1.2 'JetBrains Mono', monospace; }
.sa-text-action { border: 0; background: transparent; color: var(--accent); font: 750 11px/1.2 inherit; cursor: pointer; padding: 5px; }
.sa-summary { border-top: 1px solid var(--rule-2); border-bottom: 1px solid var(--rule-2); padding: 18px 0; margin-top: 24px; }
.sa-summary-row { display: grid; grid-template-columns: 120px 1fr; gap: 12px; padding: 5px 0; }
.sa-summary-row dt { color: var(--ink-4); font-size: 11px; }
.sa-summary-row dd { margin: 0; color: var(--ink-2); font-size: 11px; font-weight: 650; }
.sa-task-ok, .sa-task-missing { display: flex; gap: 10px; align-items: flex-start; padding: 13px 14px; border-radius: 9px; font-size: 11px; line-height: 1.45; }
.sa-task-ok { color: var(--ok); background: var(--ok-soft); }
.sa-task-missing { color: var(--warn); background: var(--warn-soft); }
.sa-task-ok .material-icons, .sa-task-missing .material-icons { font-size: 22px; }
.sa-button { min-height: 38px; border: 1px solid var(--ink); border-radius: 9px; background: var(--ink); color: var(--paper); padding: 0 14px; font: 750 10px/1.2 'Manrope', 'Hanken Grotesk', system-ui, sans-serif; cursor: pointer; }
.sa-button:hover { opacity: .82; }
.sa-button:disabled { cursor: not-allowed; opacity: .42; }
.sa-button--quiet { border-color: var(--rule-2); background: transparent; color: var(--ink-2); }
.sa-actions { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
.sa-ledger { border-top: 1px solid var(--rule-2); }
.sa-ledger-head, .sa-ledger-row { display: grid; grid-template-columns: minmax(210px, 1.4fr) 1fr 92px 36px; gap: 16px; align-items: center; }
.sa-ledger-head { padding: 9px 12px; color: var(--ink-4); font: 800 9px/1.2 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; }
.sa-ledger-row { min-height: 72px; padding: 12px; border-top: 1px solid var(--rule-2); }
.sa-ledger-row strong { display: block; font-size: 11px; }
.sa-ledger-row small { display: block; margin-top: 4px; color: var(--ink-3); font-size: 10px; }
.sa-state { color: var(--ink-2); font-size: 11px; }
.sa-state code { display: block; margin-top: 4px; color: var(--ink-4); font: 600 10px/1.2 'JetBrains Mono', monospace; }
.sa-cancel { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid var(--rule-2); border-radius: 9px; background: transparent; color: var(--ink-3); cursor: pointer; }
.sa-cancel:hover { color: var(--warn); border-color: var(--warn); }
.sa-empty { padding: 34px 12px; border-top: 1px solid var(--rule-2); color: var(--ink-3); text-align: center; font-size: 11px; }
.sa-config-grid { border-top: 1px solid var(--rule-2); }
.sa-config-row { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(250px, 1.2fr) 92px; gap: 18px; align-items: center; min-height: 72px; border-bottom: 1px solid var(--rule-2); padding: 12px 0; }
.sa-config-row strong { display: block; font-size: 11px; }
.sa-config-row small { display: block; margin-top: 4px; color: var(--ink-3); font-size: 10px; }
.sa-config-note { margin: 18px 0 0; padding: 14px 16px; border: 1px solid var(--rule-2); color: var(--ink-3); font-size: 11px; line-height: 1.55; }
@media (max-width: 820px) {
  .sa-layout { grid-template-columns: 1fr; gap: 34px; }
  .sa-ledger-head { display: none; }
  .sa-ledger-row { grid-template-columns: 1fr 36px; gap: 10px; }
  .sa-ledger-row > :nth-child(2), .sa-ledger-row > :nth-child(3) { grid-column: 1; }
  .sa-cancel { grid-column: 2; grid-row: 1; }
  .sa-config-row { grid-template-columns: 1fr; gap: 10px; padding: 18px 0; }
}
`;

injectScopedStyles("special-pps-assignments", CSS);

function activityLabel(value: ActivityType): string {
  return ACTIVITIES.find((activity) => activity.id === value)?.shortLabel ?? value;
}

function orientationLabel(value: OrientationKey): string {
  return ORIENTATIONS.find((orientation) => orientation.id === value)?.label ?? value;
}

function taskOrientationFor(value: OrientationKey): TaskOrientationKey {
  return value === "laboral" || value === "comunitaria" ? "laboral_comunitaria" : value;
}

function taskMatchesActivity(task: TaskRow, activity: ActivityType): boolean {
  const name = `${task.moodle_name ?? ""} ${task.institucion}`;
  return activity === "relevamiento_profesional"
    ? /relevamiento/i.test(name)
    : /entrevistas?\s+a\s+profesionales/i.test(name);
}

const AsignacionesEspecialesPanel: React.FC<AsignacionesEspecialesPanelProps> = ({
  isTestingMode = false,
}) => {
  const currentYear = new Date().getFullYear();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [tab, setTab] = useState<"assign" | "tasks">("assign");
  const [year, setYear] = useState(currentYear);
  const [activity, setActivity] = useState<ActivityType>("relevamiento_profesional");
  const [orientation, setOrientation] = useState<OrientationKey>("clinica");
  const [hours, setHours] = useState(20);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [taskSelections, setTaskSelections] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const { data: students = [], isFetching: isSearchingStudents } = useQuery({
    queryKey: ["special-pps-students", studentSearch],
    enabled: !isTestingMode && studentSearch.trim().length >= 2 && !selectedStudent,
    queryFn: async (): Promise<StudentRow[]> => {
      const term = studentSearch.trim().replace(/[,%()]/g, " ");
      const { data, error } = await supabase
        .from(TABLE_ESTUDIANTES)
        .select("id, nombre, legajo, correo, estado")
        .or(`nombre.ilike.%${term}%,legajo.ilike.%${term}%`)
        .order("nombre")
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: catalog = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: ["special-pps-task-catalog", year],
    enabled: !isTestingMode,
    queryFn: async (): Promise<CatalogRow[]> => {
      const { data, error } = await supabase
        .from(TABLE_SPECIAL_PPS_TASK_CATALOG)
        .select(
          "*, aula_entregas(id, academic_year, activo, area, institucion, moodle_id, moodle_name)"
        )
        .eq(FIELD_ACADEMIC_YEAR_SPECIAL_PPS, year)
        .eq(FIELD_ENABLED_SPECIAL_PPS, true)
        .order(FIELD_ACTIVITY_TYPE_SPECIAL_PPS)
        .order(FIELD_ORIENTATION_KEY_SPECIAL_PPS);
      if (error) throw error;
      return (data ?? []) as unknown as CatalogRow[];
    },
  });

  const { data: annualTasks = [] } = useQuery({
    queryKey: ["special-pps-annual-tasks", year],
    enabled: !isTestingMode && tab === "tasks",
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from(TABLE_AULA_ENTREGAS)
        .select("id, academic_year, activo, area, institucion, moodle_id, moodle_name")
        .eq("course_id", 3615)
        .eq("academic_year", year)
        .eq("activo", true)
        .order("area")
        .order("institucion");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assignments = [], isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ["special-pps-assignments", year],
    enabled: !isTestingMode,
    queryFn: async (): Promise<AssignmentRow[]> => {
      const { data, error } = await supabase
        .from(TABLE_SPECIAL_PPS_ASSIGNMENTS)
        .select(
          "*, estudiantes(nombre, legajo), practicas(estado, nota), special_pps_task_catalog(aula_entregas(moodle_id, institucion))"
        )
        .eq(FIELD_ACADEMIC_YEAR_SPECIAL_PPS, year)
        .eq(FIELD_STATUS_SPECIAL_PPS, "assigned")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentRow[];
    },
  });

  const selectedCatalog = useMemo(
    () =>
      catalog.find(
        (row) =>
          row.activity_type === activity && row.orientation_key === taskOrientationFor(orientation)
      ) ?? null,
    [activity, catalog, orientation]
  );

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) throw new Error("Elegí un estudiante.");
      if (!selectedCatalog) throw new Error("Todavía no está configurada la tarea anual.");
      const { error } = await supabase.rpc("assign_special_pps_v1", {
        p_academic_year: year,
        p_activity_type: activity,
        p_estudiante_id: selectedStudent.id,
        p_expected_hours: hours,
        p_orientation_key: orientation,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setToast({
        message: "PPS asignada. El estudiante ya tiene su tarea exacta en Entregas.",
        type: "success",
      });
      setSelectedStudent(null);
      setStudentSearch("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["special-pps-assignments", year] }),
        queryClient.invalidateQueries({ queryKey: ["practicas"] }),
        queryClient.invalidateQueries({ queryKey: ["lanzamiento_moodle_tareas"] }),
      ]);
    },
    onError: (error) => setToast({ message: getErrorMessage(error), type: "error" }),
  });

  const configureTaskMutation = useMutation({
    mutationFn: async ({
      activityType,
      orientationKey,
      taskId,
    }: {
      activityType: ActivityType;
      orientationKey: TaskOrientationKey;
      taskId: number;
    }) => {
      const { error } = await supabase.rpc("set_special_pps_task_v1", {
        p_academic_year: year,
        p_activity_type: activityType,
        p_aula_entrega_id: taskId,
        p_orientation_key: orientationKey,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setToast({ message: "Tarea anual configurada.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["special-pps-task-catalog", year] });
    },
    onError: (error) => setToast({ message: getErrorMessage(error), type: "error" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ assignmentId, reason }: { assignmentId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("cancel_special_pps_assignment_v1", {
        p_assignment_id: assignmentId,
        p_reason: reason,
      });
      if (error) throw error;
      if (!data) throw new Error("La asignación ya no estaba activa.");
    },
    onSuccess: async () => {
      setToast({
        message: "Asignación cancelada y tarea retirada del estudiante.",
        type: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["special-pps-assignments", year] }),
        queryClient.invalidateQueries({ queryKey: ["practicas"] }),
        queryClient.invalidateQueries({ queryKey: ["lanzamiento_moodle_tareas"] }),
      ]);
    },
    onError: (error) => setToast({ message: getErrorMessage(error), type: "error" }),
  });

  const canAssign =
    Boolean(selectedStudent) && Boolean(selectedCatalog?.aula_entregas?.activo) && hours > 0;

  const requestCancellation = async (row: AssignmentRow) => {
    const reason = window.prompt(
      `Motivo para cancelar la asignación de ${row.estudiantes?.nombre ?? "este estudiante"}:`
    );
    if (!reason?.trim()) return;
    const accepted = await confirm({
      title: "¿Cancelar esta asignación?",
      message:
        "La práctica conservará el registro histórico, pero la tarea dejará de aparecerle al estudiante.",
      confirmText: "Cancelar asignación",
      type: "warning",
    });
    if (accepted) cancelMutation.mutate({ assignmentId: row.id, reason: reason.trim() });
  };

  if (isCatalogLoading && !isTestingMode) return <Loader />;

  return (
    <div className="sa-shell">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sa-tabs" role="tablist" aria-label="Asignaciones especiales">
        <button
          type="button"
          className="sa-tab"
          role="tab"
          aria-selected={tab === "assign"}
          onClick={() => setTab("assign")}
        >
          Asignar estudiantes
        </button>
        <button
          type="button"
          className="sa-tab"
          role="tab"
          aria-selected={tab === "tasks"}
          onClick={() => setTab("tasks")}
        >
          Tareas anuales
        </button>
      </div>

      <div className="sa-field" style={{ maxWidth: 180 }}>
        <label htmlFor="special-pps-year">Año académico</label>
        <select
          id="special-pps-year"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {tab === "assign" ? (
        <>
          <div className="sa-layout">
            <section aria-labelledby="special-assignment-title">
              <h2 id="special-assignment-title" className="sa-section-title">
                Nueva asignación
              </h2>
              <p className="sa-section-copy">
                Crea la práctica especial y la conecta con una única tarea del Campus. No usa
                lanzamiento ni calcula fecha de entrega.
              </p>

              <div className="sa-field">
                <span className="sa-label">Actividad</span>
                <div className="sa-activity-list" role="radiogroup" aria-label="Actividad especial">
                  {ACTIVITIES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={activity === item.id}
                      className="sa-activity"
                      data-selected={activity === item.id}
                      onClick={() => setActivity(item.id)}
                    >
                      <span>
                        <strong>{item.shortLabel}</strong>
                        <small>{item.label}</small>
                      </span>
                      <span className="sa-radio" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>

              <div className="sa-field">
                <label htmlFor="special-pps-orientation">Orientación que acredita</label>
                <select
                  id="special-pps-orientation"
                  value={orientation}
                  onChange={(event) => setOrientation(event.target.value as OrientationKey)}
                >
                  {ORIENTATIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sa-field">
                <label htmlFor="special-pps-student">Estudiante</label>
                <input
                  id="special-pps-student"
                  type="search"
                  value={
                    selectedStudent
                      ? `${selectedStudent.nombre} · ${selectedStudent.legajo}`
                      : studentSearch
                  }
                  placeholder="Nombre o legajo"
                  readOnly={Boolean(selectedStudent)}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  autoComplete="off"
                />
              </div>
              {selectedStudent ? (
                <div className="sa-selected-student">
                  <span>
                    <strong>{selectedStudent.nombre}</strong>
                    <small>Legajo {selectedStudent.legajo}</small>
                  </span>
                  <button
                    type="button"
                    className="sa-text-action"
                    onClick={() => setSelectedStudent(null)}
                  >
                    Cambiar
                  </button>
                </div>
              ) : studentSearch.trim().length >= 2 ? (
                <div className="sa-search-results" aria-label="Resultados de estudiantes">
                  {isSearchingStudents ? (
                    <div className="sa-empty">Buscando…</div>
                  ) : students.length > 0 ? (
                    students.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className="sa-result"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <span>
                          <strong>{student.nombre}</strong>
                          <small>{student.estado || "Sin estado"}</small>
                        </span>
                        <small>Legajo {student.legajo}</small>
                      </button>
                    ))
                  ) : (
                    <div className="sa-empty">No encontramos estudiantes con esa búsqueda.</div>
                  )}
                </div>
              ) : null}

              <div className="sa-field" style={{ maxWidth: 180 }}>
                <label htmlFor="special-pps-hours">Horas que acredita</label>
                <input
                  id="special-pps-hours"
                  type="number"
                  min={1}
                  max={500}
                  value={hours}
                  onChange={(event) => setHours(Number(event.target.value))}
                />
              </div>
            </section>

            <aside aria-labelledby="special-assignment-summary">
              <h2 id="special-assignment-summary" className="sa-section-title">
                Confirmación
              </h2>
              <p className="sa-section-copy">
                Antes de asignar, comprobá que año, orientación y tarea sean los correctos.
              </p>

              {selectedCatalog?.aula_entregas?.activo ? (
                <div className="sa-task-ok" role="status">
                  <span className="material-icons" aria-hidden>
                    task_alt
                  </span>
                  <span>
                    <strong>Tarea exacta configurada</strong>
                    <br />
                    {selectedCatalog.aula_entregas.institucion} · CMID{" "}
                    {selectedCatalog.aula_entregas.moodle_id}
                  </span>
                </div>
              ) : (
                <div className="sa-task-missing" role="alert">
                  <span className="material-icons" aria-hidden>
                    warning_amber
                  </span>
                  <span>
                    <strong>Falta la tarea de {year}</strong>
                    <br />
                    Configurala en “Tareas anuales” antes de asignar a un estudiante.
                  </span>
                </div>
              )}

              <dl className="sa-summary">
                <div className="sa-summary-row">
                  <dt>Estudiante</dt>
                  <dd>{selectedStudent?.nombre ?? "Todavía sin elegir"}</dd>
                </div>
                <div className="sa-summary-row">
                  <dt>PPS</dt>
                  <dd>{activityLabel(activity)}</dd>
                </div>
                <div className="sa-summary-row">
                  <dt>Orientación</dt>
                  <dd>{orientationLabel(orientation)}</dd>
                </div>
                <div className="sa-summary-row">
                  <dt>Entrega</dt>
                  <dd>Libre · sin vencimiento</dd>
                </div>
                <div className="sa-summary-row">
                  <dt>Horas</dt>
                  <dd>{hours > 0 ? `${hours} hs` : "Revisar"}</dd>
                </div>
              </dl>

              <div className="sa-actions">
                <button
                  type="button"
                  className="sa-button"
                  disabled={!canAssign || assignMutation.isPending}
                  onClick={() => assignMutation.mutate()}
                >
                  {assignMutation.isPending ? "Asignando…" : "Asignar PPS y tarea"}
                </button>
              </div>
            </aside>
          </div>

          <section style={{ marginTop: 54 }} aria-labelledby="special-assignment-ledger">
            <h2 id="special-assignment-ledger" className="sa-section-title">
              Asignaciones de {year}
            </h2>
            <p className="sa-section-copy">
              Cada fila conserva la práctica y el vínculo Moodle que ve el estudiante.
            </p>
            <div className="sa-ledger">
              <div className="sa-ledger-head" aria-hidden>
                <span>Estudiante</span>
                <span>Actividad</span>
                <span>Estado</span>
                <span />
              </div>
              {isAssignmentsLoading ? (
                <div className="sa-empty">Cargando asignaciones…</div>
              ) : assignments.length > 0 ? (
                assignments.map((row) => (
                  <div className="sa-ledger-row" key={row.id}>
                    <span>
                      <strong>{row.estudiantes?.nombre ?? "Estudiante"}</strong>
                      <small>Legajo {row.estudiantes?.legajo ?? "—"}</small>
                    </span>
                    <span>
                      <strong>{activityLabel(row.activity_type as ActivityType)}</strong>
                      <small>
                        {orientationLabel(row.orientation_key as OrientationKey)} ·{" "}
                        {row.expected_hours} hs
                      </small>
                    </span>
                    <span className="sa-state">
                      {row.practicas?.nota
                        ? `Nota ${row.practicas.nota}`
                        : (row.practicas?.estado ?? "Asignada")}
                      <code>
                        CMID {row.special_pps_task_catalog?.aula_entregas?.moodle_id ?? "—"}
                      </code>
                    </span>
                    <button
                      type="button"
                      className="sa-cancel"
                      title="Cancelar asignación"
                      aria-label={`Cancelar asignación de ${row.estudiantes?.nombre ?? "estudiante"}`}
                      disabled={cancelMutation.isPending}
                      onClick={() => void requestCancellation(row)}
                    >
                      <span className="material-icons" style={{ fontSize: 17 }} aria-hidden>
                        close
                      </span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="sa-empty">Todavía no hay asignaciones especiales en {year}.</div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section aria-labelledby="special-task-catalog-title">
          <h2 id="special-task-catalog-title" className="sa-section-title">
            Tareas anuales de {year}
          </h2>
          <p className="sa-section-copy">
            Una tarea por actividad y orientación. Sólo aparecen opciones del mismo año y área; una
            tarea vieja nunca se reutiliza automáticamente.
          </p>

          {ACTIVITIES.map((activityItem) => (
            <div key={activityItem.id} style={{ marginBottom: 36 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>{activityItem.shortLabel}</h3>
              <div className="sa-config-grid">
                {TASK_ORIENTATIONS.map((orientationItem) => {
                  const row = catalog.find(
                    (item) =>
                      item.activity_type === activityItem.id &&
                      item.orientation_key === orientationItem.id
                  );
                  const options = annualTasks.filter(
                    (task) =>
                      orientationItem.areas.includes(
                        task.area as "clinica" | "laboral" | "comunitaria" | "educacional"
                      ) && taskMatchesActivity(task, activityItem.id)
                  );
                  const selectionKey = `${activityItem.id}:${orientationItem.id}`;
                  const selectedId =
                    taskSelections[selectionKey] ?? String(row?.aula_entrega_id ?? "");

                  return (
                    <div className="sa-config-row" key={selectionKey}>
                      <span>
                        <strong>{orientationItem.label}</strong>
                        <small>
                          {row?.aula_entregas
                            ? `CMID ${row.aula_entregas.moodle_id}`
                            : "Sin tarea configurada"}
                        </small>
                      </span>
                      <select
                        className="sa-config-select"
                        aria-label={`${activityItem.shortLabel}, orientación ${orientationItem.label}`}
                        value={selectedId}
                        onChange={(event) =>
                          setTaskSelections((current) => ({
                            ...current,
                            [selectionKey]: event.target.value,
                          }))
                        }
                      >
                        <option value="">No hay tarea seleccionada</option>
                        {options.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.institucion} · CMID {task.moodle_id}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="sa-button sa-button--quiet"
                        disabled={
                          !selectedId ||
                          configureTaskMutation.isPending ||
                          selectedId === String(row?.aula_entrega_id ?? "")
                        }
                        onClick={() =>
                          configureTaskMutation.mutate({
                            activityType: activityItem.id,
                            orientationKey: orientationItem.id,
                            taskId: Number(selectedId),
                          })
                        }
                      >
                        Guardar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="sa-config-note">
            Si una tarea no aparece, primero registrala en “Espacio de informe (Campus)” con su año
            y área correctos. Esta pantalla no crea actividades dentro de Moodle.
          </p>
        </section>
      )}

      {confirmDialog}
    </div>
  );
};

export default AsignacionesEspecialesPanel;
