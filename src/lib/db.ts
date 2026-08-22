import * as supabaseService from "../services/supabaseService";
import type { SortSpec, QueryFilters } from "../services/supabaseService";
import type { Database } from "../types/supabase";
import { classifyDbError, DbError } from "./dbError";
import {
  mapEstudiante,
  mapPractica,
  mapLanzamiento,
  mapConvocatoria,
  mapInstitucion,
  mapPenalizacion,
  mapSolicitud,
  mapFinalizacion,
  mapCompromiso,
  mapConvenio,
} from "../utils/mappers";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

// Generic Interface for DB operations
function createTableInterface<TName extends TableName, TAppRecord>(
  tableName: TName,
  mapper: (row: Tables[TName]["Row"]) => TAppRecord
) {
  return {
    getAll: async (options?: {
      filters?: QueryFilters;
      sort?: SortSpec[];
      fields?: string[];
    }): Promise<TAppRecord[]> => {
      const { records, error } = await supabaseService.fetchAllData(
        tableName,
        options?.fields,
        options?.filters,
        options?.sort
      );
      // Antes esto devolvia `[]` y logueaba un warn. Una consulta fallida y una
      // tabla vacia quedaban indistinguibles, asi que la UI mostraba "no hay
      // datos" ante una caida de red o una sesion vencida.
      if (error) {
        throw classifyDbError(error, { table: tableName, operation: "getAll" });
      }
      return records.map(mapper);
    },

    get: async (options?: {
      filters?: QueryFilters;
      maxRecords?: number;
      sort?: SortSpec[];
    }): Promise<TAppRecord[]> => {
      const { records, error } = await supabaseService.fetchData(
        tableName,
        [],
        options?.filters,
        options?.maxRecords,
        options?.sort
      );
      if (error) {
        throw classifyDbError(error, { table: tableName, operation: "get" });
      }
      return records.map(mapper);
    },

    // Server-Side Pagination
    getPage: async (
      page: number,
      pageSize: number,
      options?: {
        searchTerm?: string;
        searchFields?: string[];
        sort?: SortSpec;
        filters?: QueryFilters;
      }
    ): Promise<{ records: TAppRecord[]; total: number }> => {
      const { records, total, error } = await supabaseService.fetchPaginatedData(
        tableName,
        page,
        pageSize,
        [],
        options?.searchTerm,
        options?.searchFields,
        options?.sort,
        options?.filters
      );
      // Antes devolvia el error dentro del objeto y cada call-site decidia si
      // mirarlo. Ahora lanza, como el resto de la capa.
      if (error) {
        throw classifyDbError(error, { table: tableName, operation: "getPage" });
      }
      return { records: records.map(mapper), total };
    },

    create: async (fields: Tables[TName]["Insert"]): Promise<TAppRecord> => {
      const { record, error } = await supabaseService.createRecord(tableName, fields);
      if (error) throw classifyDbError(error, { table: tableName, operation: "create" });
      if (!record) {
        throw new DbError("unknown", "La creacion no devolvio ningun registro", {
          table: tableName,
          operation: "create",
        });
      }
      return mapper(record);
    },

    update: async (recordId: string, fields: Tables[TName]["Update"]): Promise<TAppRecord> => {
      const { record, error } = await supabaseService.updateRecord(tableName, recordId, fields);
      if (error) throw classifyDbError(error, { table: tableName, operation: "update" });
      if (!record) {
        throw new DbError("unknown", "La actualizacion no devolvio ningun registro", {
          table: tableName,
          operation: "update",
        });
      }
      return mapper(record);
    },

    updateMany: async (
      records: { id: string; fields: Tables[TName]["Update"] }[]
    ): Promise<TAppRecord[]> => {
      const { records: updatedRecords, error } = await supabaseService.updateRecords(
        tableName,
        records
      );
      if (error) throw classifyDbError(error, { table: tableName, operation: "updateMany" });
      return (updatedRecords || []).map(mapper);
    },

    delete: async (recordId: string) => {
      const { success, error } = await supabaseService.deleteRecord(tableName, recordId);
      if (error) throw classifyDbError(error, { table: tableName, operation: "delete" });
      return success;
    },
  };
}

// Typed DB Interface
export const db = {
  estudiantes: createTableInterface("estudiantes", mapEstudiante),
  practicas: createTableInterface("practicas", mapPractica),
  convocatorias: createTableInterface("convocatorias", mapConvocatoria),
  lanzamientos: createTableInterface("lanzamientos_pps", mapLanzamiento),
  instituciones: createTableInterface("instituciones", mapInstitucion),
  penalizaciones: createTableInterface("penalizaciones", mapPenalizacion),
  solicitudes: createTableInterface("solicitudes_pps", mapSolicitud),
  finalizacion: createTableInterface("finalizacion_pps", mapFinalizacion),
  compromisos: createTableInterface("compromisos_pps", mapCompromiso),
  convenios: createTableInterface("convenios", mapConvenio),
  aula_entregas: createTableInterface("aula_entregas", (row) => row),
};
