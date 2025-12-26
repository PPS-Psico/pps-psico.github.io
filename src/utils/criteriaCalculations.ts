
import { Practica, Orientacion, CriteriosCalculados } from '../types';
import * as StudentRules from '../logic/studentRules';

// Default config if not provided
const DEFAULT_CONFIG = {
    horasObjetivoTotal: StudentRules.ACADEMIC_CONFIG.HOURS_TOTAL_REQUIRED,
    horasObjetivoOrientacion: StudentRules.ACADEMIC_CONFIG.HOURS_SPECIALTY_REQUIRED,
    rotacionObjetivo: StudentRules.ACADEMIC_CONFIG.ROTATION_AREAS_REQUIRED
};

export const initialCriterios: CriteriosCalculados = {
    horasTotales: 0,
    horasFaltantes250: DEFAULT_CONFIG.horasObjetivoTotal,
    cumpleHorasTotales: false,
    horasOrientacionElegida: 0,
    horasFaltantesOrientacion: DEFAULT_CONFIG.horasObjetivoOrientacion,
    cumpleHorasOrientacion: false,
    orientacionesCursadasCount: 0,
    orientacionesUnicas: [],
    cumpleRotacion: false,
    tienePracticasPendientes: false,
};

export interface CalculationConfig {
    horasObjetivoTotal: number;
    horasObjetivoOrientacion: number;
    rotacionObjetivo: number;
}

export const calculateCriterios = (
  allPracticas: Practica[], 
  selectedOrientacion: Orientacion | "",
  config: CalculationConfig
): CriteriosCalculados => {
    
  if (allPracticas.length === 0) return {
      ...initialCriterios,
      horasFaltantes250: config.horasObjetivoTotal,
      horasFaltantesOrientacion: config.horasObjetivoOrientacion
  };

  // Use Domain Logic
  const horasTotales = StudentRules.calculateTotalHours(allPracticas);
  const horasOrientacionElegida = StudentRules.calculateSpecialtyHours(allPracticas, selectedOrientacion);
  const orientacionesUnicas = StudentRules.getUniqueOrientations(allPracticas);
  const tienePracticasPendientes = StudentRules.hasBlockingActivePractices(allPracticas);

  // Apply Config Thresholds
  const cumpleHorasTotales = horasTotales >= config.horasObjetivoTotal;
  const cumpleHorasOrientacion = horasOrientacionElegida >= config.horasObjetivoOrientacion;
  const cumpleRotacion = orientacionesUnicas.length >= config.rotacionObjetivo;

  return {
    horasTotales,
    cumpleHorasTotales,
    horasOrientacionElegida,
    cumpleHorasOrientacion,
    orientacionesCursadasCount: orientacionesUnicas.length,
    orientacionesUnicas,
    cumpleRotacion,
    horasFaltantes250: Math.max(0, config.horasObjetivoTotal - horasTotales),
    horasFaltantesOrientacion: Math.max(0, config.horasObjetivoOrientacion - horasOrientacionElegida),
    tienePracticasPendientes
  };
};
