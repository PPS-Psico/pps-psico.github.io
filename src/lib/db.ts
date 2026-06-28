import * as supabaseService from "../services/supabaseService";
import type { SortSpec, QueryFilters } from "../services/supabaseService";
import type { AppErrorResponse } from "../types";
import type { Database } from "../types/supabase";
import { supabase } from "./supabaseClient";
import { logger } from "../utils/logger";
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
      if (error) {
        logger.warn(`Fetch warning in ${tableName}:`, error);
        return [];
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
      if (error) return [];
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
    ): Promise<{ records: TAppRecord[]; total: number; error: AppErrorResponse | null }> => {
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
      return { records: records.map(mapper), total, error };
    },

    create: async (fields: Tables[TName]["Insert"]): Promise<TAppRecord> => {
      const { record, error } = await supabaseService.createRecord(tableName, fields);
      if (error) throw error;
      if (!record) throw new Error("Create failed, no record returned");
      return mapper(record);
    },

    update: async (recordId: string, fields: Tables[TName]["Update"]): Promise<TAppRecord> => {
      const { record, error } = await supabaseService.updateRecord(tableName, recordId, fields);
      if (error) throw error;
      if (!record) throw new Error("Update failed, no record returned");
      return mapper(record);
    },

    updateMany: async (
      records: { id: string; fields: Tables[TName]["Update"] }[]
    ): Promise<TAppRecord[]> => {
      const { records: updatedRecords, error } = await supabaseService.updateRecords(
        tableName,
        records
      );
      if (error) throw error;
      return (updatedRecords || []).map(mapper);
    },

    delete: async (recordId: string) => {
      const { success, error } = await supabaseService.deleteRecord(tableName, recordId);
      if (error) throw error;
      return success;
    },
  };
}

export const getStudentLoginInfo = async (legajo: string): Promise<{ email: string } | null> => {
  try {
    const { data, error } = await supabase.rpc("get_student_email_by_legajo", {
      legajo_input: legajo,
    });

    if (error) {
      logger.error("Error RPC get_student_email:", error);
      return null;
    }

    if (!data || typeof data !== "object" || !("email" in data)) {
      return null;
    }

    return { email: String((data as { email: unknown }).email) };
  } catch (error) {
    logger.error("Error fetching student login info:", error);
    return null;
  }
};

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
};
