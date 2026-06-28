// This file is deprecated as we have moved to direct DB column mapping in constants.ts
// It is kept empty to prevent build errors if imported, but should be removed eventually.
export const DB_FIELD_MAPPING = {};
export const mapFieldToDb = (_tableName: string, fieldName: string): string => fieldName;
export const mapFieldsToDb = (
  _tableName: string,
  fields: Record<string, unknown>
): Record<string, unknown> => fields;
export const mapDbRowToFields = (
  _tableName: string,
  row: Record<string, unknown>
): Record<string, unknown> => row;
