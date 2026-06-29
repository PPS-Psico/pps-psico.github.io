import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../../lib/db";
import { schema } from "../../lib/dbSchema";
import {
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_NOTA_PRACTICAS,
  TABLE_NAME_PRACTICAS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
} from "../../constants";
import { ALL_ORIENTACIONES } from "../../types";
import { formatDate, cleanInstitutionName, safeGetId } from "../../utils/formatters";
import Loader from "../Loader";
import RecordEditModal from "./RecordEditModal";
import { paginate } from "./editorHelpers";
import BulkEditModal, { type BulkFieldConfig } from "./BulkEditModal";
import ContextMenu from "./ContextMenu";
import DuplicateToStudentModal from "./DuplicateToStudentModal";
import AdminSearch from "./AdminSearch";
import Toast from "../ui/Toast";
import PaginationControls from "../PaginationControls";
import ConfirmModal from "../ConfirmModal";
import SearchableSelect from "../SearchableSelect";
import {
  MOCK_PRACTICAS,
  MOCK_ESTUDIANTES,
  MOCK_LANZAMIENTOS,
  MOCK_INSTITUCIONES,
} from "../../data/mockData";
import type { Practica, Institucion, LanzamientoPPS } from "../../types";

type ToastState = { message: string; type: "success" | "error" | "info" } | null;

/** Práctica enriquecida con datos del estudiante para la tabla del editor. */
type PracticaRow = Practica & {
  __student: { nombre: string | null; legajo: string | number | null };
};

interface PracticaPage {
  records: PracticaRow[];
  total: number;
}

type EditingState = (Record<string, unknown> & { id?: string }) | { isCreating: true } | null;

const getEstadoTone = (estado: string | null | undefined): string => {
  const s = (estado || "").toLowerCase();
  if (s.includes("en curso")) return "accent";
  if (s.includes("finalizada") || s.includes("realizado")) return "ok";
  if (s.includes("no se pudo")) return "warn";
  return "mute";
};

const TABLE_CONFIG = {
  label: "Prácticas",
  tableName: TABLE_NAME_PRACTICAS,
  schema: schema.practicas,
  fieldConfig: [
    {
      key: FIELD_ESTUDIANTE_LINK_PRACTICAS,
      label: "ID Estudiante",
      type: "text" as const,
      required: true,
    },
    {
      key: FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
      label: "ID Lanzamiento",
      type: "text" as const,
      required: true,
    },
    {
      key: FIELD_ESPECIALIDAD_PRACTICAS,
      label: "Especialidad",
      type: "select" as const,
      options: ALL_ORIENTACIONES,
      required: true,
    },
    { key: FIELD_HORAS_PRACTICAS, label: "Horas", type: "number" as const },
    { key: FIELD_FECHA_INICIO_PRACTICAS, label: "Inicio", type: "date" as const },
    { key: FIELD_FECHA_FIN_PRACTICAS, label: "Fin", type: "date" as const },
    {
      key: FIELD_ESTADO_PRACTICA,
      label: "Estado",
      type: "select" as const,
      options: ["En curso", "Finalizada", "Convenio Realizado", "No se pudo concretar"],
    },
    { key: FIELD_NOTA_PRACTICAS, label: "Nota", type: "text" as const },
    {
      key: FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
      label: "Nombre Institución",
      type: "text" as const,
    },
  ],
};

// Campos que tienen sentido editar a nivel de toda una PPS/convocatoria.
// Se excluyen los IDs de vínculo (estudiante / lanzamiento) y la Nota, que son
// propios de cada alumno.
const BULK_FIELDS: BulkFieldConfig[] = [
  {
    key: FIELD_ESPECIALIDAD_PRACTICAS,
    label: "Especialidad",
    type: "select",
    options: ALL_ORIENTACIONES,
  },
  {
    key: FIELD_ESTADO_PRACTICA,
    label: "Estado",
    type: "select",
    options: ["En curso", "Finalizada", "Convenio Realizado", "No se pudo concretar"],
  },
  { key: FIELD_HORAS_PRACTICAS, label: "Horas", type: "number" },
  { key: FIELD_FECHA_INICIO_PRACTICAS, label: "Inicio", type: "date" },
  { key: FIELD_FECHA_FIN_PRACTICAS, label: "Fin", type: "date" },
  {
    key: FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
    label: "Nombre Institución",
    type: "text",
  },
];

const EditorPracticas: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
  const [filterStudentId, setFilterStudentId] = useState("");
  const [studentLabel, setStudentLabel] = useState("");
  const [selectedInstId, setSelectedInstId] = useState("");
  const [selectedLaunchId, setSelectedLaunchId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const [menu, setMenu] = useState<{ x: number; y: number; record: PracticaRow } | null>(null);
  const [editingRecord, setEditingRecord] = useState<EditingState>(null);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [duplicatingRecord, setDuplicatingRecord] = useState<PracticaRow | null>(null);
  const [toastInfo, setToastInfo] = useState<ToastState>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: institutions = [] } = useQuery<Institucion[]>({
    queryKey: ["institutions-filter", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) return [...MOCK_INSTITUCIONES] as unknown as Institucion[];
      const allInstituciones = await db.instituciones.getAll({
        fields: [FIELD_NOMBRE_INSTITUCIONES],
      });
      return allInstituciones.map((i) => ({
        ...i,
        orientaciones: i.orientaciones || "",
        codigo_tarjeta_campus: i.codigo_tarjeta_campus || "",
      }));
    },
  });

  const { data: launches = [] } = useQuery<LanzamientoPPS[]>({
    queryKey: ["launches-filter", selectedInstId, isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const inst = institutions.find((i) => i.id === selectedInstId);
        if (!inst) return [];
        const rawName = cleanInstitutionName(inst[FIELD_NOMBRE_INSTITUCIONES]);
        const searchName = rawName
          .split(/ [-–—] /)[0]
          .split("(")[0]
          .trim();
        return MOCK_LANZAMIENTOS.filter((l) =>
          l[FIELD_NOMBRE_PPS_LANZAMIENTOS]?.includes(searchName)
        ) as unknown as LanzamientoPPS[];
      }
      const inst = institutions.find((i) => i.id === selectedInstId);
      if (!inst) return [];
      const rawName = cleanInstitutionName(inst[FIELD_NOMBRE_INSTITUCIONES]);
      const searchName = rawName
        .split(/ [-–—] /)[0]
        .split("(")[0]
        .trim();
      const lanzamientosData = await db.lanzamientos.getAll({
        filters: { [FIELD_NOMBRE_PPS_LANZAMIENTOS]: `%${searchName}%` },
        fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS],
      });
      return lanzamientosData.map((l) => ({
        ...l,
        institucion_id: selectedInstId,
      }));
    },
    enabled: !!selectedInstId,
  });

  // Construye los filtros del modo real. Reutilizado por la query paginada y por
  // la edición masiva (que necesita todos los registros que matchean, no solo la
  // página visible).
  const buildRealFilters = () => {
    const filters: Record<string, unknown> = {};

    // Filtro por Estudiante (Exacto UUID)
    if (filterStudentId) filters[FIELD_ESTUDIANTE_LINK_PRACTICAS] = filterStudentId;

    // --- ESTRATEGIA HÍBRIDA DE FILTRADO ---
    if (selectedInstId) {
      const inst = institutions.find((i) => i.id === selectedInstId);
      if (inst) {
        const searchName = cleanInstitutionName(inst[FIELD_NOMBRE_INSTITUCIONES])
          .split(" - ")[0]
          .trim();
        filters[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = `%${searchName}%`;
      }
    }

    if (selectedLaunchId) {
      const launch = launches.find((l) => l.id === selectedLaunchId);
      if (launch && launch[FIELD_FECHA_INICIO_LANZAMIENTOS]) {
        filters[FIELD_FECHA_INICIO_PRACTICAS] = launch[FIELD_FECHA_INICIO_LANZAMIENTOS];
      } else {
        filters[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] = selectedLaunchId;
      }
    }

    return filters;
  };

  const { data, isLoading } = useQuery<PracticaPage>({
    queryKey: [
      "editor-practicas",
      currentPage,
      itemsPerPage,
      filterStudentId,
      selectedInstId,
      selectedLaunchId,
      isTestingMode,
    ],
    queryFn: async () => {
      // TESTING MODE: Usar datos mock
      if (isTestingMode) {
        let filteredRecords = [...MOCK_PRACTICAS];

        if (filterStudentId) {
          filteredRecords = filteredRecords.filter(
            (p) => p[FIELD_ESTUDIANTE_LINK_PRACTICAS] === filterStudentId
          );
        }

        if (selectedInstId) {
          const inst = institutions.find((i) => i.id === selectedInstId);
          if (inst) {
            const searchName = cleanInstitutionName(inst[FIELD_NOMBRE_INSTITUCIONES])
              .split(" - ")[0]
              .trim();
            filteredRecords = filteredRecords.filter((p) =>
              p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]?.includes(searchName)
            );
          }
        }

        if (selectedLaunchId) {
          const launch = launches.find((l) => l.id === selectedLaunchId);
          if (launch && launch[FIELD_FECHA_INICIO_LANZAMIENTOS]) {
            filteredRecords = filteredRecords.filter(
              (p) => p[FIELD_FECHA_INICIO_PRACTICAS] === launch[FIELD_FECHA_INICIO_LANZAMIENTOS]
            );
          } else {
            filteredRecords = filteredRecords.filter(
              (p) => p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] === selectedLaunchId
            );
          }
        }

        const studentMap = new Map(MOCK_ESTUDIANTES.map((s) => [s.id, s]));
        const enriched = filteredRecords.map((p) => ({
          ...p,
          [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: cleanInstitutionName(
            p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]
          ),
          __student: studentMap.get(safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]) || "") || {
            nombre: "Desconocido",
            legajo: "---",
          },
        }));

        return {
          records: paginate(enriched, currentPage, itemsPerPage) as unknown as PracticaRow[],
          total: enriched.length,
        };
      }

      // MODO REAL: Consultar base de datos
      const filters = buildRealFilters();

      const { records, total, error } = await db.practicas.getPage(currentPage, itemsPerPage, {
        filters,
      });
      if (error) throw error;

      const studentIds = records
        .map((r) => {
          const val = r[FIELD_ESTUDIANTE_LINK_PRACTICAS];
          if (Array.isArray(val) && val.length > 0) return val[0];
          return safeGetId(val);
        })
        .filter(Boolean) as string[];

      // Ensure unique IDs to avoid duplicate queries or oversized URLs
      const uniqueStudentIds = Array.from(new Set(studentIds));

      const students = await db.estudiantes.getAll({
        filters: { id: uniqueStudentIds },
        fields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES],
      });
      const studentMap = new Map(students.map((s) => [s.id, s]));

      const enriched = records.map((p) => ({
        ...p,
        [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: cleanInstitutionName(
          p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]
        ),
        __student: studentMap.get(safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]) || "") || {
          nombre: "Desconocido",
          legajo: "---",
        },
      }));

      return { records: enriched as unknown as PracticaRow[], total };
    },
  });

  const sanitizeFields = (fields: Record<string, unknown>) => {
    const clean: Record<string, unknown> = { ...fields };
    if (clean[FIELD_ESTUDIANTE_LINK_PRACTICAS])
      clean[FIELD_ESTUDIANTE_LINK_PRACTICAS] = safeGetId(clean[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
    if (clean[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS])
      clean[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] = safeGetId(
        clean[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]
      );
    if (clean[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS])
      clean[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = cleanInstitutionName(
        clean[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]
      );
    return clean;
  };

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; fields: Record<string, unknown> }) => {
      if (isTestingMode) {
        return Promise.resolve({
          ...MOCK_PRACTICAS.find((p) => p.id === vars.id),
          ...vars.fields,
        } as unknown as Practica);
      }
      return db.practicas.update(
        vars.id,
        sanitizeFields(vars.fields) as Parameters<typeof db.practicas.update>[1]
      );
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["editor-practicas"] });
      const prev = queryClient.getQueryData(["editor-practicas"]);
      queryClient.setQueryData(["editor-practicas"], (old: PracticaPage | undefined) => {
        if (!old?.records) return old;
        return {
          ...old,
          records: old.records.map((r) => (r.id === vars.id ? { ...r, ...vars.fields } : r)),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["editor-practicas"], context.prev);
      setToastInfo({ message: "Error al actualizar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Registro actualizado" : "Registro actualizado",
        type: "success",
      });
      setEditingRecord(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-practicas"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) => {
      if (isTestingMode) {
        return Promise.resolve({ id: `prac_${Date.now()}`, ...fields } as unknown as Practica);
      }
      return db.practicas.create(
        sanitizeFields(fields) as Parameters<typeof db.practicas.create>[0]
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-practicas"] });
      setToastInfo({
        message: isTestingMode ? "Simulación: Registro creado" : "Registro creado",
        type: "success",
      });
      setEditingRecord(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({
      record,
      targetStudentId,
    }: {
      record: PracticaRow;
      targetStudentId: string;
    }) => {
      if (isTestingMode) {
        return Promise.resolve({
          ...record,
          id: `prac_${Date.now()}`,
          [FIELD_ESTUDIANTE_LINK_PRACTICAS]: targetStudentId,
        } as unknown as Practica);
      }
      const { id, created_at, createdTime, ...fields } = record as Record<string, unknown>;
      void id;
      void created_at;
      void createdTime;
      const cleanFields = sanitizeFields(fields);
      cleanFields[FIELD_ESTUDIANTE_LINK_PRACTICAS] = targetStudentId;
      delete cleanFields.__student;
      delete cleanFields.__studentName;
      return db.practicas.create(cleanFields as Parameters<typeof db.practicas.create>[0]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-practicas"] });
      setToastInfo({
        message: isTestingMode ? "Simulación: Práctica duplicada" : "Práctica duplicada",
        type: "success",
      });
      setDuplicatingRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (isTestingMode) {
        return Promise.resolve(true);
      }
      return db.practicas.delete(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["editor-practicas"] });
      const prev = queryClient.getQueryData(["editor-practicas"]);
      queryClient.setQueryData(["editor-practicas"], (old: PracticaPage | undefined) => {
        if (!old?.records) return old;
        return {
          ...old,
          records: old.records.filter((r) => r.id !== id),
          total: Math.max(0, (old.total || 0) - 1),
        };
      });
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(["editor-practicas"], context.prev);
      setToastInfo({ message: "Error al eliminar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Registro eliminado" : "Registro eliminado",
        type: "success",
      });
      setIdToDelete(null);
      setSelectedRowId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-practicas"] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (changes: Record<string, unknown>) => {
      if (isTestingMode) {
        return { count: data?.total || 0 };
      }
      // Trae TODOS los registros que matchean el filtro activo (no solo la página
      // visible) y les aplica los mismos cambios.
      const filters = buildRealFilters();
      const allRecords = await db.practicas.getAll({ filters });
      if (allRecords.length === 0) return { count: 0 };
      const cleanChanges = sanitizeFields(changes) as Parameters<typeof db.practicas.update>[1];
      const payload = allRecords.map((r) => ({ id: r.id, fields: cleanChanges }));
      await db.practicas.updateMany(payload);
      return { count: allRecords.length };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["editor-practicas"] });
      setToastInfo({
        message: isTestingMode
          ? `Simulación: ${res.count} registros actualizados`
          : `${res.count} registros actualizados`,
        type: "success",
      });
      setBulkEditing(false);
    },
    onError: () => {
      setToastInfo({ message: "Error en la edición masiva", type: "error" });
    },
  });

  const handleRowContextMenu = (e: React.MouseEvent, record: PracticaRow) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, record });
    setSelectedRowId(record.id);
  };

  const institutionOptions = institutions
    .map((i) => ({
      value: i.id,
      label: cleanInstitutionName(i[FIELD_NOMBRE_INSTITUCIONES]),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const launchOptions = launches.map((l) => ({
    value: l.id,
    label:
      formatDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]) +
      (l[FIELD_NOMBRE_PPS_LANZAMIENTOS] ? ` - ${l[FIELD_NOMBRE_PPS_LANZAMIENTOS]}` : ""),
  }));

  // La edición masiva solo se habilita con un filtro de PPS activo (institución
  // y/o convocatoria) para evitar reescribir toda la tabla por accidente.
  const canBulkEdit = !!(selectedInstId || selectedLaunchId) && (data?.total || 0) > 0;
  const bulkScopeLabel =
    [
      institutionOptions.find((o) => o.value === selectedInstId)?.label,
      launchOptions.find((o) => o.value === selectedLaunchId)?.label,
    ]
      .filter(Boolean)
      .join(" · ") || "el filtro actual";

  return (
    <div className="dbe">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <ConfirmModal
        isOpen={!!idToDelete}
        title="¿Eliminar práctica?"
        message="Se borrará el registro. ¿Confirmar?"
        confirmText="Eliminar"
        type="danger"
        onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
        onClose={() => setIdToDelete(null)}
      />

      {/* FILTROS */}
      <div className="dbe-bar">
        <div className="dbe-bar-grow" style={{ flexBasis: 200 }}>
          <label className="dbe-label">Alumno</label>
          {!filterStudentId ? (
            <div className="dbe-search" style={{ height: 42 }}>
              <span className="material-icons">search</span>
              <div style={{ paddingLeft: 26 }}>
                <AdminSearch
                  onStudentSelect={(s) => {
                    setFilterStudentId(s.id);
                    setStudentLabel(s[FIELD_NOMBRE_ESTUDIANTES] || "");
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="dbe-chip-active">
              <span>{studentLabel}</span>
              <button onClick={() => setFilterStudentId("")} aria-label="Quitar filtro">
                <span className="material-icons">close</span>
              </button>
            </div>
          )}
        </div>

        <div className="dbe-bar-grow" style={{ flexBasis: 240 }}>
          <SearchableSelect
            label="Institución"
            options={[{ value: "", label: "Todas" }, ...institutionOptions]}
            value={selectedInstId}
            onChange={(val) => {
              setSelectedInstId(val);
              setSelectedLaunchId("");
            }}
            placeholder="Buscar institución..."
            className="w-full"
          />
        </div>

        <div className="dbe-bar-grow" style={{ flexBasis: 200 }}>
          <SearchableSelect
            label="Fecha / Convocatoria"
            options={[{ value: "", label: "Todas" }, ...launchOptions]}
            value={selectedLaunchId}
            onChange={setSelectedLaunchId}
            placeholder={selectedInstId ? "Seleccionar fecha..." : "Selecciona Inst. primero"}
            disabled={!selectedInstId}
            className="w-full"
          />
        </div>

        <button
          className="dbe-btn dbe-btn-primary"
          onClick={() => setEditingRecord({ isCreating: true })}
        >
          <span className="material-icons">add_circle</span>
          Nueva
        </button>
      </div>

      <div className="dbe-actionrow">
        {canBulkEdit && (
          <button
            className="dbe-btn"
            onClick={() => setBulkEditing(true)}
            title="Editar todos los registros del filtro actual"
          >
            <span className="material-icons" style={{ fontSize: 15 }}>
              done_all
            </span>{" "}
            Editar todos ({data?.total || 0})
          </button>
        )}
        {selectedRowId && (
          <button className="dbe-btn dbe-btn-danger" onClick={() => setIdToDelete(selectedRowId)}>
            <span className="material-icons" style={{ fontSize: 15 }}>
              delete
            </span>{" "}
            Eliminar
          </button>
        )}
      </div>

      {/* TABLA */}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader />
        </div>
      ) : (
        <div className="dbe-table-wrap">
          <div className="dbe-scroll">
            <table className="dbe-table">
              <thead>
                <tr>
                  <th>Institución</th>
                  <th>Estudiante</th>
                  <th>Inicio</th>
                  <th style={{ textAlign: "center" }}>Horas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data?.records.map((p) => {
                  const isSelected = selectedRowId === p.id;
                  return (
                    <tr
                      key={p.id}
                      data-sel={isSelected ? "1" : "0"}
                      onClick={() => setSelectedRowId(isSelected ? null : p.id)}
                      onContextMenu={(e) => handleRowContextMenu(e, p)}
                      onDoubleClick={() => setEditingRecord(p)}
                    >
                      <td>
                        <div
                          className="dbe-cell-strong"
                          style={{
                            maxWidth: 240,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={cleanInstitutionName(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS])}
                        >
                          {cleanInstitutionName(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS])}
                        </div>
                        {p[FIELD_ESPECIALIDAD_PRACTICAS] && (
                          <div style={{ marginTop: 5 }}>
                            <span className="dbe-tag">{p[FIELD_ESPECIALIDAD_PRACTICAS]}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="dbe-cell-strong" style={{ fontWeight: 500 }}>
                          {p.__student.nombre}
                        </div>
                        <div className="dbe-cell-mono">{p.__student.legajo}</div>
                      </td>
                      <td className="dbe-cell-mono">
                        {formatDate(p[FIELD_FECHA_INICIO_PRACTICAS])}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="dbe-num">{p[FIELD_HORAS_PRACTICAS]}</span>
                        <span className="dbe-num-u">hs</span>
                      </td>
                      <td>
                        <span
                          className="dbe-pill"
                          data-tone={getEstadoTone(p[FIELD_ESTADO_PRACTICA])}
                        >
                          {p[FIELD_ESTADO_PRACTICA]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil((data?.total || 0) / itemsPerPage)}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            totalItems={data?.total || 0}
          />
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          options={[
            { label: "Editar", icon: "edit", onClick: () => setEditingRecord(menu.record) },
            {
              label: "Duplicar a otro",
              icon: "content_copy",
              onClick: () => setDuplicatingRecord(menu.record),
            },
            {
              label: "Eliminar",
              icon: "delete",
              variant: "danger",
              onClick: () => setIdToDelete(menu.record.id),
            },
          ]}
        />
      )}
      {editingRecord && (
        <RecordEditModal
          isOpen={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          record={editingRecord.isCreating ? null : editingRecord}
          tableConfig={TABLE_CONFIG}
          onSave={(id, fields) =>
            id ? updateMutation.mutate({ id, fields }) : createMutation.mutate(fields)
          }
          isSaving={updateMutation.isPending || createMutation.isPending}
        />
      )}
      {bulkEditing && (
        <BulkEditModal
          isOpen={bulkEditing}
          onClose={() => setBulkEditing(false)}
          count={data?.total || 0}
          scopeLabel={bulkScopeLabel}
          fields={BULK_FIELDS}
          onConfirm={(changes) => bulkUpdateMutation.mutate(changes)}
          isSaving={bulkUpdateMutation.isPending}
        />
      )}
      {duplicatingRecord && (
        <DuplicateToStudentModal
          isOpen={!!duplicatingRecord}
          onClose={() => setDuplicatingRecord(null)}
          sourceRecordLabel={cleanInstitutionName(
            duplicatingRecord[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]
          )}
          onConfirm={(targetId) =>
            duplicateMutation.mutate({ record: duplicatingRecord, targetStudentId: targetId })
          }
          isSaving={duplicateMutation.isPending}
        />
      )}
    </div>
  );
};

export default EditorPracticas;
