import { supabase } from "../lib/supabaseClient";
import type { AppErrorResponse } from "../types";
import type { Database } from "../types/supabase";
import { FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS } from "../constants";
import { getErrorMessage as toErrorMessage } from "../utils/getErrorMessage";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper type for Table Names
type TableName = keyof Database["public"]["Tables"];

/** Columna + dirección para ordenar una consulta. */
export type SortSpec = { field: string; direction: "asc" | "desc" };

/** Mapa columna -> valor usado para construir cláusulas `.eq/.in/.ilike/.gte/.lte`. */
export type QueryFilters = Record<string, unknown>;

/**
 * Vista estructural mínima de un PostgrestFilterBuilder: solo los métodos que
 * encadenamos en `applyFilters`. Evita arrastrar los genéricos pesados de
 * supabase-js sin recurrir a `any`.
 */
interface GenericFilterBuilder {
  gte(column: string, value: unknown): GenericFilterBuilder;
  lte(column: string, value: unknown): GenericFilterBuilder;
  ilike(column: string, value: string): GenericFilterBuilder;
  in(column: string, values: readonly unknown[]): GenericFilterBuilder;
  eq(column: string, value: unknown): GenericFilterBuilder;
}

const buildSearchFilter = (searchTerm: string, searchFields: string[]) => {
  if (!searchTerm || searchFields.length === 0) return null;

  const term = searchTerm.replace(/[%\\]/g, "");
  if (!term) return null;

  return searchFields.map((field) => `${field}.ilike.*${term}*`).join(",");
};

/**
 * Aplica un mapa de filtros a una consulta PostgREST. Es genérico sobre el tipo
 * del builder (`Q`) para preservar el tipado del resto de la cadena
 * (`.or/.order/.range`) en el llamador.
 */
const applyFilters = <Q>(query: Q, filters?: QueryFilters): Q => {
  if (!filters) return query;
  let q = query as unknown as GenericFilterBuilder;
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;

    if (key === "startDate") q = q.gte("fecha_inicio", value);
    else if (key === "endDate") q = q.lte("fecha_inicio", value);
    else if (key === "finishDateGte") q = q.gte("fecha_finalizacion", value);
    else if (key === "finishDateLte") q = q.lte("fecha_finalizacion", value);
    else if (key === "institucion") q = q.ilike("nombre_institucion", `%${String(value)}%`);
    else if (key === FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS) {
      q = q.ilike(key, `%${String(value)}%`);
    } else if (Array.isArray(value)) {
      if (value.length > 0) q = q.in(key, value);
    } else if (typeof value === "string" && value.includes("%")) {
      q = q.ilike(key, value);
    } else {
      q = q.eq(key, value);
    }
  });
  return q as unknown as Q;
};

// Generic Fetch Paginated Data
export const fetchPaginatedData = async <T extends TableName>(
  tableName: T,
  page: number,
  pageSize: number,
  fields?: string[],
  searchTerm?: string,
  searchFields?: string[],
  sort?: SortSpec,
  filters?: QueryFilters
): Promise<{
  records: Database["public"]["Tables"][T]["Row"][];
  total: number;
  error: AppErrorResponse | null;
}> => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const selectQuery = fields && fields.length > 0 ? `id, created_at, ${fields.join(", ")}` : "*";

    let query = supabase.from(tableName).select(selectQuery, { count: "exact" });

    query = applyFilters(query, filters);

    if (searchTerm && searchFields && searchFields.length > 0) {
      const orQuery = buildSearchFilter(searchTerm, searchFields);
      if (orQuery) query = query.or(orQuery);
    }

    if (sort) query = query.order(sort.field, { ascending: sort.direction === "asc" });
    else query = query.order("created_at", { ascending: false });

    const { data, error, count } = await query.range(from, to);

    if (error)
      return {
        records: [],
        total: 0,
        error: { error: { type: "SUPABASE_ERROR", message: error.message } },
      };

    return {
      records: data as unknown as Database["public"]["Tables"][T]["Row"][],
      total: count || 0,
      error: null,
    };
  } catch (e) {
    return {
      records: [],
      total: 0,
      error: { error: { type: "UNKNOWN_ERROR", message: toErrorMessage(e) } },
    };
  }
};

// Generic Fetch All Data
export const fetchAllData = async <T extends TableName>(
  tableName: T,
  fields?: string[],
  filters?: QueryFilters,
  sort?: SortSpec[]
): Promise<{
  records: Database["public"]["Tables"][T]["Row"][];
  error: AppErrorResponse | null;
}> => {
  try {
    type Row = Database["public"]["Tables"][T]["Row"];
    let allRows: Row[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    const selectQuery = fields && fields.length > 0 ? `id, created_at, ${fields.join(", ")}` : "*";

    while (hasMore) {
      let attempt = 0;
      let success = false;
      let lastError: unknown = null;
      while (attempt < MAX_RETRIES && !success) {
        try {
          let query = supabase.from(tableName).select(selectQuery);
          query = applyFilters(query, filters);

          if (sort && sort.length > 0) {
            sort.forEach(
              (s) => (query = query.order(s.field, { ascending: s.direction === "asc" }))
            );
          } else {
            query = query.order("id", { ascending: true });
          }

          const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (data) {
            allRows = [...allRows, ...(data as unknown as Row[])];
            if (data.length < PAGE_SIZE) hasMore = false;
            else from += PAGE_SIZE;
          } else {
            hasMore = false;
          }
          success = true;
        } catch (err) {
          lastError = err;
          attempt++;
          if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
        }
      }
      if (!success)
        return {
          records: [],
          error: {
            error: {
              type: "SUPABASE_ERROR",
              message: lastError ? toErrorMessage(lastError) : "Network error",
            },
          },
        };
    }

    return { records: allRows, error: null };
  } catch (e) {
    return { records: [], error: { error: { type: "UNKNOWN_ERROR", message: toErrorMessage(e) } } };
  }
};

// Generic Fetch Single/Limited Data
export const fetchData = async <T extends TableName>(
  tableName: T,
  fields?: string[],
  filters?: QueryFilters,
  maxRecords?: number,
  sort?: SortSpec[]
): Promise<{
  records: Database["public"]["Tables"][T]["Row"][];
  error: AppErrorResponse | null;
}> => {
  if (maxRecords && maxRecords > 0) {
    try {
      const selectQuery =
        fields && fields.length > 0 ? `id, created_at, ${fields.join(", ")}` : "*";
      let query = supabase.from(tableName).select(selectQuery).limit(maxRecords);

      query = applyFilters(query, filters);

      if (sort && sort.length > 0)
        sort.forEach((s) => (query = query.order(s.field, { ascending: s.direction === "asc" })));

      const { data, error } = await query;
      if (error) throw error;

      return { records: data as unknown as Database["public"]["Tables"][T]["Row"][], error: null };
    } catch (e) {
      return {
        records: [],
        error: { error: { type: "SUPABASE_ERROR", message: toErrorMessage(e) } },
      };
    }
  }
  return await fetchAllData(tableName, fields, filters, sort);
};

// Generic Create
export const createRecord = async <T extends TableName>(
  tableName: T,
  fields: Database["public"]["Tables"][T]["Insert"]
): Promise<{
  record: Database["public"]["Tables"][T]["Row"] | null;
  error: AppErrorResponse | null;
}> => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      // supabase-js no resuelve el tipo Insert con un nombre de tabla genérico (T).
      // `fields` ya viene tipado como Insert<T>; el cast solo desbloquea el overload.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(fields as any)
      .select()
      .single();
    if (error)
      return { record: null, error: { error: { type: "CREATE_ERROR", message: error.message } } };

    return { record: data as unknown as Database["public"]["Tables"][T]["Row"], error: null };
  } catch (e) {
    return {
      record: null,
      error: { error: { type: "UNKNOWN_ERROR", message: toErrorMessage(e) } },
    };
  }
};

// Generic Update
export const updateRecord = async <T extends TableName>(
  tableName: T,
  recordId: string,
  fields: Database["public"]["Tables"][T]["Update"]
): Promise<{
  record: Database["public"]["Tables"][T]["Row"] | null;
  error: AppErrorResponse | null;
}> => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      // T genérico: supabase-js no infiere Update<T>. `fields` ya está tipado.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(fields as any)
      // T genérico: la columna "id" no se resuelve a string bajo el overload genérico.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq("id", recordId as any)
      .select()
      .maybeSingle();

    if (error) {
      return { record: null, error: { error: { type: "UPDATE_ERROR", message: error.message } } };
    }

    return { record: data as unknown as Database["public"]["Tables"][T]["Row"], error: null };
  } catch (e) {
    return {
      record: null,
      error: { error: { type: "UNKNOWN_ERROR", message: toErrorMessage(e) } },
    };
  }
};

// Generic Bulk Update
export const updateRecords = async <T extends TableName>(
  tableName: T,
  records: { id: string; fields: Database["public"]["Tables"][T]["Update"] }[]
): Promise<{
  records: Database["public"]["Tables"][T]["Row"][] | null;
  error: AppErrorResponse | null;
}> => {
  try {
    const promises = records.map((rec) => updateRecord(tableName, rec.id, rec.fields));
    const results = await Promise.all(promises);

    const failures = results.filter((r) => r.error);
    if (failures.length > 0)
      return {
        records: null,
        error: {
          error: {
            type: "BULK_UPDATE_PARTIAL_ERROR",
            message: "Algunos registros no se actualizaron.",
          },
        },
      };

    const successes = results.map((r) => r.record!).filter(Boolean);
    return { records: successes, error: null };
  } catch (e) {
    return {
      records: null,
      error: { error: { type: "UNKNOWN_ERROR", message: toErrorMessage(e) } },
    };
  }
};

// Generic Delete
export const deleteRecord = async <T extends TableName>(
  tableName: T,
  recordId: string
): Promise<{ success: boolean; error: AppErrorResponse | null }> => {
  try {
    const { error, count } = await supabase
      .from(tableName)
      .delete({ count: "exact" })
      // T genérico: la columna "id" no se resuelve a string bajo el overload genérico.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq("id", recordId as any);

    if (error)
      return { success: false, error: { error: { type: "DELETE_ERROR", message: error.message } } };

    if (count === 0) {
      return {
        success: false,
        error: {
          error: {
            type: "DELETE_ERROR",
            message: "No se pudo eliminar el registro.",
          },
        },
      };
    }

    return { success: true, error: null };
  } catch (e) {
    return {
      success: false,
      error: { error: { type: "UNKNOWN_ERROR", message: toErrorMessage(e) } },
    };
  }
};
