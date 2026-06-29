/**
 * launchQueryKeys — Fuente única de las claves de React Query derivadas de
 * lanzamientos (Lanzador).
 *
 * Antes cada vista del Lanzador armaba su propia query a `convocatorias` con
 * una clave distinta (`inscriptosForLaunch`, `inscriptos-seguro`,
 * `seleccionadosForLaunch`, `convocatoriasForLaunch-arch`…), además del sidebar
 * (RPC) y el Seleccionador (su propio hook). Eso generaba múltiples fuentes de
 * verdad: al seleccionar/deseleccionar en la mesa, una se actualizaba y las
 * otras quedaban obsoletas. Centralizar las claves acá permite:
 *   1. Compartir una sola query por dato (p. ej. el roster de inscriptos).
 *   2. Invalidar TODO lo derivado de un lanzamiento desde un único helper, así
 *      sidebar, canvas y seleccionador reconcilian siempre.
 */
import type { QueryClient } from "@tanstack/react-query";

export const launchKeys = {
  /** Lista completa de lanzamientos (sidebar + canvas). */
  history: (isTestingMode: boolean) => ["launchHistory", isTestingMode] as const,
  /** Conteos por lanzamiento (inscriptos/seleccionados) vía RPC. */
  convCounts: (launchIds: string[]) => ["convCountsByLaunch", launchIds.join(",")] as const,
  /** Conteos de consentimientos por lanzamiento vía RPC. */
  consentCounts: (launchIds: string[]) => ["consentByLaunch", launchIds.join(",")] as const,
  /** Roster de inscripciones (`convocatorias`) de un lanzamiento. */
  roster: (launchId: string) => ["launchRoster", launchId] as const,
  /** Prácticas vinculadas a un lanzamiento. */
  practicas: (launchId: string) => ["launchPracticas", launchId] as const,
  /** Compromisos digitales de un lanzamiento (sala de confirmación). */
  compromisos: (launchId: string) => ["launchCompromisos", launchId] as const,
};

// Prefijos de TODAS las queries derivadas de lanzamientos. Incluye las claves
// internas del Seleccionador (`useSeleccionadorLogic`) para que un cambio de
// selección propague a sidebar/canvas y viceversa. Invalidar por prefijo
// alcanza a todas las variantes (React Query matchea por prefijo).
const LAUNCH_QUERY_PREFIXES = [
  "launchHistory",
  "convCountsByLaunch",
  "consentByLaunch",
  "launchRoster",
  "launchPracticas",
  "launchCompromisos",
  // Seleccionador
  "candidatesForLaunch",
  "availableStudents",
  "seleccionadosInfo",
] as const;

/**
 * Invalida todas las queries derivadas de lanzamientos. Llamar tras cualquier
 * mutación que cambie selección, inscripción o estado de un lanzamiento.
 */
export function invalidateLaunchData(queryClient: QueryClient): void {
  LAUNCH_QUERY_PREFIXES.forEach((prefix) => queryClient.invalidateQueries({ queryKey: [prefix] }));
}
