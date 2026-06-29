import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../../lib/db";
import { schema } from "../../lib/dbSchema";
import {
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  TABLE_NAME_CONVOCATORIAS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
} from "../../constants";
import { formatDate } from "../../utils/formatters";
import Loader from "../Loader";
import RecordEditModal from "./RecordEditModal";
import { paginate, removeRecordById } from "./editorHelpers";
import Toast from "../ui/Toast";
import PaginationControls from "../PaginationControls";
import ContextMenu from "./ContextMenu";
import AdminSearch from "./AdminSearch";
import ConfirmModal from "../ConfirmModal";
import { MOCK_CONVOCATORIAS, MOCK_ESTUDIANTES, MOCK_LANZAMIENTOS } from "../../data/mockData";
import type { Convocatoria } from "../../types";

type ToastState = { message: string; type: "success" | "error" | "warning" | "info" } | null;
type ConvEditingState = (Record<string, unknown> & { id?: string }) | { isCreating: true } | null;
type ConvRow = Convocatoria & { __studentName: string | null; __ppsName: string | null };
interface ConvPage {
  records: ConvRow[];
  total: number;
}

const TABLE_CONFIG = {
  label: "Inscripciones",
  tableName: TABLE_NAME_CONVOCATORIAS,
  schema: schema.convocatorias,
  searchFields: [FIELD_NOMBRE_PPS_CONVOCATORIAS],
  fieldConfig: [
    {
      key: FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
      label: "ID Estudiante",
      type: "text" as const,
      required: true,
    },
    {
      key: FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
      label: "ID Lanzamiento",
      type: "text" as const,
      required: true,
    },
    {
      key: FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
      label: "Estado",
      type: "select" as const,
      options: ["Inscripto", "Seleccionado", "No Seleccionado", "Baja"],
    },
    { key: FIELD_HORARIO_FORMULA_CONVOCATORIAS, label: "Horario Asignado", type: "text" as const },
  ],
};

const getStatusTone = (status: string | null | undefined): string => {
  const s = (status || "").toLowerCase();
  if (s.includes("seleccionado") && !s.includes("no")) return "ok";
  if (s.includes("inscripto")) return "accent";
  if (s.includes("no seleccionado")) return "warn";
  if (s.includes("baja")) return "warn";
  return "mute";
};

const EditorConvocatorias: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
  // --- FILTROS ---
  const [filterStudentId, setFilterStudentId] = useState("");
  const [studentLabel, setStudentLabel] = useState("");
  const [filterLanzamientoId, setFilterLanzamientoId] = useState("");

  // --- PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- ACCIONES ---
  const [editingRecord, setEditingRecord] = useState<ConvEditingState>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; record: ConvRow } | null>(null);
  const [toastInfo, setToastInfo] = useState<ToastState>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // 1. Cargar Lanzamientos para el filtro
  const { data: launches = [] } = useQuery({
    queryKey: ["launches-filter-list"],
    queryFn: () =>
      db.lanzamientos.getAll({
        fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS],
        sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }],
      }),
  });

  // 2. Cargar Convocatorias
  const { data, isLoading } = useQuery<ConvPage>({
    queryKey: [
      "editor-convocatorias",
      currentPage,
      itemsPerPage,
      filterStudentId,
      filterLanzamientoId,
      isTestingMode,
    ],
    queryFn: async () => {
      // TESTING MODE: Usar datos mock
      if (isTestingMode) {
        let filteredRecords = [...MOCK_CONVOCATORIAS];

        // Filtros
        if (filterStudentId) {
          filteredRecords = filteredRecords.filter(
            (c) => c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] === filterStudentId
          );
        }
        if (filterLanzamientoId) {
          filteredRecords = filteredRecords.filter(
            (c) => c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] === filterLanzamientoId
          );
        }

        // Enriquecer datos (Nombre estudiante y Nombre PPS)
        const studentMap = new Map(MOCK_ESTUDIANTES.map((s) => [s.id, s]));
        const launchMap = new Map(MOCK_LANZAMIENTOS.map((l) => [l.id, l]));

        const enriched = filteredRecords.map((c) => {
          const sId = c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
          const lId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] as string;

          const s = sId ? studentMap.get(sId) : null;
          const l = lId ? launchMap.get(lId) : null;

          return {
            ...c,
            __studentName: s ? s[FIELD_NOMBRE_ESTUDIANTES] : "Desconocido",
            __ppsName: l
              ? (l as Record<string, unknown>)[FIELD_NOMBRE_PPS_LANZAMIENTOS]
              : (c as Record<string, unknown>)[FIELD_NOMBRE_PPS_CONVOCATORIAS] || "N/A",
          };
        });

        return {
          records: paginate(enriched, currentPage, itemsPerPage) as unknown as ConvRow[],
          total: enriched.length,
        };
      }

      // MODO REAL: Consultar base de datos
      const filters: Record<string, unknown> = {};
      if (filterStudentId) filters[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] = filterStudentId;
      if (filterLanzamientoId)
        filters[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] = filterLanzamientoId;

      const { records, total, error } = await db.convocatorias.getPage(currentPage, itemsPerPage, {
        filters,
        sort: { field: "created_at", direction: "desc" },
      });
      if (error) throw error;

      // Enriquecer datos (Nombre estudiante y Nombre PPS)
      const studentIds = records
        .map((r) => r[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string)
        .filter(Boolean);
      const launchIds = records
        .map((r) => r[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] as string)
        .filter(Boolean);

      const [students, fetchedLaunches] = await Promise.all([
        db.estudiantes.getAll({ filters: { id: studentIds }, fields: [FIELD_NOMBRE_ESTUDIANTES] }),
        db.lanzamientos.getAll({
          filters: { id: launchIds },
          fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS],
        }),
      ]);

      const studentMap = new Map(students.map((s) => [s.id, s]));
      const launchMap = new Map(fetchedLaunches.map((l) => [l.id, l]));

      const enriched = records.map((c) => {
        const sId = c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
        const lId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] as string;

        const s = sId ? studentMap.get(sId) : null;
        const l = lId ? launchMap.get(lId) : null;

        return {
          ...c,
          __studentName: s ? s[FIELD_NOMBRE_ESTUDIANTES] : "Desconocido",
          __ppsName: l
            ? l[FIELD_NOMBRE_PPS_LANZAMIENTOS]
            : c[FIELD_NOMBRE_PPS_CONVOCATORIAS] || "N/A",
        };
      });

      return { records: enriched as unknown as ConvRow[], total };
    },
  });

  // --- MUTACIONES ---
  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; fields: Record<string, unknown> }) => {
      if (isTestingMode) {
        return Promise.resolve({
          ...MOCK_CONVOCATORIAS.find((c) => c.id === vars.id),
          ...vars.fields,
        } as unknown as Convocatoria);
      }
      return db.convocatorias.update(
        vars.id,
        vars.fields as Parameters<typeof db.convocatorias.update>[1]
      );
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["editor-convocatorias"] });
      const prev = queryClient.getQueryData(["editor-convocatorias"]);
      queryClient.setQueryData(["editor-convocatorias"], (old: ConvPage | undefined) => {
        if (!old?.records) return old;
        return {
          ...old,
          records: old.records.map((r) => (r.id === vars.id ? { ...r, ...vars.fields } : r)),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["editor-convocatorias"], context.prev);
      setToastInfo({ message: "Error al actualizar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Inscripción actualizada" : "Inscripción actualizada",
        type: "success",
      });
      setEditingRecord(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-convocatorias"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) => {
      if (isTestingMode) {
        return Promise.resolve({ id: `conv_${Date.now()}`, ...fields } as unknown as Convocatoria);
      }
      return db.convocatorias.create(fields as Parameters<typeof db.convocatorias.create>[0]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-convocatorias"] });
      setToastInfo({
        message: isTestingMode ? "Simulación: Inscripción creada" : "Inscripción creada",
        type: "success",
      });
      setEditingRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (isTestingMode) {
        return Promise.resolve(true);
      }
      return db.convocatorias.delete(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["editor-convocatorias"] });
      const prev = queryClient.getQueryData(["editor-convocatorias"]);
      queryClient.setQueryData(["editor-convocatorias"], (old: ConvPage | undefined) => {
        if (!old?.records) return old;
        return removeRecordById(old, id);
      });
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(["editor-convocatorias"], context.prev);
      setToastInfo({ message: "Error al eliminar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Inscripción eliminada" : "Inscripción eliminada",
        type: "success",
      });
      setIdToDelete(null);
      setSelectedRowId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-convocatorias"] });
    },
  });

  const handleRowContextMenu = (e: React.MouseEvent, record: ConvRow) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, record });
    setSelectedRowId(record.id);
  };

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
        title="¿Eliminar inscripción?"
        message="Esta acción eliminará el registro de inscripción. No se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
        onClose={() => setIdToDelete(null)}
      />

      {/* FILTROS */}
      <div className="dbe-bar">
        <div className="dbe-bar-grow">
          <label className="dbe-label">Estudiante</label>
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

        <div className="dbe-bar-grow">
          <label className="dbe-label">Lanzamiento / PPS</label>
          <div className="dbe-select-wrap">
            <select
              className="dbe-select"
              value={filterLanzamientoId}
              onChange={(e) => setFilterLanzamientoId(e.target.value)}
            >
              <option value="">Todas las convocatorias</option>
              {launches.map((l) => (
                <option key={l.id} value={l.id}>
                  {l[FIELD_NOMBRE_PPS_LANZAMIENTOS]} (
                  {formatDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS])})
                </option>
              ))}
            </select>
            <span className="material-icons">expand_more</span>
          </div>
        </div>

        <button
          className="dbe-btn dbe-btn-primary"
          onClick={() => setEditingRecord({ isCreating: true })}
        >
          <span className="material-icons">add_card</span>
          Nueva inscripción
        </button>
      </div>

      <div className="dbe-actionrow">
        {selectedRowId && (
          <button className="dbe-btn dbe-btn-danger" onClick={() => setIdToDelete(selectedRowId)}>
            <span className="material-icons" style={{ fontSize: 15 }}>
              delete
            </span>{" "}
            Eliminar selección
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
                  <th>Estudiante</th>
                  <th>Convocatoria PPS</th>
                  <th>Horario</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data?.records.map((c) => {
                  const isSelected = selectedRowId === c.id;
                  return (
                    <tr
                      key={c.id}
                      data-sel={isSelected ? "1" : "0"}
                      onClick={() => setSelectedRowId(isSelected ? null : c.id)}
                      onDoubleClick={() => setEditingRecord(c)}
                      onContextMenu={(e) => handleRowContextMenu(e, c)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span className="dbe-avatar">
                            {(c.__studentName || "?").charAt(0).toUpperCase()}
                          </span>
                          <span className="dbe-cell-strong">{c.__studentName}</span>
                        </div>
                      </td>
                      <td>
                        <div
                          className="dbe-cell-strong"
                          style={{
                            maxWidth: 280,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                          }}
                          title={c.__ppsName ?? undefined}
                        >
                          {c.__ppsName}
                        </div>
                      </td>
                      <td>
                        <span
                          className="dbe-schedule"
                          title={c[FIELD_HORARIO_FORMULA_CONVOCATORIAS] ?? undefined}
                        >
                          <span className="material-icons">schedule</span>
                          {c[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || "Sin horario"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="dbe-pill"
                          data-tone={getStatusTone(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS])}
                        >
                          {c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "Pendiente"}
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
            {
              label: "Editar inscripción",
              icon: "edit",
              onClick: () => setEditingRecord(menu.record),
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
    </div>
  );
};

export default EditorConvocatorias;
