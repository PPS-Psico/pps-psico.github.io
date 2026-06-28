import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
  FIELD_HORAS_PRACTICAS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_SEPARADO_ESTUDIANTES,
  FIELD_NOTAS_INTERNAS_ESTUDIANTES,
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
  TABLE_NAME_ESTUDIANTES,
} from "../../constants";
import { MOCK_ESTUDIANTES, MOCK_PRACTICAS } from "../../data/mockData";
import { db } from "../../lib/db";
import { schema } from "../../lib/dbSchema";
import { ALL_ESTADOS_ESTUDIANTE } from "../../schemas";
import ConfirmModal from "../ConfirmModal";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import PaginationControls from "../PaginationControls";
import Toast from "../ui/Toast";
import ContextMenu from "./ContextMenu";
import RecordEditModal from "./RecordEditModal";
import type { Estudiante } from "../../types";

type ToastState = { message: string; type: "success" | "error" | "warning" | "info" } | null;
type StudentEditingState =
  | (Record<string, unknown> & { id?: string })
  | { isCreating: true }
  | null;
type StudentRow = Estudiante & { __totalHours: number };
interface StudentPage {
  records: StudentRow[];
  total: number;
}

const TABLE_CONFIG = {
  label: "Estudiantes",
  tableName: TABLE_NAME_ESTUDIANTES,
  schema: schema.estudiantes,
  // FIX: Eliminar DNI de searchFields para evitar errores de tipo en la búsqueda simple.
  // DNI es numérico y ilike falla. Búsqueda por Legajo y Nombre es suficiente para la mayoría de casos.
  searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES],
  fieldConfig: [
    { key: FIELD_LEGAJO_ESTUDIANTES, label: "Legajo", type: "text" as const, required: true },
    {
      key: FIELD_NOMBRE_SEPARADO_ESTUDIANTES,
      label: "Nombre",
      type: "text" as const,
      required: true,
    },
    {
      key: FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
      label: "Apellido",
      type: "text" as const,
      required: true,
    },
    { key: FIELD_DNI_ESTUDIANTES, label: "DNI", type: "number" as const },
    { key: FIELD_CORREO_ESTUDIANTES, label: "Correo", type: "email" as const },
    { key: FIELD_TELEFONO_ESTUDIANTES, label: "Teléfono", type: "tel" as const },
    {
      key: FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
      label: "Orientación",
      type: "select" as const,
      options: ["", "Clínica", "Educacional", "Laboral", "Comunitaria"],
    },
    {
      key: FIELD_ESTADO_ESTUDIANTES,
      label: "Estado",
      type: "select" as const,
      options: ALL_ESTADOS_ESTUDIANTE,
    },
    { key: FIELD_FECHA_FINALIZACION_ESTUDIANTES, label: "Fecha Fin", type: "date" as const },
    { key: FIELD_NOTAS_INTERNAS_ESTUDIANTES, label: "Notas", type: "textarea" as const },
  ],
};

const EditorEstudiantes: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const [editingRecord, setEditingRecord] = useState<StudentEditingState>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; record: StudentRow } | null>(null);
  const [toastInfo, setToastInfo] = useState<ToastState>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Debounce para no saturar la API mientras escribes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, error } = useQuery<StudentPage>({
    queryKey: [
      "editor-students",
      currentPage,
      itemsPerPage,
      debouncedSearch,
      filterEstado,
      isTestingMode,
    ],
    queryFn: async () => {
      // TESTING MODE: Usar datos mock
      if (isTestingMode) {
        let filteredRecords = [...MOCK_ESTUDIANTES];

        // Filtro de búsqueda
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          filteredRecords = filteredRecords.filter(
            (s) =>
              (s[FIELD_NOMBRE_ESTUDIANTES] || "").toLowerCase().includes(searchLower) ||
              (s[FIELD_LEGAJO_ESTUDIANTES] || "").toLowerCase().includes(searchLower)
          );
        }

        // Filtro de estado
        if (filterEstado) {
          filteredRecords = filteredRecords.filter(
            (s) => (s as Record<string, unknown>)[FIELD_ESTADO_ESTUDIANTES] === filterEstado
          );
        }

        // Enriquecer con horas totales desde mock data
        const enriched = filteredRecords.map((s) => {
          const sPracticas = MOCK_PRACTICAS.filter(
            (p) => String(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]) === String(s.id)
          );
          return {
            ...s,
            __totalHours: sPracticas.reduce(
              (sum, p) => sum + (Number(p[FIELD_HORAS_PRACTICAS]) || 0),
              0
            ),
          };
        });

        // Paginar
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage;
        return {
          records: enriched.slice(from, to) as unknown as StudentRow[],
          total: enriched.length,
        };
      }

      // MODO REAL: Consultar base de datos
      const filters: Record<string, unknown> = {};
      if (filterEstado) filters[FIELD_ESTADO_ESTUDIANTES] = filterEstado;

      const { records, total, error } = await db.estudiantes.getPage(currentPage, itemsPerPage, {
        searchTerm: debouncedSearch,
        searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES],
        filters,
      });
      if (error) {
        const msg = typeof error.error === "string" ? error.error : error.error?.message;
        throw new Error(msg || "Error al cargar estudiantes");
      }

      // Enriquecer con horas totales para visibilidad inmediata
      const studentIds = records.map((r) => r.id);
      if (studentIds.length === 0) return { records: [], total: 0 };

      const practicas = await db.practicas.getAll({
        filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds },
        fields: [FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_HORAS_PRACTICAS],
      });

      const enriched = records.map((s) => {
        const sPracticas = practicas.filter((p) => {
          const link = p[FIELD_ESTUDIANTE_LINK_PRACTICAS];
          // Handle both array (['id']) and string ('id') formats
          if (Array.isArray(link)) {
            return link.includes(s.id);
          }
          return String(link) === s.id;
        });
        return {
          ...s,
          __totalHours: sPracticas.reduce(
            (sum, p) => sum + (Number(p[FIELD_HORAS_PRACTICAS]) || 0),
            0
          ),
        };
      });

      return { records: enriched as unknown as StudentRow[], total };
    },
  });

  if (error)
    return <EmptyState icon="error" title="Error de Carga" message={(error as Error).message} />;

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; fields: Record<string, unknown> }) => {
      if (isTestingMode) {
        return Promise.resolve({
          ...MOCK_ESTUDIANTES.find((s) => s.id === vars.id),
          ...vars.fields,
        } as unknown as Estudiante);
      }
      const fields = { ...vars.fields };
      if (
        FIELD_NOMBRE_SEPARADO_ESTUDIANTES in fields ||
        FIELD_APELLIDO_SEPARADO_ESTUDIANTES in fields
      ) {
        const nombre = fields[FIELD_NOMBRE_SEPARADO_ESTUDIANTES] || "";
        const apellido = fields[FIELD_APELLIDO_SEPARADO_ESTUDIANTES] || "";
        const fullName = [nombre, apellido].filter(Boolean).join(" ");
        if (fullName) fields[FIELD_NOMBRE_ESTUDIANTES] = fullName;
      }
      return db.estudiantes.update(vars.id, fields as Parameters<typeof db.estudiantes.update>[1]);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["editor-students"] });
      const prev = queryClient.getQueryData(["editor-students"]);
      queryClient.setQueryData(["editor-students"], (old: StudentPage | undefined) => {
        if (!old?.records) return old;
        return {
          ...old,
          records: old.records.map((r) => (r.id === vars.id ? { ...r, ...vars.fields } : r)),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["editor-students"], context.prev);
      setToastInfo({ message: "Error al actualizar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Estudiante actualizado" : "Estudiante actualizado",
        type: "success",
      });
      setEditingRecord(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-students"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) => {
      if (isTestingMode) {
        return Promise.resolve({ id: `st_${Date.now()}`, ...fields } as unknown as Estudiante);
      }
      const fieldsToCreate = { ...fields };
      if (
        fieldsToCreate[FIELD_NOMBRE_SEPARADO_ESTUDIANTES] ||
        fieldsToCreate[FIELD_APELLIDO_SEPARADO_ESTUDIANTES]
      ) {
        const fullName = [
          fieldsToCreate[FIELD_NOMBRE_SEPARADO_ESTUDIANTES],
          fieldsToCreate[FIELD_APELLIDO_SEPARADO_ESTUDIANTES],
        ]
          .filter(Boolean)
          .join(" ");
        if (fullName) fieldsToCreate[FIELD_NOMBRE_ESTUDIANTES] = fullName;
      }
      if (!fieldsToCreate[FIELD_ESTADO_ESTUDIANTES]) {
        fieldsToCreate[FIELD_ESTADO_ESTUDIANTES] = "Nuevo (Sin cuenta)";
      }
      return db.estudiantes.create(fieldsToCreate as Parameters<typeof db.estudiantes.create>[0]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-students"] });
      setToastInfo({
        message: isTestingMode ? "Simulación: Estudiante creado" : "Estudiante creado",
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
      return db.estudiantes.delete(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["editor-students"] });
      const prev = queryClient.getQueryData(["editor-students"]);
      queryClient.setQueryData(["editor-students"], (old: StudentPage | undefined) => {
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
      if (context?.prev) queryClient.setQueryData(["editor-students"], context.prev);
      setToastInfo({ message: "Error al eliminar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Estudiante eliminado" : "Estudiante eliminado",
        type: "success",
      });
      setIdToDelete(null);
      setSelectedRowId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-students"] });
    },
  });

  const handleRowClick = (id: string) => {
    setSelectedRowId((prev) => (prev === id ? null : id));
  };

  const handleRowContextMenu = (e: React.MouseEvent, record: StudentRow) => {
    e.preventDefault();
    setSelectedRowId(record.id);
    setMenu({ x: e.clientX, y: e.clientY, record });
  };

  const getStatusTone = (estado: string | null | undefined): string => {
    switch (estado) {
      case "Activo":
        return "ok";
      case "Finalizado":
        return "accent";
      case "Nuevo (Sin cuenta)":
        return "warn";
      default:
        return "mute";
    }
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
        title="¿Eliminar estudiante?"
        message="Esta acción eliminará permanentemente al estudiante y sus registros. ¿Confirmar?"
        confirmText="Eliminar"
        type="danger"
        onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
        onClose={() => setIdToDelete(null)}
      />

      {/* BARRA DE FILTROS */}
      <div className="dbe-bar">
        <div className="dbe-bar-grow">
          <label className="dbe-label">Buscador</label>
          <div className="dbe-search">
            <span className="material-icons">search</span>
            <input
              type="search"
              placeholder="Nombre o legajo…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ width: 200 }}>
          <label className="dbe-label">Estado</label>
          <div className="dbe-select-wrap">
            <select
              className="dbe-select"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="">Todos</option>
              {ALL_ESTADOS_ESTUDIANTE.map((e) => (
                <option key={e} value={e}>
                  {e}
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
          <span className="material-icons">person_add</span>
          Nuevo
        </button>
      </div>

      {/* ACCIÓN SELECCIÓN */}
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
                  <th>Legajo</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "center" }}>Horas</th>
                </tr>
              </thead>
              <tbody>
                {data?.records.map((s) => {
                  const isSelected = selectedRowId === s.id;
                  return (
                    <tr
                      key={s.id}
                      data-sel={isSelected ? "1" : "0"}
                      onClick={() => handleRowClick(s.id)}
                      onDoubleClick={() => setEditingRecord(s)}
                      onContextMenu={(e) => handleRowContextMenu(e, s)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span className="dbe-avatar">
                            {(s[FIELD_NOMBRE_ESTUDIANTES] || "?").charAt(0).toUpperCase()}
                          </span>
                          <span className="dbe-cell-strong">{s[FIELD_NOMBRE_ESTUDIANTES]}</span>
                        </div>
                      </td>
                      <td className="dbe-cell-mono">{s[FIELD_LEGAJO_ESTUDIANTES]}</td>
                      <td>
                        <span
                          className="dbe-pill"
                          data-tone={getStatusTone(s[FIELD_ESTADO_ESTUDIANTES])}
                        >
                          {s[FIELD_ESTADO_ESTUDIANTES] || "N/A"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="dbe-num">{Math.round(s.__totalHours || 0)}</span>
                        <span className="dbe-num-u">hs</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data?.records.length === 0 && (
            <div className="dbe-empty">
              <EmptyState
                icon="search_off"
                title="Sin coincidencias"
                message="No encontramos alumnos con esos criterios."
              />
            </div>
          )}
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
            { label: "Editar perfil", icon: "edit", onClick: () => setEditingRecord(menu.record) },
            {
              label: "Eliminar registro",
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

export default EditorEstudiantes;
