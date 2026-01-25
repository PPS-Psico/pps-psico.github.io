import { useState, useMemo } from 'react';
import type { Practica } from '../types';
import {
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_ESPECIALIDAD_PRACTICAS
} from '../constants';
import { normalizeStringForComparison } from '../utils/formatters';

export type SortablePracticaKey = 'institucion' | 'especialidad' | 'horas' | 'fechaInicio' | 'estado';
type SortDirection = 'ascending' | 'descending';
export type SortConfig = { key: SortablePracticaKey | null; direction: SortDirection };

export const useSortablePracticas = (practicas: Practica[], initialConfig: SortConfig) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialConfig);

  const sortedPracticas = useMemo(() => {
    let processableItems = [...practicas];
    if (sortConfig.key !== null) {
      processableItems.sort((a, b) => {
        let aValue: string | number, bValue: string | number;
        const safeGetTime = (dateStr: string | null | undefined) => {
          if (!dateStr) return 0;
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? 0 : date.getTime();
        };
        switch (sortConfig.key) {
          case 'institucion':
            aValue = normalizeStringForComparison(Array.isArray(a[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) ? a[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]?.[0] : a[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]);
            bValue = normalizeStringForComparison(Array.isArray(b[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) ? b[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]?.[0] : b[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]);
            break;
          case 'especialidad':
            aValue = normalizeStringForComparison(a[FIELD_ESPECIALIDAD_PRACTICAS]);
            bValue = normalizeStringForComparison(b[FIELD_ESPECIALIDAD_PRACTICAS]);
            break;
          case 'horas':
            aValue = a[FIELD_HORAS_PRACTICAS] || 0;
            bValue = b[FIELD_HORAS_PRACTICAS] || 0;
            break;
          case 'fechaInicio':
            aValue = safeGetTime(a[FIELD_FECHA_INICIO_PRACTICAS]);
            bValue = safeGetTime(b[FIELD_FECHA_INICIO_PRACTICAS]);
            break;
          case 'estado':
            aValue = normalizeStringForComparison(a[FIELD_ESTADO_PRACTICA]);
            bValue = normalizeStringForComparison(b[FIELD_ESTADO_PRACTICA]);
            break;
          default:
            return 0;
        }
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return processableItems;
  }, [practicas, sortConfig]);

  const requestSort = (key: SortablePracticaKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { sortedPracticas, requestSort, sortConfig };
};
