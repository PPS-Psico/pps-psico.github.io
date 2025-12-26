
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import type { Practica } from '../types';
import { FIELD_ESTADO_PRACTICA, FIELD_HORAS_PRACTICAS, FIELD_ESPECIALIDAD_PRACTICAS, FIELD_FECHA_FIN_PRACTICAS } from '../constants';

/**
 * Business Logic Layer for Student Rules
 * Contains pure functions determining student status, accreditation eligibility, and practice validity.
 */

// --- Constants ---
export const ACADEMIC_CONFIG = {
    HOURS_TOTAL_REQUIRED: 250,
    HOURS_SPECIALTY_REQUIRED: 70,
    ROTATION_AREAS_REQUIRED: 3,
    MAX_DAYS_INACTIVITY: 5, // For stagnant requests logic
};

// --- Practice Rules ---

/**
 * Determines if a practice is currently considered active/in-progress based on its status string.
 */
export const isPracticeActive = (status: string | null | undefined): boolean => {
    const s = normalizeStringForComparison(status);
    return s === 'en curso' || s === 'pendiente' || s === 'en proceso';
};

/**
 * Determines if a practice is officially finished/approved.
 */
export const isPracticeFinished = (status: string | null | undefined): boolean => {
    const s = normalizeStringForComparison(status);
    return s === 'finalizada' || s === 'pps realizada' || s === 'convenio realizado' || s === 'aprobada';
};

/**
 * Checks if an active practice has exceeded its end date.
 */
export const isPracticeOverdue = (practice: Practica): boolean => {
    if (!isPracticeActive(practice[FIELD_ESTADO_PRACTICA])) return false;
    
    const endDateStr = practice[FIELD_FECHA_FIN_PRACTICAS];
    if (!endDateStr) return false;

    const endDate = parseToUTCDate(endDateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return !!endDate && endDate < now;
};

// --- Aggregation Logic ---

/**
 * Calculates total hours from a list of practices.
 */
export const calculateTotalHours = (practices: Practica[]): number => {
    return practices.reduce((acc, p) => acc + (p[FIELD_HORAS_PRACTICAS] || 0), 0);
};

/**
 * Calculates hours specific to a target orientation (specialty).
 */
export const calculateSpecialtyHours = (practices: Practica[], targetOrientation: string): number => {
    if (!targetOrientation) return 0;
    const normalizedTarget = normalizeStringForComparison(targetOrientation);
    
    return practices
        .filter(p => normalizeStringForComparison(p[FIELD_ESPECIALIDAD_PRACTICAS]) === normalizedTarget)
        .reduce((acc, p) => acc + (p[FIELD_HORAS_PRACTICAS] || 0), 0);
};

/**
 * Extracts unique orientations from a list of practices.
 */
export const getUniqueOrientations = (practices: Practica[]): string[] => {
    return [...new Set(practices
        .map(p => p[FIELD_ESPECIALIDAD_PRACTICAS])
        .filter(Boolean)
        .map(String)
    )];
};

/**
 * Check if the student has any active practice that prevents accreditation.
 */
export const hasBlockingActivePractices = (practices: Practica[]): boolean => {
    return practices.some(p => isPracticeActive(p[FIELD_ESTADO_PRACTICA]));
};

// --- Graduation Rules ---

export interface GraduationStatus {
    canGraduate: boolean;
    requirements: {
        totalHours: boolean;
        specialtyHours: boolean;
        rotation: boolean;
        noActivePractices: boolean;
    }
}

/**
 * Comprehensive check to see if a student meets all criteria for accreditation.
 */
export const checkGraduationStatus = (
    practices: Practica[], 
    selectedOrientation: string,
    config = ACADEMIC_CONFIG
): GraduationStatus => {
    const totalHours = calculateTotalHours(practices);
    const specialtyHours = calculateSpecialtyHours(practices, selectedOrientation);
    const uniqueOrientations = getUniqueOrientations(practices);
    const hasActive = hasBlockingActivePractices(practices);

    const reqs = {
        totalHours: totalHours >= config.HOURS_TOTAL_REQUIRED,
        specialtyHours: specialtyHours >= config.HOURS_SPECIALTY_REQUIRED,
        rotation: uniqueOrientations.length >= config.ROTATION_AREAS_REQUIRED,
        noActivePractices: !hasActive
    };

    return {
        canGraduate: reqs.totalHours && reqs.specialtyHours && reqs.rotation && reqs.noActivePractices,
        requirements: reqs
    };
};
