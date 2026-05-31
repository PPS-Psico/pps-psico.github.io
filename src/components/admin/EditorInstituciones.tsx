import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_DIRECCION_INSTITUCIONES,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_ORIENTACIONES_INSTITUCIONES,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_TUTOR_INSTITUCIONES,
  TABLE_NAME_INSTITUCIONES,
} from "../../constants";
import { MOCK_INSTITUCIONES } from "../../data/mockData";
import { db } from "../../lib/db";
import { schema } from "../../lib/dbSchema";
import {
  cleanInstitutionName,
  normalizeStringForComparison,
  toTitleCase,
} from "../../utils/formatters";
import ConfirmModal from "../ConfirmModal";
import Loader from "../Loader";
import PaginationControls from "../PaginationControls";
import Toast from "../ui/Toast";
import ContextMenu from "./ContextMenu";
import RecordEditModal from "./RecordEditModal";
import { logger } from "../../utils/logger";

const TABLE_CONFIG = {
  label: "Instituciones",
  tableName: TABLE_NAME_INSTITUCIONES,
  schema: schema.instituciones,
  searchFields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_DIRECCION_INSTITUCIONES],
  fieldConfig: [
    { key: FIELD_NOMBRE_INSTITUCIONES, label: "Nombre", type: "text" as const, required: true },
    { key: FIELD_TELEFONO_INSTITUCIONES, label: "Teléfono", type: "tel" as const },
    { key: FIELD_DIRECCION_INSTITUCIONES, label: "Dirección", type: "text" as const },
    {
      key: FIELD_CONVENIO_NUEVO_INSTITUCIONES,
      label: "Año del Convenio",
      type: "select" as const,
      options: ["", "2024", "2025", "2026"],
    },
    { key: FIELD_TUTOR_INSTITUCIONES, label: "Tutor", type: "text" as const },
    {
      key: FIELD_ORIENTACIONES_INSTITUCIONES,
      label: "Orientaciones (Calc. Automático)",
      type: "text" as const,
    },
  ],
};

const LISTA_CONVENIOS_2024 = [
  "Banco Provincia del Neuquen",
  "Centro de Inclusión Social y Laboral APASIDO",
  "Colegio Nuestra Señora de Fátima",
  "Colegio San José Obrero de Neuquén",
  "Escuela Cristiana Vida",
  "Ministerio de Trabajo y Desarrollo Laboral",
];
const LISTA_CONVENIOS_2025 = [
  "Centro Evaluador Camioneros",
  "Colegio Psicólogos CPAVZO",
  "Consultorios Las Lilas",
  "Corporate Resources",
  "Escuela de Formación Cooperativa y Laboral N8",
  "Fundación Kano",
  "Hospital Centenario Natalio Burd",
  "Institución Fernando Ulloa",
  "Instituto de Formación Docente N4",
  "Randstad",
  "Sanatorio Juan XXIII",
  "Subsecretaría de Familia",
  "Clínica Fava",
  "ACUCADES",
];

const EditorInstituciones: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; record: any } | null>(null);
  const [toastInfo, setToastInfo] = useState<any>(null);
  const [isFixingData, setIsFixingData] = useState(false);
  const [isSyncingOrientations, setIsSyncingOrientations] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["editor-instituciones", currentPage, itemsPerPage, debouncedSearch, isTestingMode],
    queryFn: async () => {
      // TESTING MODE: Usar datos mock
      if (isTestingMode) {
        let filteredRecords = [...MOCK_INSTITUCIONES];

        // Filtro de búsqueda
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          filteredRecords = filteredRecords.filter(
            (i) =>
              (i[FIELD_NOMBRE_INSTITUCIONES] || "").toLowerCase().includes(searchLower) ||
              (i[FIELD_DIRECCION_INSTITUCIONES] || "").toLowerCase().includes(searchLower)
          );
        }

        // Paginar
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage;
        return {
          records: filteredRecords.slice(from, to),
          total: filteredRecords.length,
        };
      }

      const result = await db.instituciones.getPage(currentPage, itemsPerPage, {
        searchTerm: debouncedSearch,
        searchFields: TABLE_CONFIG.searchFields,
        sort: { field: FIELD_CONVENIO_NUEVO_INSTITUCIONES, direction: "desc" },
      });

      if (result.records) {
        const before = result.records.length;
        result.records = result.records.filter(
          (r: any) =>
            !String(r[FIELD_NOMBRE_INSTITUCIONES] || "")
              .toUpperCase()
              .startsWith("UFLO -")
        );
        if (result.records.length < before && result.total) {
          result.total -= before - result.records.length;
        }
      }
      return result;
    },
  });

  const handleError = (e: Error) => {
    logger.error(e);
    setToastInfo({ message: `Error: ${e.message}`, type: "error" });
  };

  const updateMutation = useMutation({
    mutationFn: (vars: any) => {
      // convenio_nuevo es smallint (año) o null. El select da "" o "2024"…
      const raw = vars.fields[FIELD_CONVENIO_NUEVO_INSTITUCIONES];
      let val: number | null = null;
      if (raw !== "" && raw != null && raw !== "No" && raw !== "false") {
        const n = Number(raw);
        val = Number.isNaN(n) ? null : n;
      }

      const cleanFields = {
        ...vars.fields,
        [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: val,
      };
      if (isTestingMode) {
        return Promise.resolve({
          ...MOCK_INSTITUCIONES.find((i) => i.id === vars.id),
          ...cleanFields,
        } as any);
      }
      return db.instituciones.update(vars.id, cleanFields);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["editor-instituciones"] });
      const prev = queryClient.getQueryData(["editor-instituciones"]);
      queryClient.setQueryData(["editor-instituciones"], (old: any) => {
        if (!old?.records) return old;
        return {
          ...old,
          records: old.records.map((r: any) => (r.id === vars.id ? { ...r, ...vars.fields } : r)),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["editor-instituciones"], context.prev);
      setToastInfo({ message: "Error al actualizar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Institución actualizada" : "Institución actualizada",
        type: "success",
      });
      setEditingRecord(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-instituciones"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (fields: any) => {
      if (isTestingMode) {
        // MODO TESTING: Simular creación (no afecta DB real)
        return Promise.resolve({ id: `inst_${Date.now()}`, ...fields } as any);
      }
      return db.instituciones.create(fields);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-instituciones"] });
      setToastInfo({
        message: isTestingMode ? "Simulación: Institución creada" : "Institución creada",
        type: "success",
      });
      setEditingRecord(null);
    },
    onError: handleError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (isTestingMode) {
        return Promise.resolve(true);
      }
      return db.instituciones.delete(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["editor-instituciones"] });
      const prev = queryClient.getQueryData(["editor-instituciones"]);
      queryClient.setQueryData(["editor-instituciones"], (old: any) => {
        if (!old?.records) return old;
        return {
          ...old,
          records: old.records.filter((r: any) => r.id !== id),
          total: Math.max(0, (old.total || 0) - 1),
        };
      });
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(["editor-instituciones"], context.prev);
      setToastInfo({ message: "Error al eliminar", type: "error" });
    },
    onSuccess: () => {
      setToastInfo({
        message: isTestingMode ? "Simulación: Institución eliminada" : "Institución eliminada",
        type: "success",
      });
      setIdToDelete(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-instituciones"] });
    },
  });

  const handleBatchFix = async () => {
    setIsFixingData(true);
    try {
      const allInstitutions = await db.instituciones.getAll({
        fields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_CONVENIO_NUEVO_INSTITUCIONES],
      });

      const updates: any[] = [];
      const processList = (list: string[], year: number) => {
        for (const instNameFromList of list) {
          const targetNorm = normalizeStringForComparison(instNameFromList);
          const matches = allInstitutions.filter((i: any) => {
            const name = String(i[FIELD_NOMBRE_INSTITUCIONES] || "");
            if (name.toUpperCase().startsWith("UFLO -")) return false;

            const dbNameNorm = normalizeStringForComparison(name);
            return dbNameNorm.includes(targetNorm) || targetNorm.includes(dbNameNorm);
          });
          for (const match of matches) {
            if (Number(match[FIELD_CONVENIO_NUEVO_INSTITUCIONES]) !== year) {
              updates.push({
                id: match.id,
                fields: { [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: year },
              });
            }
          }
        }
      };
      processList(LISTA_CONVENIOS_2024, 2024);
      processList(LISTA_CONVENIOS_2025, 2025);

      const uniqueUpdates = Array.from(new Map(updates.map((item) => [item.id, item])).values());
      if (uniqueUpdates.length > 0) {
        await db.instituciones.updateMany(uniqueUpdates as any);
        queryClient.invalidateQueries({ queryKey: ["editor-instituciones"] });
        setToastInfo({
          message: `Se actualizaron ${uniqueUpdates.length} convenios.`,
          type: "success",
        });
      } else {
        setToastInfo({ message: `No hay nuevas instituciones para actualizar.`, type: "info" });
      }
    } catch (e: any) {
      handleError(e);
    } finally {
      setIsFixingData(false);
    }
  };

  const handleSyncOrientations = async () => {
    setIsSyncingOrientations(true);
    try {
      const [allInstitutions, allPracticas] = await Promise.all([
        db.instituciones.getAll({
          fields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_ORIENTACIONES_INSTITUCIONES],
        }),
        db.practicas.getAll({
          fields: [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS, FIELD_ESPECIALIDAD_PRACTICAS],
        }),
      ]);

      const orientationsMap = new Map<string, Set<string>>();

      allPracticas.forEach((p: any) => {
        const name = cleanInstitutionName(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]);
        const especialidad = p[FIELD_ESPECIALIDAD_PRACTICAS];
        if (name && especialidad) {
          const normName = normalizeStringForComparison(name.split("-")[0].trim());
          const normEsp = toTitleCase(especialidad.trim());

          if (!orientationsMap.has(normName)) orientationsMap.set(normName, new Set());
          orientationsMap.get(normName)!.add(normEsp);
        }
      });

      const updates: any[] = [];
      for (const inst of allInstitutions) {
        const name = inst[FIELD_NOMBRE_INSTITUCIONES];
        if (!name) continue;

        if (String(name).toUpperCase().startsWith("UFLO -")) continue;

        const normName = normalizeStringForComparison(name);
        let foundOrientations = new Set<string>();

        if (orientationsMap.has(normName)) {
          foundOrientations = orientationsMap.get(normName)!;
        } else {
          for (const [key, val] of orientationsMap.entries()) {
            if (key.length > 3 && normName.includes(key))
              val.forEach((o) => foundOrientations.add(o));
          }
        }

        if (foundOrientations.size > 0) {
          const uniqueArray = Array.from(foundOrientations).sort();
          const limitedArray = uniqueArray.slice(0, 4);
          const newString = limitedArray.join(", ");

          const currentStr = String(inst[FIELD_ORIENTACIONES_INSTITUCIONES] || "").trim();
          if (currentStr !== newString) {
            updates.push({
              id: inst.id,
              fields: { [FIELD_ORIENTACIONES_INSTITUCIONES]: newString },
            });
          }
        }
      }

      if (updates.length > 0) {
        const CHUNK = 50;
        for (let i = 0; i < updates.length; i += CHUNK) {
          await db.instituciones.updateMany(updates.slice(i, i + CHUNK) as any);
        }
        queryClient.invalidateQueries({ queryKey: ["editor-instituciones"] });
        setToastInfo({ message: `Orientaciones actualizadas y limpias.`, type: "success" });
      } else {
        setToastInfo({ message: "Todo sincronizado.", type: "success" });
      }
    } catch (e: any) {
      handleError(e);
    } finally {
      setIsSyncingOrientations(false);
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent, record: any) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, record });
  };

  const getYearTone = (rawYear: any): string => {
    if (!rawYear) return "mute";
    const y = String(rawYear).trim();
    if (y === "2026") return "ok";
    if (y === "2025") return "ai";
    if (y === "2024") return "accent";
    return "mute";
  };

  const renderConvenioValue = (val: any) => {
    // convenio_nuevo es el año (smallint) o null
    if (val == null || val === "" || val === "false") return <span className="dbe-muted">—</span>;
    return (
      <span className="dbe-pill" data-tone={getYearTone(val)}>
        <span className="material-icons">verified</span>
        {String(val)}
      </span>
    );
  };

  const renderOrientaciones = (orientacionesStr: string) => {
    if (!orientacionesStr) return <span className="dbe-muted">Sin especificar</span>;
    const lista = String(orientacionesStr)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      <div className="dbe-tags">
        {lista.map((o, idx) => (
          <span key={idx} className="dbe-tag">
            {o}
          </span>
        ))}
      </div>
    );
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
        title="¿Eliminar institución?"
        message="Esta acción eliminará la institución. No se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
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
              placeholder="Buscar institución…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button
          className="dbe-btn"
          onClick={handleSyncOrientations}
          disabled={isSyncingOrientations}
        >
          {isSyncingOrientations ? (
            <span className="dbe-spin" />
          ) : (
            <span className="material-icons">sync</span>
          )}
          Sincronizar orientaciones
        </button>
        <button className="dbe-btn" onClick={handleBatchFix} disabled={isFixingData}>
          {isFixingData ? (
            <span className="dbe-spin" />
          ) : (
            <span className="material-icons">auto_fix_high</span>
          )}
          Asignar años
        </button>
        <button
          className="dbe-btn dbe-btn-primary"
          onClick={() => setEditingRecord({ isCreating: true })}
        >
          <span className="material-icons">add_business</span>
          Nueva
        </button>
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
                  <th>Orientaciones</th>
                  <th style={{ textAlign: "center" }}>Año convenio</th>
                  <th>Referente</th>
                </tr>
              </thead>
              <tbody>
                {data?.records.map((i: any) => (
                  <tr
                    key={i.id}
                    onContextMenu={(e) => handleRowContextMenu(e, i)}
                    onDoubleClick={() => setEditingRecord(i)}
                  >
                    <td>
                      <div className="dbe-cell-strong">
                        {cleanInstitutionName(i[FIELD_NOMBRE_INSTITUCIONES])}
                      </div>
                      {i[FIELD_DIRECCION_INSTITUCIONES] && (
                        <div className="dbe-cell-sub">{i[FIELD_DIRECCION_INSTITUCIONES]}</div>
                      )}
                    </td>
                    <td>{renderOrientaciones(i[FIELD_ORIENTACIONES_INSTITUCIONES])}</td>
                    <td style={{ textAlign: "center" }}>
                      {renderConvenioValue(i[FIELD_CONVENIO_NUEVO_INSTITUCIONES])}
                    </td>
                    <td>
                      {i[FIELD_TUTOR_INSTITUCIONES] ? (
                        <span className="dbe-cell-strong" style={{ fontWeight: 500 }}>
                          {i[FIELD_TUTOR_INSTITUCIONES]}
                        </span>
                      ) : (
                        <span className="dbe-muted">No asignado</span>
                      )}
                    </td>
                  </tr>
                ))}
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

export default EditorInstituciones;
